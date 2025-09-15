// src/modules/auth/SignUp.tsx
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "./AuthProvider";
import { auth } from "../../firebase/config";
import { db } from "../../firebase/config";

function mapFirebaseError(code?: string, message?: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Este e-mail já está em uso.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/weak-password":
      return "A senha deve ter pelo menos 6 caracteres.";
    case "auth/operation-not-allowed":
      return "Cadastro desabilitado no projeto. Fale com o suporte.";
    case "auth/network-request-failed":
      return "Falha de rede. Verifique sua conexão e tente novamente.";
    default:
      return message || "Não foi possível criar a conta. Tente novamente.";
  }
}

export default function SignUp() {
  const { company } = useAuth();
  const brand = useMemo(() => company?.name || "Malta Engenharia", [company]);

  const loc = useLocation() as any;
  const from: string = typeof loc?.state?.from === "string" ? loc.state.from : "/";

  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) return setErr("Informe seu nome completo.");
    if (pwd.length < 6) return setErr("A senha deve ter pelo menos 6 caracteres.");
    if (pwd !== pwd2) return setErr("As senhas não conferem.");

    try {
      setSubmitting(true);

      // 1) cria o usuário
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, pwd);

      // 2) atualiza o displayName
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmedName });
      }

      // 3) cria o perfil básico (compatível com as regras do Firestore)
      await setDoc(
        doc(db, "userProfiles", cred.user.uid),
        {
          uid: cred.user.uid,
          name: trimmedName,
          email: trimmedEmail,
          phone: null,
          photoUrl: cred.user.photoURL || null,
          role: "viewer",
          modules: [],
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedByUid: cred.user.uid,
        },
        { merge: true }
      );

      // 4) envia verificação e direciona
      await sendEmailVerification(cred.user);
      setMsg("Conta criada! Enviamos um e-mail para verificação.");
      navigate("/verify-email", { replace: true, state: { from } });
    } catch (e: any) {
      setErr(mapFirebaseError(e?.code, e?.message));
    } finally {
      setSubmitting(false);
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
            <h1 className="text-lg font-semibold">Criar conta</h1>
            <p className="text-xs text-slate-500">Cadastre-se para acessar a {brand}</p>
          </div>
        </div>

        <label className="block mb-3">
          <span className="block text-sm text-slate-600 mb-1">Nome completo</span>
          <input
            type="text"
            className="w-full rounded-lg border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

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

        <label className="block mb-3">
          <span className="block text-sm text-slate-600 mb-1">Senha</span>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2 pr-10"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
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

        <label className="block mb-1">
          <span className="block text-sm text-slate-600 mb-1">Confirmar senha</span>
          <div className="relative">
            <input
              type={showPwd2 ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2 pr-10"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPwd2((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
              aria-label={showPwd2 ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPwd2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>

        {err && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}
        {msg && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {msg}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white font-medium ${
            submitting ? "bg-zinc-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Criando conta…
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Criar conta
            </>
          )}
        </button>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-600">Já tem conta?</span>
          <Link to="/signin" state={{ from }} className="text-indigo-600 font-medium hover:underline">
            Entrar
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
