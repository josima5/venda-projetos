// src/modules/portal/pages/EntregaForm.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../firebase/config";
import { ArrowLeft, Loader2, Save } from "lucide-react";

/**
 * Rota esperada: /portal/pedidos/:orderId/entrega
 * (detecto :orderId direto do pathname para não depender de tipagem externa)
 */
function readOrderId() {
  const m = window.location.pathname.match(/\/portal\/pedidos\/([^/]+)\/entrega/);
  return m?.[1] || "";
}

export default function EntregaForm() {
  const nav = useNavigate();
  const user = auth.currentUser;
  const orderId = readOrderId();

  const [submitting, setSubmitting] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);

  // campos
  const [resp, setResp] = useState({
    nome: "",
    cpfCnpj: "",
    email: user?.email || "",
    telefone: "",
  });
  const [end, setEnd] = useState({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const [terreno, setTerreno] = useState({
    lote: "",
    quadra: "",
    matricula: "",
    area: "",
    frente: "",
    fundos: "",
    lateralDireita: "",
    lateralEsquerda: "",
  });

  // já existe formulário?
  useEffect(() => {
    if (!user?.uid || !orderId) return;
    const q = query(
      collection(db, "deliveryForms"),
      where("orderId", "==", orderId),
      where("customerUid", "==", user.uid),
      limit(1)
    );
    getDocs(q)
      .then((s) => setExists(s.size > 0))
      .catch(() => setExists(false));
  }, [orderId, user?.uid]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid || !orderId || submitting) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "deliveryForms"), {
        orderId,
        customerUid: user.uid,
        responsible: resp,
        address: end,
        land: terreno, // inclui as novas medidas
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // volta para o pedido, downloads serão liberados (a página observa em tempo real)
      nav(`/pedido/${orderId}`, { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => nav(-1)}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <h1 className="text-lg font-semibold">Formulário de entrega</h1>
      <p className="text-sm text-gray-500">
        Preencha os dados abaixo para emitirmos a <strong>ART</strong> e liberar os documentos do seu
        projeto.
      </p>

      {exists === true ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Formulário já enviado. Você pode voltar ao pedido.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          {/* --- Proprietário --- */}
          <fieldset className="rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">Dados do proprietário do terreno</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                label="Nome completo"
                value={resp.nome}
                onChange={(v) => setResp((s) => ({ ...s, nome: v }))}
                required
              />
              <Input
                label="CPF/CNPJ"
                value={resp.cpfCnpj}
                onChange={(v) => setResp((s) => ({ ...s, cpfCnpj: v }))}
                required
              />
              <Input
                label="E-mail"
                type="email"
                value={resp.email}
                onChange={(v) => setResp((s) => ({ ...s, email: v }))}
                required
              />
              <Input
                label="Telefone"
                value={resp.telefone}
                onChange={(v) => setResp((s) => ({ ...s, telefone: v }))}
                required
              />
            </div>
          </fieldset>

          {/* --- Endereço --- */}
          <fieldset className="rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">Endereço da Obra</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Input label="CEP" value={end.cep} onChange={(v) => setEnd((s) => ({ ...s, cep: v }))} />
              <Input
                className="md:col-span-2"
                label="Logradouro"
                value={end.logradouro}
                onChange={(v) => setEnd((s) => ({ ...s, logradouro: v }))}
              />
              <Input label="Número" value={end.numero} onChange={(v) => setEnd((s) => ({ ...s, numero: v }))} />
              <Input
                label="Complemento"
                value={end.complemento}
                onChange={(v) => setEnd((s) => ({ ...s, complemento: v }))}
              />
              <Input label="Bairro" value={end.bairro} onChange={(v) => setEnd((s) => ({ ...s, bairro: v }))} />
              <Input label="Cidade" value={end.cidade} onChange={(v) => setEnd((s) => ({ ...s, cidade: v }))} />
              <Input label="UF" value={end.uf} onChange={(v) => setEnd((s) => ({ ...s, uf: v }))} />
            </div>
          </fieldset>

          {/* --- Terreno --- */}
          <fieldset className="rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">Dados do terreno</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <Input label="Lote" value={terreno.lote} onChange={(v) => setTerreno((s) => ({ ...s, lote: v }))} />
              <Input label="Quadra" value={terreno.quadra} onChange={(v) => setTerreno((s) => ({ ...s, quadra: v }))} />
              <Input
                label="Matrícula"
                value={terreno.matricula}
                onChange={(v) => setTerreno((s) => ({ ...s, matricula: v }))}
              />
              <Input
                label="Área (m²)"
                value={terreno.area}
                onChange={(v) => setTerreno((s) => ({ ...s, area: v }))}
              />
            </div>

            {/* Medidas perimetrais */}
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Input
                label="Frente (m)"
                value={terreno.frente}
                onChange={(v) => setTerreno((s) => ({ ...s, frente: v }))}
              />
              <Input
                label="Fundos (m)"
                value={terreno.fundos}
                onChange={(v) => setTerreno((s) => ({ ...s, fundos: v }))}
              />
              <Input
                label="Lateral direita (m)"
                value={terreno.lateralDireita}
                onChange={(v) => setTerreno((s) => ({ ...s, lateralDireita: v }))}
              />
              <Input
                label="Lateral esquerda (m)"
                value={terreno.lateralEsquerda}
                onChange={(v) => setTerreno((s) => ({ ...s, lateralEsquerda: v }))}
              />
            </div>
          </fieldset>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Enviar formulário
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ------- inputzinho simples ------- */
function Input({
  label,
  value,
  onChange,
  required,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`text-sm ${className}`}>
      <span className="mb-1 block text-gray-700">{label}</span>
      <input
        className="w-full rounded-md border px-3 py-2 outline-none ring-0 focus:border-blue-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        type={type}
      />
    </label>
  );
}
