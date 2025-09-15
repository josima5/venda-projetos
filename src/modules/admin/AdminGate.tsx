import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import app, { db } from "../../firebase/config";

type Props = { children: ReactNode; allowFinanceAlso?: boolean };

type ProfileDoc = {
  role?: "admin" | "finance" | "sales" | "viewer" | "customer";
  admin?: boolean;
  finance?: boolean;
  sales?: boolean;
  viewer?: boolean;
};

export default function AdminGate({ children, allowFinanceAlso = true }: Props) {
  const auth = useMemo(() => getAuth(app), []);
  const location = useLocation();
  const [state, setState] = useState<{
    loading: boolean;
    user: User | null;
    allowed: boolean;
  }>({ loading: true, user: null, allowed: false });

  useEffect(() => {
    let offProfile: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        offProfile?.();
        setState({ loading: false, user: null, allowed: false });
        return;
      }

      let claims: Record<string, any> = {};
      try {
        const token = await user.getIdTokenResult(true);
        claims = token.claims || {};
      } catch {
        // ignora; tentaremos fallback por perfil
      }

      offProfile?.();
      offProfile = onSnapshot(
        doc(db, "userProfiles", user.uid),
        (snap) => {
          const profile = (snap.data() as ProfileDoc) || null;

          const isAdmin =
            claims.role === "admin" ||
            claims.admin === true ||
            profile?.role === "admin" ||
            profile?.admin === true;

          const isFinance =
            claims.role === "finance" ||
            claims.finance === true ||
            profile?.role === "finance" ||
            profile?.finance === true;

          const allowed = isAdmin || (allowFinanceAlso && isFinance);
          setState({ loading: false, user, allowed });
        },
        () => {
          const isAdmin = claims.role === "admin" || claims.admin === true;
          const isFinance = claims.role === "finance" || claims.finance === true;
          const allowed = isAdmin || (allowFinanceAlso && isFinance);
          setState({ loading: false, user, allowed });
        }
      );
    });

    return () => {
      unsub();
      offProfile?.();
    };
  }, [auth, allowFinanceAlso]);

  if (state.loading) {
    return (
      <div className="min-h-[60vh] grid place-content-center text-slate-500">
        <div className="animate-pulse">Carregando…</div>
      </div>
    );
  }

  if (!state.user) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  if (!state.allowed) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-slate-800">Acesso negado</h1>
        <p className="mt-2 text-slate-600">
          Sua conta não possui permissão para acessar o painel administrativo.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
