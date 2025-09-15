import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, LogIn, Mail } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { auth } from "../../firebase/config";
import { sendSignInLinkToEmail } from "firebase/auth";

function mapFirebaseError(code?: string, message?: string) {
  switch (code) {
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/missing-password":
      return "Informe a senha.";
    case "auth/user-disabled":
      return "Conta desativada. Fale com o suporte.";
    case "auth/user-not-found":
      return "Não encontramos uma conta com este e-mail.";
    case "auth/wrong-password":
      return "Senha incorreta. Tente novamente.";
    case "auth/too-many-requests":
      return "Muitas tentativas de login. Tente novamente em alguns minutos.";
    case "auth/network-request-failed":
      return "Falha de rede. Verifique sua conexão e tente de novo.";
    default:
      return message || "Não foi possível entrar. Tente novamente.";
  }
}

export default function SignIn() {
  const { signIn, company } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as any;

  // rota de retorno (ex.: /checkout/123)
  const from: string = typeof loc?.state?.from === "string" ? loc.state.from : "/";

  const brand = useMemo(() => company?.name || "Malta Engenharia", [company]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // estados do link mágico
  const [sendingLink, setSendingLink] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      const verified = !!auth.currentUser?.emailVerified;
      if (!verified) {
        navigate("/verify-email", { replace: true, state: { from } });
      } else {
        navigate(from || "/", { replace: true });
      }
    } catch (e: any) {
      setErr(mapFirebaseError(e?.code, e?.message));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSendMagicLink() {
    setErr(null);
    setLinkMsg(null);
    const targetEmail = email.trim();

    if (!targetEmail) {
      setErr("Informe seu e-mail para enviarmos o link de acesso.");
      return;
    }
    setSendingLink(true);
    try {
      const url = `${window.location.origin}/#/finish-signin?from=${encodeURIComponent(
        from || "/"
      )}`;

      await sendSignInLinkToEmail(auth, targetEmail, {
        url,
        handleCodeInApp: true,
      });

      // guarda o e-mail para resgatar no /finish-signin
      window.localStorage.setItem("magiclink.email", targetEmail);

      setLinkMsg(
        "Enviamos um link de acesso para o seu e-mail. Abra o e-mail neste dispositivo."
      );
    } catch (e: any) {
      setErr(mapFirebaseError(e?.code, e?.message));
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-6"
      >
        <div className="mb-4 flex items-center gap-3">
          <img
            src="/Malta_logo.svg"
            alt={brand}
            className="h-8 w-auto"
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).src = "/malta_logo.svg")
            }
          />
          <div>
            <h1 className="text-lg font-semibold">Entrar</h1>
            <p className="text-xs text-slate-500">
              Acesse sua conta na {brand}
            </p>
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

        <label className="block mb-1">
          <span className="block text-sm text-slate-600 mb-1">Senha</span>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              className="w-full rounded-lg border px-3 py-2 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
              aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>

        <div className="mb-3 text-right">
          <Link to="/reset" className="text-sm text-indigo-600 hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        {err && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}
        {linkMsg && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {linkMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white font-medium ${
            submitting
              ? "bg-zinc-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Entrando…
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Entrar
            </>
          )}
        </button>

        {/* Divider */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Botão: link mágico */}
        <button
          type="button"
          disabled={sendingLink}
          onClick={onSendMagicLink}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium border ${
            sendingLink
              ? "text-slate-400 border-slate-200 cursor-not-allowed"
              : "text-slate-800 hover:bg-slate-50"
          }`}
        >
          {sendingLink ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando link…
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Entrar com link por e-mail
            </>
          )}
        </button>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-600">Não tem conta?</span>
          <Link
            to="/signup"
            state={{ from }}
            className="text-indigo-600 font-medium hover:underline"
          >
            Criar conta
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-slate-500 hover:underline">
            Voltar ao site
          </Link>
        </div>
      </form>
    </div>
  );
}
