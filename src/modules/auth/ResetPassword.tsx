import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase/config";
import { useAuth } from "./AuthProvider";

export default function ResetPassword() {
  const { company } = useAuth();
  const brand = useMemo(() => company?.name || "Malta Engenharia", [company]);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSending(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/#/signin`,
        handleCodeInApp: false,
      });
      setMsg("Enviamos instruções de redefinição de senha para o seu e-mail.");
    } catch (e: any) {
      setErr(e?.message || "Não foi possível enviar o e-mail agora.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-6">
        <div className="mb-4 flex items-center gap-3">
          <img
            src="/Malta_logo.svg"
            alt={brand}
            className="h-8 w-auto"
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/malta_logo.svg")}
          />
          <div>
            <h1 className="text-lg font-semibold">Redefinir senha</h1>
            <p className="text-xs text-slate-500">Informe o e-mail da sua conta</p>
          </div>
        </div>

        <label className="block mb-3">
          <span className="block text-sm text-slate-600 mb-1">E-mail</span>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        {msg && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {msg}
          </div>
        )}
        {err && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white font-medium ${
            sending ? "bg-zinc-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Enviar instruções
            </>
          )}
        </button>

        <div className="mt-6 text-center">
          <Link to="/signin" className="text-xs text-slate-500 hover:underline">
            Voltar ao login
          </Link>
        </div>
      </form>
    </div>
  );
}
