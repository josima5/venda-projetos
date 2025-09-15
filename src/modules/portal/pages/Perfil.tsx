import { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged, updateProfile } from "firebase/auth";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "../../../firebase/config";

/* Helpers básicos */
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const maskCep = (v: string) => onlyDigits(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
const isValidCep = (v: string) => onlyDigits(v).length === 8;

function maskPhoneBR(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      (a ? `(${a}` : "") + (a.length === 2 ? ") " : "") + (b || "") + (c ? `-${c}` : "")
    );
  }
  return d.replace(/(\d{0,2})(\d{0,5})(\d{0,4}).*/, (_, a, b, c) =>
    (a ? `(${a}` : "") + (a.length === 2 ? ") " : "") + (b || "") + (c ? `-${c}` : "")
  );
}
const isValidPhoneBR = (m: string) => {
  const d = onlyDigits(m);
  return d.length === 10 || d.length === 11;
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

/** Ajuste aqui se seu profile tiver outro nome/coleção */
const PROFILE_COLLECTION = "userProfiles";

export default function Perfil() {
  const [uid, setUid] = useState<string | null>(getAuth().currentUser?.uid ?? null);
  const [email, setEmail] = useState<string | null>(getAuth().currentUser?.email ?? null);
  const [displayName, setDisplayName] = useState(getAuth().currentUser?.displayName ?? "");

  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(getAuth(), (u) => {
      setUid(u?.uid ?? null);
      setEmail(u?.email ?? null);
      setDisplayName(u?.displayName ?? "");
    });
  }, []);

  const ref: DocumentReference | null = useMemo(() => {
    if (!uid) return null;
    return doc(db, PROFILE_COLLECTION, uid);
  }, [uid]);

  useEffect(() => {
    if (!ref) {
      setLoading(false);
      return;
    }
    const off = onSnapshot(ref, (snap) => {
      const d = snap.data() as any | undefined;
      if (d) {
        setDisplayName(d.name ?? d.displayName ?? displayName ?? "");
        setPhone(d.phone ? maskPhoneBR(String(d.phone)) : "");
        setTaxId(d.taxId ? maskCpfCnpj(String(d.taxId)) : "");
        setZip(d.address?.zip ? maskCep(String(d.address.zip)) : "");
        setStreet(d.address?.street ?? "");
        setNumber(d.address?.number ?? "");
        setComplement(d.address?.complement ?? "");
        setDistrict(d.address?.district ?? "");
        setCity(d.address?.city ?? "");
        setStateUf(d.address?.state ?? "");
      }
      setLoading(false);
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !ref) return;

    setErr(null);
    setMsg(null);

    // validação simples
    if (!displayName.trim()) return setErr("Informe seu nome completo.");
    if (phone && !isValidPhoneBR(phone)) return setErr("Telefone inválido.");
    if (!taxId.trim()) return setErr("Informe seu CPF/CNPJ.");
    if (!isValidCep(zip)) return setErr("CEP inválido.");
    if (!street.trim()) return setErr("Informe a rua.");
    if (!number.trim()) return setErr("Informe o número.");
    if (!city.trim()) return setErr("Informe a cidade.");
    if (!stateUf.trim() || stateUf.trim().length !== 2) return setErr("UF inválida.");

    setSaving(true);
    try {
      await setDoc(
        ref,
        {
          uid,
          email: email ?? null,
          name: displayName.trim(),
          phone: phone ? onlyDigits(phone) : null,
          taxId: onlyDigits(taxId),
          address: {
            zip: onlyDigits(zip),
            street: street.trim(),
            number: number.trim(),
            complement: complement.trim() || null,
            district: district.trim() || null,
            city: city.trim(),
            state: stateUf.trim().toUpperCase(),
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // mantém o displayName do auth alinhado
      if (getAuth().currentUser && getAuth().currentUser!.displayName !== displayName.trim()) {
        await updateProfile(getAuth().currentUser!, { displayName: displayName.trim() });
      }

      setMsg("Dados salvos com sucesso!");
    } catch (e: any) {
      setErr(e?.message || "Não foi possível salvar seus dados.");
    } finally {
      setSaving(false);
    }
  }

  if (!uid) {
    return (
      <div className="rounded-lg border p-4 bg-white">
        <p className="text-slate-600">Você precisa estar autenticado para ver seu perfil.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <h1 className="text-xl font-semibold">Meu perfil</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Nome completo</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">E-mail</span>
          <input className="w-full rounded-lg border px-3 py-2 bg-zinc-100" value={email ?? ""} disabled />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Telefone (com DDD)</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="(11) 98765-4321"
            value={phone}
            onChange={(e) => setPhone(maskPhoneBR(e.target.value))}
            disabled={loading}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">CPF/CNPJ</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            value={taxId}
            onChange={(e) => setTaxId(maskCpfCnpj(e.target.value))}
            disabled={loading}
            required
          />
        </label>
      </div>

      <h2 className="font-semibold mt-2">Endereço</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">CEP</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="00000-000"
            value={zip}
            onChange={(e) => setZip(maskCep(e.target.value))}
            disabled={loading}
            required
          />
        </label>
        <label className="sm:col-span-2 space-y-1">
          <span className="text-sm text-zinc-600">Rua</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            disabled={loading}
            required
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Número</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            disabled={loading}
            required
          />
        </label>
        <label className="sm:col-span-3 space-y-1">
          <span className="text-sm text-zinc-600">Complemento</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
            disabled={loading}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Bairro</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            disabled={loading}
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Cidade</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={loading}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">UF</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={stateUf}
            maxLength={2}
            onChange={(e) => setStateUf(e.target.value.toUpperCase())}
            disabled={loading}
            required
          />
        </label>
      </div>

      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={saving || loading}
        className={`rounded-xl px-4 py-2 text-white font-medium ${
          saving || loading ? "bg-zinc-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
