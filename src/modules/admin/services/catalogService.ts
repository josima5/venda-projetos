import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  getFirestore,
} from "firebase/firestore";
import { getApp } from "firebase/app";
import { getDownloadURL, getStorage, ref as sref, uploadBytes } from "firebase/storage";

const db = getFirestore(getApp());
const storage = getStorage(getApp());

export type AddonSpec = { id: string; label: string; price: number; active?: boolean };
export type Setbacks = { front?: number | null; back?: number | null; left?: number | null; right?: number | null };

export type ProjectDoc = {
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  price: number;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  lotWidth?: number | null;
  lotLength?: number | null;
  houseWidth?: number | null;
  houseLength?: number | null;
  setbacks?: Setbacks;
  active: boolean;
  order?: number | null;
  tags?: string[];
  features?: string[];
  mainImageUrl?: string | null;
  galleryUrls?: string[];
  addons?: AddonSpec[];
  createdAt?: any;
  updatedAt?: any;
};

export type UpsertProject = Partial<Omit<ProjectDoc, "id">> & { id?: string };

export function randomId(len = 8) {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
}
export function generateProjectCode() {
  const year = new Date().getFullYear();
  return `PRJ-${year}-${randomId(5).toUpperCase()}`;
}

export function watchProjects(cb: (rows: ProjectDoc[]) => void): () => void {
  const qy = query(collection(db, "projects"), orderBy("order", "asc"), orderBy("title", "asc"));
  return onSnapshot(qy, (snap) => {
    const rows: ProjectDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    cb(rows);
  });
}

export async function upsertProject(p: UpsertProject): Promise<string> {
  const cleanAddons =
    Array.isArray(p.addons)
      ? p.addons
          .map((a) => ({
            id: a.id || randomId(),
            label: String(a.label ?? "").trim(),
            price: Number(a.price ?? 0),
            active: a.active !== false,
          }))
          .filter((a) => !!a.label)
      : [];

  const payload: any = {
    code: p.code ? String(p.code).trim() : null,
    title: String(p.title ?? "").trim(),
    description: p.description ?? null,
    price: Number(p.price ?? 0),
    area: p.area == null ? null : Number(p.area),
    bedrooms: p.bedrooms == null ? null : Number(p.bedrooms),
    bathrooms: p.bathrooms == null ? null : Number(p.bathrooms),
    lotWidth: p.lotWidth == null ? null : Number(p.lotWidth),
    lotLength: p.lotLength == null ? null : Number(p.lotLength),
    houseWidth: p.houseWidth == null ? null : Number(p.houseWidth),
    houseLength: p.houseLength == null ? null : Number(p.houseLength),
    setbacks: {
      front: p.setbacks?.front == null ? null : Number(p.setbacks?.front),
      back: p.setbacks?.back == null ? null : Number(p.setbacks?.back),
      left: p.setbacks?.left == null ? null : Number(p.setbacks?.left),
      right: p.setbacks?.right == null ? null : Number(p.setbacks?.right),
    },
    active: Boolean(p.active ?? true),
    order: typeof p.order === "number" ? p.order : null,
    mainImageUrl: p.mainImageUrl ?? null,
    galleryUrls: Array.isArray(p.galleryUrls) ? p.galleryUrls.filter(Boolean) : [],
    tags:
      Array.isArray(p.tags)
        ? p.tags.map((t) => String(t).trim()).filter(Boolean)
        : typeof p.tags === "string"
        ? String(p.tags).split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    features: Array.isArray(p.features) ? p.features.map((t) => String(t).trim()).filter(Boolean) : [],
    addons: cleanAddons,
    updatedAt: serverTimestamp(),
  };

  if (p.id) {
    await setDoc(doc(db, "projects", p.id), payload, { merge: true });
    return p.id;
  } else {
    const ref = await addDoc(collection(db, "projects"), { ...payload, createdAt: serverTimestamp() });
    return ref.id;
  }
}

export async function upsertProjectWithUploads(
  p: UpsertProject & { coverFile?: File | null; galleryFiles?: File[] | null }
): Promise<string> {
  const id = await upsertProject(p);
  let coverUrl: string | null = null;
  const galUrls: string[] = [];

  if (p.coverFile) {
    const r = sref(storage, `catalogo/projects/${id}/cover_${Date.now()}_${p.coverFile.name}`);
    await uploadBytes(r, p.coverFile);
    coverUrl = await getDownloadURL(r);
  }

  if (p.galleryFiles?.length) {
    for (const file of p.galleryFiles) {
      const r = sref(storage, `catalogo/projects/${id}/gallery_${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      galUrls.push(await getDownloadURL(r));
    }
  }

  if (coverUrl || galUrls.length) {
    await setDoc(
      doc(db, "projects", id),
      {
        ...(coverUrl ? { mainImageUrl: coverUrl } : {}),
        ...(galUrls.length ? { galleryUrls: (p.galleryUrls || []).concat(galUrls) } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return id;
}

export async function deleteProject(id: string) {
  await deleteDoc(doc(db, "projects", id));
}
