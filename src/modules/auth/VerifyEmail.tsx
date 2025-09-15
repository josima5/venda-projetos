import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { auth } from "../../firebase/config";
import { sendEmailVerification, reload } from "firebase/auth";
import { useAuth } from "./AuthProvider";

export default function VerifyEmail() {
  const { user, company } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as any;
  const from: string = typeof loc?.state?.from === "string" ? loc.state.from : "/";
  const brand = useMemo(() => company?.name || "Malta Engenharia", [company]);

  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const intervalRef = useRef<number | null>(null);

  // Se não estiver logado, volta ao login
  useEffect(() => {
    if (!user) navigate("/signin", { replace: true, state: { from } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Loop de auto-refresh até verificar
  useEffect(() => {
    if (!user) return;
    // se já vem verificado, só redireciona
    if (user.emailVerified) {
      navigate(from || "/", { replace: true });
      return;
    }
    const tick = async () => {
      if (!auth.currentUser) return;
      setChecking(true);
      try {
        await reload(auth.currentUser);
        if (auth.currentUser.emailVerified) {
          navigate(from || "/", { replace: true });
        }
      } catch {
        // silencioso
      } finally {
        setChecking(false);
      }
    };
    // checa a cada 6s
    intervalRef.current = window.setInterval(tick, 6000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, from]);

  async function onResend() {
    setErr(null);
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || "Não foi possível reenviar o e-mail de verificação.");
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
            <h1 className="text-lg font-semibold">Verifique seu e-mail</h1>
            <p className="text-xs text-slate-500">Precisamos confirmar sua conta antes de continuar.</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-3">
          Enviamos um link de verificação para <strong>{user?.email}</strong>. Assim que você
          confirmar, esta tela será atualizada automaticamente.
        </p>

        {err && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResend}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
          >
            <Mail className="w-4 h-4" />
            Reenviar verificação
          </button>
          <button
            type="button"
            onClick={async () => {
              setChecking(true);
              try {
                if (auth.currentUser) await reload(auth.currentUser);
                if (auth.currentUser?.emailVerified) navigate(from || "/", { replace: true });
              } finally {
                setChecking(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            Atualizar agora
          </button>
        </div>

        {sent && (
          <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
            Reenviamos o e-mail de verificação. Confira sua caixa de entrada.
          </p>
        )}

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-slate-500 hover:underline">
            Voltar ao site
          </Link>
        </div>

        {checking && (
          <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verificando status…
          </div>
        )}
      </div>
    </div>
  );
}
