import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAuth, onAuthStateChanged, signOut, type User } from "firebase/auth";

/**
 * AuthContext + useAuth
 * - Encapsula o estado do usuário Firebase Auth e ação de logout.
 * - Não depende de alias de path; use import relativo a partir de src/.
 */

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = getAuth();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async logout() {
        await signOut(auth);
      },
    }),
    [user, loading, auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider />");
  return ctx;
}
