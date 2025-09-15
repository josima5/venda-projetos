import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="p-4 text-sm text-slate-600">Carregando…</div>;
  if (!user) return <Navigate to={`/entrar?to=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return children;
}
