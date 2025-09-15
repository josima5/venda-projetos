import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import app, { db, auth } from "../../../firebase/config";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { sendSignInLinkToEmail, updateProfile } from "firebase/auth";
import type { ActionCodeSettings } from "firebase/auth";

/* ======================= Tipos ======================= */
export type UserRole = "admin" | "finance" | "sales" | "viewer" | "customer";
export type ModuleKey =
  | "vendas"
  | "financeiro"
  | "fiscal"
  | "clientes"
  | "catalogo"
  | "carrinhos"
  | "auditoria"
  | "relatorios"
  | "config"
  | "organizacao";

export type UserProfile = {
  uid: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  role: UserRole;
  active: boolean;
  modules?: ModuleKey[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedByUid?: string | null;
};

export type CompanyInfo = {
  name: string;
  cnpj?: string;
  address?: string;
  email?: string;
  whatsapp?: string;
  logoUrl?: string; // gs:// ou https
  updatedAt?: Timestamp;
  updatedByUid?: string | null;
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/* ======================= Refs & Defaults ======================= */
const COMPANY_REF = doc(db, "settings", "company");
const USERS_COL = collection(db, "userProfiles");
const INVITES_COL = collection(db, "orgInvites");

const COMPANY_DEFAULTS: CompanyInfo = {
  name: "Sua Empresa",
  cnpj: "",
  address: "",
  email: "",
  whatsapp: "",
  logoUrl: "",
};

/* ======================= Company ======================= */
export function watchCompany(cb: (info: CompanyInfo) => void) {
  return onSnapshot(COMPANY_REF, (snap) => {
    const data = (snap.exists() ? snap.data() : {}) as Partial<CompanyInfo>;
    cb({ ...COMPANY_DEFAULTS, ...data });
  });
}

export async function getCompany(): Promise<CompanyInfo> {
  const snap = await getDoc(COMPANY_REF);
  const data = (snap.exists() ? snap.data() : {}) as Partial<CompanyInfo>;
  return { ...COMPANY_DEFAULTS, ...data };
}

export async function saveCompany(partial: DeepPartial<CompanyInfo>) {
  const uid = auth.currentUser?.uid ?? null;
  await setDoc(
    COMPANY_REF,
    { ...partial, updatedAt: serverTimestamp(), updatedByUid: uid },
    { merge: true }
  );
}

/** Upload de logotipo ao Storage e retorna gs:// + https */
export async function uploadCompanyLogo(
  file: File
): Promise<{ gsUrl: string; httpsUrl: string }> {
  const storage = getStorage(app);
  const bucket = storage.app.options.storageBucket!;
  const path = `branding/company_logo_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  const httpsUrl = await getDownloadURL(ref);
  const gsUrl = `gs://${bucket}/${path}`;
  return { gsUrl, httpsUrl };
}

/* ======================= Users (perfis) ======================= */
export function watchUserProfiles(cb: (rows: UserProfile[]) => void) {
  const q = query(USERS_COL, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const rows: UserProfile[] = [];
    snap.forEach((d) =>
      rows.push({
        uid: d.id,
        role: "customer",
        active: true,
        modules: [],
        ...(d.data() as any),
      })
    );
    cb(rows);
  });
}

export function watchUserProfile(uid: string, cb: (p: UserProfile | null) => void) {
  const ref = doc(USERS_COL, uid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ uid, ...(snap.data() as any) } as UserProfile);
  });
}

export async function saveUserProfile(uid: string, partial: DeepPartial<UserProfile>) {
  const ref = doc(USERS_COL, uid);
  const now = serverTimestamp();
  const snap = await getDoc(ref);

  const data: any = {
    ...partial,
    updatedAt: now,
    updatedByUid: auth.currentUser?.uid ?? null,
  };

  if (!snap.exists()) {
    data.createdAt = now;
    if (data.active === undefined) data.active = true;
    if (data.role === undefined) data.role = "customer";
    if (data.modules === undefined) data.modules = [];
  }

  await setDoc(ref, data, { merge: true });
}

export async function updateSelfProfile(partial: DeepPartial<UserProfile>) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sem usuário autenticado.");
  await saveUserProfile(uid, partial);
}

export async function setUserRole(uid: string, role: UserRole) {
  await updateDoc(doc(USERS_COL, uid), {
    role,
    updatedAt: serverTimestamp(),
    updatedByUid: auth.currentUser?.uid ?? null,
  });
}

export async function setUserActive(uid: string, active: boolean) {
  await updateDoc(doc(USERS_COL, uid), {
    active,
    updatedAt: serverTimestamp(),
    updatedByUid: auth.currentUser?.uid ?? null,
  });
}

export async function setUserModules(uid: string, modules: ModuleKey[]) {
  await updateDoc(doc(USERS_COL, uid), {
    modules,
    updatedAt: serverTimestamp(),
    updatedByUid: auth.currentUser?.uid ?? null,
  });
}

export async function deleteUserProfile(uid: string) {
  await deleteDoc(doc(USERS_COL, uid));
}

/** Upload do avatar do usuário logado e sincroniza photoURL no Auth */
export async function uploadUserAvatar(
  file: File
): Promise<{ gsUrl: string; httpsUrl: string }> {
  const u = auth.currentUser;
  if (!u) throw new Error("Sem usuário autenticado.");

  const storage = getStorage(app);
  const bucket = storage.app.options.storageBucket!;
  const path = `users/${u.uid}/avatar_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const ref = storageRef(storage, path);

  await uploadBytes(ref, file, { contentType: file.type });

  const httpsUrl = await getDownloadURL(ref);
  const gsUrl = `gs://${bucket}/${path}`;

  try {
    await updateProfile(u, { photoURL: httpsUrl });
  } catch (err) {
    console.warn("Falha ao atualizar photoURL no Auth:", err);
  }

  return { gsUrl, httpsUrl };
}

/* ======================= Convites ======================= */
export async function inviteUser(
  email: string,
  role: UserRole,
  modules: ModuleKey[] = []
) {
  const emailNorm = email.toLowerCase().trim();
  if (!emailNorm) throw new Error("E-mail inválido.");

  const action: ActionCodeSettings = {
    url: `${window.location.origin}/finish-signin`,
    handleCodeInApp: true,
  };

  await setDoc(
    doc(INVITES_COL, emailNorm),
    {
      email: emailNorm,
      role,
      modules,
      invitedAt: serverTimestamp(),
      invitedByUid: auth.currentUser?.uid ?? null,
    },
    { merge: true }
  );

  await sendSignInLinkToEmail(auth, emailNorm, action);
}

/* ======================= Utils ======================= */
export function gsToHttps(url?: string) {
  if (!url) return "";
  if (!url.startsWith("gs://")) return url;
  const rest = url.slice(5);
  const i = rest.indexOf("/");
  const bucket = rest.slice(0, i);
  const path = rest.slice(i + 1);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}
