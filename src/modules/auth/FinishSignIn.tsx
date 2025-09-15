// src/modules/auth/FinishSignIn.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { auth } from "../../firebase/config";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { useAuth } from "./AuthProvider";

function mapFirebaseError(code?: string, message?: string) {
  switch (code) {
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return "Este link é inválido ou expirou. Peça um novo link de acesso.";
    case "auth/user-disabled":
      return "Conta desativada. Fale com o suporte.";
    case "auth/network-request-failed":
      return "Falha de rede. Verifique sua conexão e tente de novo.";
    default:
      return message || "Não foi possível concluir o login por link.";
  }
}

export default function FinishSignIn() {
  const { company } = useAuth();
  const brand = useMemo(() => company?.name || "Malta Engenharia", [company]);

  const navigate = useNavigate();
  const loc = useLocation();

  // rota de retorno enviada quando o link foi gerado
  const from = new URLSearchParams(loc.search).get("from") || "/";

  // resgata o e-mail salvo quando o link foi enviado (pré-preenche o campo)
  const [email, setEmail] = useState<string>(() => {
    return window.localStorage.getItem("magiclink.email") || "";
  });

  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const href = window.location.href;
    const valid = isSignInWithEmailLink(auth, href);

    if (!valid) {
      setErr("Link inválido. Abra o link diretamente do e-mail recebido.");
      setLoading(false);
      return;
    }

    // Se o link é válido e já temos e-mail salvo, tentamos concluir automaticamente.
    if (!email) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        await signInWithEmailLink(auth, email, href);
        window.localStorage.removeItem("magiclink.email");
        setDone(true);
        navigate(from || "/", { replace: true });
      } catch (e: any) {
        setErr(mapFirebaseError(e?.code, e?.message));
      } finally {
        setLoading(false);
      }
    })();
    // dep. em `email` é intencional: só tenta automático quando ele existir/alterar
  }, [email, from, navigate]);

  async function onConfirmEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) {
      setErr("Link inválido. Abra o link diretamente do e-mail recebido.");
      return;
    }

    if (!email.trim()) {
      setErr("Informe seu e-mail para concluir o acesso.");
      return;
    }

    try {
      setConfirming(true);
      await signInWithEmailLink(auth, email.trim(), href);
      window.localStorage.removeItem("magiclink.email");
      setDone(true);
      navigate(from || "/", { replace: true });
    } catch (e: any) {
      setErr(mapFirebaseError(e?.code, e?.message));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-6">
        <div className="mb-4 flex items-center gap-3">
          <img
            src="/Malta_logo.svg"
            alt={brand}
            className="h-8 w-auto"
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/malta_logo.svg")}
          />
          <div>
            <h1 className="text-lg font-semibold">Concluir acesso</h1>
            <p className="text-xs text-slate-500">Entrar com link por e-mail</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border p-4 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            <span className="text-slate-600">Validando link…</span>
          </div>
        ) : done ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
            <MailCheck className="h-4 w-4 text-emerald-700" />
            <span className="text-emerald-700 text-sm">Login concluído com sucesso!</span>
          </div>
        ) : (
          <>
            {err && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            {!email && (
              <p className="text-sm text-slate-600 mb-3">
                Confirme o e-mail utilizado para solicitar o link de acesso.
              </p>
            )}

            <form onSubmit={onConfirmEmail} className="space-y-3">
              <label className="block">
                <span className="block text-sm text-slate-600 mb-1">E-mail</span>
                <input
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-lg border px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={confirming}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white font-medium ${
                  confirming ? "bg-zinc-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  <>Concluir login</>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/signin" className="text-xs text-slate-500 hover:underline">
                Voltar ao login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
