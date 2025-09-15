import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getProject } from "../catalogo/services/projectsService";
import type { Addon, ProjectDoc } from "../catalogo/types";
import { sendOrderConfirmationEmail } from "../notifications/emailProvider";
import { getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

/* helpers de máscara/validação */
function reais(n: number) {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0); }
  catch { return `R$ ${Number(n || 0).toFixed(2)}`; }
}
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

function maskPhoneBR(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a,b,c) =>
    (a ? `(${a}` : "") + (a.length===2?") ":"") + (b||"") + (c?`-${c}`:""));
  return d.replace(/(\d{0,2})(\d{0,5})(\d{0,4}).*/, (_, a,b,c) =>
    (a ? `(${a}` : "") + (a.length===2?") ":"") + (b||"") + (c?`-${c}`:""));
}
const isValidPhoneBR = (m: string) => {
  const d = onlyDigits(m);
  return d.length===10 || d.length===11;
};

function maskCpfCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
function isValidCpf(digits: string) {
  const d = onlyDigits(digits);
  if (d.length !== 11 || /^(.)\1+$/.test(d)) return false;
  let s = 0; for (let i=0;i<9;i++) s += parseInt(d[i])*(10-i);
  let r = (s*10)%11; if (r===10) r=0; if (r!==parseInt(d[9])) return false;
  s = 0; for (let i=0;i<10;i++) s += parseInt(d[i])*(11-i);
  r = (s*10)%11; if (r===10) r=0; return r===parseInt(d[10]);
}
function isValidCnpj(digits: string) {
  const c = onlyDigits(digits);
  if (c.length !== 14 || /^(.)\1+$/.test(c)) return false;
  const b1 = [5,4,3,2,9,8,7,6,5,4,3,2], b2 = [6,...b1];
  const calc = (base:number[]) => {
    const s = base.reduce((acc, w, i) => acc + w*parseInt(c[i]), 0);
    const r = s % 11; return r < 2 ? 0 : 11 - r;
  };
  return calc(b1) === parseInt(c[12]) && calc(b2) === parseInt(c[13]);
}
const isValidCpfCnpj = (v: string) => {
  const d = onlyDigits(v);
  return d.length===11 ? isValidCpf(d) : d.length===14 ? isValidCnpj(d) : false;
};

const maskCep = (v: string) => onlyDigits(v).slice(0,8).replace(/(\d{5})(\d)/,"$1-$2");
const isValidCep = (v: string) => onlyDigits(v).length === 8;

/* tipos locais */
type NavState = { selectedAddons?: Addon[] } | null;
type PaymentMethod = "pix" | "card" | "boleto";

type Address = {
  zip: string; street: string; number: string;
  complement?: string; district?: string; city: string; state: string;
};
type CreatePrefPayload = {
  projectId: string;
  addons: { id: string; label: string; price: number }[];
  customer: {
    name: string; email: string; phone?: string;
    taxId?: string; address?: Address | null;
  };
  payment: { method: PaymentMethod; installments: number };
};
type CreatePrefResponse = {
  orderId: string; init_point: string; preferenceId?: string;
};

const CREATE_MP_URL =
  import.meta.env.VITE_CREATE_MP_URL ||
  "https://southamerica-east1-portal-malta.cloudfunctions.net/createMpPreferenceHttp";

export default function CheckoutPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as NavState) || null;

  const [project, setProject] = useState<ProjectDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");

  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");

  const [errors, setErrors] = useState<Record<string,string>>({});
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState<number>(1);

  // auth anônima
  useEffect(() => {
    const auth = getAuth(getApp());
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) try { await signInAnonymously(auth); } catch {}
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProject(id).then(setProject).finally(() => setLoading(false));
  }, [id]);

  const selectedAddons = navState?.selectedAddons ?? [];

  const total = useMemo(() => {
    const base = Number(project?.price || 0);
    const extras = selectedAddons.reduce((acc, a) => acc + (Number(a.price) || 0), 0);
    return base + extras;
  }, [project, selectedAddons]);

  const perInstallment = useMemo(() => {
    if (method !== "card") return null;
    return total / (installments || 1);
  }, [method, installments, total]);

  function validate(): boolean {
    const next: Record<string,string> = {};
    if (!name.trim()) next.name = "Informe seu nome completo.";
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) next.email = "E-mail inválido.";
    if (phone.trim() && !isValidPhoneBR(phone)) next.phone = "Telefone inválido.";
    if (!taxId.trim() || !isValidCpfCnpj(taxId)) next.taxId = "CPF/CNPJ inválido.";

    if (!isValidCep(zip)) next.zip = "CEP inválido.";
    if (!street.trim()) next.street = "Informe a rua.";
    if (!number.trim()) next.number = "Informe o número.";
    if (!city.trim()) next.city = "Informe a cidade.";
    if (!stateUf.trim() || stateUf.trim().length !== 2) next.stateUf = "UF inválida.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !id) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      // token auth
      const auth = getAuth(getApp());
      if (!auth.currentUser) await signInAnonymously(auth);
      const token = await auth.currentUser!.getIdToken();

      const payload: CreatePrefPayload = {
        projectId: id,
        addons: selectedAddons.map((a) => ({
          id: a.id, label: a.label, price: Number(a.price) || 0,
        })),
        customer: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() ? onlyDigits(phone) : undefined,
          taxId: onlyDigits(taxId),
          address: {
            zip: onlyDigits(zip),
            street: street.trim(),
            number: number.trim(),
            complement: complement.trim() || undefined,
            district: district.trim() || undefined,
            city: city.trim(),
            state: stateUf.trim().toUpperCase(),
          },
        },
        payment: { method, installments: method === "card" ? installments : 1 },
      };

      const resp = await fetch(CREATE_MP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const out: CreatePrefResponse & { error?: string; message?: string; cause?: any } =
        await resp.json();
      if (!resp.ok) {
        const details = out?.cause ? `\n• cause: ${JSON.stringify(out.cause)}` : "";
        throw new Error(`${out?.message || out?.error || "Falha ao criar preferência"}${details}`);
      }

      const { orderId, init_point } = out;
      let opened = false;
      if (init_point) {
        const w = window.open(init_point, "_blank", "noopener,noreferrer");
        opened = !!(w && !w.closed);
      }

      try {
        await sendOrderConfirmationEmail({
          orderId,
          to: email.trim(),
          name: name.trim(),
          projectTitle: project.title,
          total,
          installments: method === "card" ? installments : 1,
          paymentMethod: method,
        });
      } catch {}

      if (opened) navigate(`/pedido/${orderId}`, { replace: true });
      else navigate(`/pedido/${orderId}?pay=1`, { replace: true });
    } catch (err: any) {
      console.error("createMpPreference HTTP error:", err);
      alert(`Não foi possível iniciar o pagamento.\n${err?.message || String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10"><p className="text-slate-500">Carregando…</p></div>;
  }
  if (!project) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        <p className="text-slate-500">Projeto não encontrado.</p>
        <button className="underline" onClick={() => navigate("/")}>Voltar para a Home</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Resumo */}
      <aside className="lg:col-span-1 space-y-3">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Resumo do pedido</h2>
          <div className="text-sm">
            <div className="font-medium">{project.title}</div>
            <div className="text-zinc-600">Base: {reais(Number(project.price || 0))}</div>
            {selectedAddons.length > 0 && (
              <ul className="mt-2 space-y-1">
                {selectedAddons.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700">{a.label}</span>
                    <span className="text-zinc-700">+ {reais(Number(a.price) || 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 pt-3 border-t text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Pagamento</span>
              <span className="font-medium">
                {method === "pix" && "PIX"}
                {method === "boleto" && "Boleto"}
                {method === "card" && `Cartão (${installments}x)`}
              </span>
            </div>
            {perInstallment && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Parcela</span>
                <span className="font-medium">{reais(perInstallment)}</span>
              </div>
            )}
            <div className="pt-2 border-t flex items-center justify-between">
              <span className="text-zinc-600">Total</span>
              <span className="text-lg font-semibold">{reais(total)}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Formulário */}
      <form className="lg:col-span-2 space-y-4" onSubmit={onSubmit}>
        <h1 className="text-xl font-semibold">Finalizar compra</h1>

        {/* Identificação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">Nome completo</span>
            <input
              className={`w-full rounded-lg border px-3 py-2 ${errors.name ? "border-red-500" : ""}`}
              value={name} onChange={(e) => setName(e.target.value)} required
            />
            {errors.name && <span className="text-xs text-red-600">{errors.name}</span>}
          </label>
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">E-mail</span>
            <input
              type="email"
              className={`w-full rounded-lg border px-3 py-2 ${errors.email ? "border-red-500" : ""}`}
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
            {errors.email && <span className="text-xs text-red-600">{errors.email}</span>}
          </label>
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">Telefone (com DDD)</span>
            <input
              placeholder="(11) 98765-4321"
              className={`w-full rounded-lg border px-3 py-2 ${errors.phone ? "border-red-500" : ""}`}
              value={phone} onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
            />
            {errors.phone && <span className="text-xs text-red-600">{errors.phone}</span>}
          </label>
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">CPF/CNPJ</span>
            <input
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className={`w-full rounded-lg border px-3 py-2 ${errors.taxId ? "border-red-500" : ""}`}
              value={taxId} onChange={(e) => setTaxId(maskCpfCnpj(e.target.value))}
              required
            />
            {errors.taxId && <span className="text-xs text-red-600">{errors.taxId}</span>}
          </label>
        </div>

        {/* Endereço */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">CEP</span>
            <input
              placeholder="00000-000"
              className={`w-full rounded-lg border px-3 py-2 ${errors.zip ? "border-red-500" : ""}`}
              value={zip} onChange={(e) => setZip(maskCep(e.target.value))} required
            />
            {errors.zip && <span className="text-xs text-red-600">{errors.zip}</span>}
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm text-zinc-600">Rua</span>
            <input
              className={`w-full rounded-lg border px-3 py-2 ${errors.street ? "border-red-500" : ""}`}
              value={street} onChange={(e) => setStreet(e.target.value)} required
            />
            {errors.street && <span className="text-xs text-red-600">{errors.street}</span>}
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">Número</span>
            <input
              className={`w-full rounded-lg border px-3 py-2 ${errors.number ? "border-red-500" : ""}`}
              value={number} onChange={(e) => setNumber(e.target.value)} required
            />
            {errors.number && <span className="text-xs text-red-600">{errors.number}</span>}
          </label>
          <label className="space-y-1 sm:col-span-3">
            <span className="text-sm text-zinc-600">Complemento</span>
            <input className="w-full rounded-lg border px-3 py-2" value={complement}
              onChange={(e) => setComplement(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">Bairro</span>
            <input className="w-full rounded-lg border px-3 py-2" value={district}
              onChange={(e) => setDistrict(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">Cidade</span>
            <input
              className={`w-full rounded-lg border px-3 py-2 ${errors.city ? "border-red-500" : ""}`}
              value={city} onChange={(e) => setCity(e.target.value)} required
            />
            {errors.city && <span className="text-xs text-red-600">{errors.city}</span>}
          </label>
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">UF</span>
            <input
              placeholder="SP"
              className={`w-full rounded-lg border px-3 py-2 ${errors.stateUf ? "border-red-500" : ""}`}
              value={stateUf} maxLength={2}
              onChange={(e) => setStateUf(e.target.value.toUpperCase())} required
            />
            {errors.stateUf && <span className="text-xs text-red-600">{errors.stateUf}</span>}
          </label>
        </div>

        {/* Pagamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm text-zinc-600">Método de pagamento</span>
            <select
              className="w-full rounded-lg border px-3 py-2 bg-white"
              value={method}
              onChange={(e) => {
                const m = e.target.value as PaymentMethod;
                setMethod(m);
                if (m !== "card") setInstallments(1);
              }}
            >
              <option value="pix">PIX</option>
              <option value="card">Cartão de crédito</option>
              <option value="boleto">Boleto bancário</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm text-zinc-600">Parcelas</span>
            <select
              disabled={method !== "card"}
              className="w-full rounded-lg border px-3 py-2 bg-white disabled:bg-zinc-100"
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}x</option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !authReady}
          className={`rounded-xl px-4 py-2 text-white font-medium ${
            submitting || !authReady ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {submitting ? "Redirecionando…" : "Ir para o pagamento"}
        </button>
      </form>
    </div>
  );
}
