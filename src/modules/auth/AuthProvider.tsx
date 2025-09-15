import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  getIdTokenResult,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../firebase/config";

type CompanyDoc = {
  name?: string;
  logoUrl?: string | null;
  [k: string]: any;
};

type ProfileDoc = {
  uid?: string;
  role?: "admin" | "finance" | "sales" | "viewer" | "customer";
  admin?: boolean;
  finance?: boolean;
  sales?: boolean;
  viewer?: boolean;
  active?: boolean;
  [k: string]: any;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isFinance: boolean;
  company: CompanyDoc | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const MASTER_EMAIL = "jaf.contatoeng@gmail.com";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [claims, setClaims] = useState<Record<string, any>>({});
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [company, setCompany] = useState<CompanyDoc | null>(null);

  const [claimsLoaded, setClaimsLoaded] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Observa auth e força refresh das claims
  useEffect(() => {
    const offAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setProfile(null);
      setProfileLoaded(!u);
      try {
        if (u) {
          const tok = await getIdTokenResult(u, true);
          setClaims(tok.claims || {});
        } else {
          setClaims({});
        }
      } catch (e) {
        console.warn("[Auth] getIdTokenResult falhou:", e);
        setClaims({});
      } finally {
        setClaimsLoaded(true);
      }
    });
    return () => offAuth();
  }, []);

  // Fallback de papéis via userProfiles/{uid}
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "userProfiles", user.uid);
    const off = onSnapshot(
      ref,
      (snap) => {
        setProfile((snap.data() as ProfileDoc) || {});
        setProfileLoaded(true);
      },
      (err) => {
        console.warn("[AuthProvider] Falha ao ler userProfiles:", err?.message || err);
        setProfile(null);
        setProfileLoaded(true);
      }
    );
    return () => off();
  }, [user?.uid]);

  // Brand pública
  useEffect(() => {
    const ref = doc(db, "settings", "company");
    const off = onSnapshot(
      ref,
      (snap) => setCompany((snap.data() as CompanyDoc) || null),
      (err) => {
        console.warn("[AuthProvider] Falha ao ler settings/company:", err?.message || err);
        setCompany(null);
      }
    );
    return () => off();
  }, []);

  const effectiveRole = useMemo(() => {
    const claimRole = (claims.role as string) || "";
    const profileRole = (profile?.role as string) || "";
    return claimRole || profileRole || "customer";
  }, [claims.role, profile?.role]);

  const isAdmin = !!(
    (user?.email && user.email === MASTER_EMAIL) ||
    claims.admin === true ||
    effectiveRole === "admin" ||
    profile?.admin === true
  );

  const isFinance = !!(
    claims.finance === true ||
    effectiveRole === "finance" ||
    profile?.finance === true
  );

  const loading = !(claimsLoaded && profileLoaded);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      isAdmin,
      isFinance,
      company,
      async signIn(email: string, password: string) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signOut() {
        await fbSignOut(auth);
      },
      async login(email: string, password: string) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async logout() {
        await fbSignOut(auth);
      },
    }),
    [user, loading, isAdmin, isFinance, company]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider />");
  return ctx;
}
