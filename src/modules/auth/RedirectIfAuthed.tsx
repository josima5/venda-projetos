// src/modules/auth/RedirectIfAuthed.tsx
import type { ReactNode } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

type Props = { children: ReactNode };

export default function RedirectIfAuthed({ children }: Props) {
  const { user } = useAuth();
  const loc = useLocation() as any;
  const from: string =
    typeof loc?.state?.from === "string" ? (loc.state.from as string) : "/";

  // Se já está logado, manda direto pro destino (ou home)
  if (user) return <Navigate to={from || "/"} replace />;

  return <>{children}</>;
}
