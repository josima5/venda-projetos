import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

type Props = {
  children: JSX.Element;
  /** Quando true, exige e-mail verificado. */
  requireVerified?: boolean;
};

export default function RequireAuth({ children, requireVerified = false }: Props) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const from = loc.pathname + loc.search;

  if (loading) return <div>Carregando…</div>;

  if (!user) {
    return <Navigate to="/signin" state={{ from }} replace />;
  }

  if (requireVerified && !user.emailVerified) {
    return <Navigate to="/verify-email" state={{ from }} replace />;
  }

  return children;
}
