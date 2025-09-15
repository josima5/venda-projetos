import { useEffect, useState } from "react";
import { getAuth, onIdTokenChanged } from "firebase/auth";

/** Retorna o ID token do usuário logado (ou null). */
export function useAuthToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onIdTokenChanged(auth, async (user) => {
      const t = user ? await user.getIdToken() : null;
      setToken(t);
    });
    return () => unsub();
  }, []);

  return token;
}
