import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  type User,
  type ActionCodeSettings,
} from "firebase/auth";
import { auth } from "../../firebase/config";

import {
  doc,
  getDoc,
  onSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config";

import { ensureSelfProfile } from "../config/services/orgService";
import type {
  CompanyInfo,
  UserProfile,
  UserRole,
  ModuleKey,
} from "../config/services/orgService";

const MASTER_ADMIN_EMAIL = "jaf.contatoeng@gmail.com";
const ALL_MODULES: ModuleKey[] = [
  "vendas",
  "financeiro",
  "fiscal",
  "clientes",
  "catalogo",
  "carrinhos",
  "auditoria",
  "relatorios",
  "config",
  "organizacao",
];

export type AuthState = {
  loading: boolean;
  user: User | null;
  email?: string | null;
  isAdmin: boolean;
  role?: UserRole;
  active?: boolean;
  modules?: ModuleKey[];
  profile?: (UserProfile & { createdAt?: Timestamp; updatedAt?: Timestamp }) | null;
  company?: CompanyInfo | null;
  error?: string | null;
};

export async function loginEmailPassword(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}
export async function logout() {
  await signOut(auth);
}
export async function sendResetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}
export async function sendMagicLink(email: string) {
  const action: ActionCodeSettings = {
    url: `${window.location.origin}/finish-signin`,
    handleCodeInApp: true,
  };
  const { sendSignInLinkToEmail } = await import("firebase/auth");
  await sendSignInLinkToEmail(auth, email, action);
  window.localStorage.setItem("emailForSignIn", email);
}
export async function finishSignInWithEmailLinkIfNeeded(url?: string) {
  const href = url ?? window.location.href;
  if (!isSignInWithEmailLink(auth, href)) return false;
  let email = window.localStorage.getItem("emailForSignIn") || "";
  if (!email) {
    email = window.prompt("Confirme seu e-mail para concluir o login:") || "";
  }
  await signInWithEmailLink(auth, email, href);
  window.localStorage.removeItem("emailForSignIn");
  return true;
}

export function observeAuth(
  callback: (value: AuthState | ((prev: AuthState) => AuthState)) => void
) {
  callback({
    loading: true,
    user: null,
    isAdmin: false,
    email: undefined,
    profile: null,
    modules: [],
    company: null,
    error: null,
  });

  const offCompany = onSnapshot(doc(db, "settings", "company"), (snap) => {
    const company = (snap.exists() ? (snap.data() as CompanyInfo) : null) ?? null;
    callback((prev) => ({ ...prev, company }));
  });

  const unsub = onIdTokenChanged(auth, async (user) => {
    if (!user) {
      callback({
        loading: false,
        user: null,
        isAdmin: false,
        email: undefined,
        profile: null,
        modules: [],
        company: undefined,
        error: null,
      });
      return;
    }

    try {
      await ensureSelfProfile();
      const tokenRes = await getIdTokenResult(user, true);
      const claimRole = (tokenRes.claims["role"] as string | undefined) ?? undefined;

      const profSnap = await getDoc(doc(db, "userProfiles", user.uid));
      const prof = (profSnap.exists() ? (profSnap.data() as UserProfile) : null) ?? null;

      const emailLower = (user.email || "").toLowerCase();
      const isMaster = emailLower === MASTER_ADMIN_EMAIL.toLowerCase();

      const role: UserRole | undefined =
        (prof?.role as UserRole | undefined) ?? (claimRole as UserRole | undefined);
      const isAdmin = isMaster || role === "admin";

      const active = prof?.active ?? true;
      const modules: ModuleKey[] = isMaster ? ALL_MODULES : (prof?.modules ?? []);

      callback({
        loading: false,
        user,
        email: user.email,
        isAdmin,
        role,
        active,
        modules,
        profile: prof,
        company: undefined,
        error: null,
      });
    } catch (e: any) {
      callback({
        loading: false,
        user,
        email: user?.email,
        isAdmin: false,
        profile: null,
        modules: [],
        company: undefined,
        error: e?.message || "Falha ao carregar sessão.",
      });
    }
  });

  return () => {
    unsub();
    offCompany();
  };
}
