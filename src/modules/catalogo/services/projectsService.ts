/* Serviço central de projetos (Firestore + Storage) */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
  updateDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
  getStorage,
} from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";

import app, { db } from "../../../firebase/config";
import type { ProjectBase, ProjectDoc } from "../types";

/* ========================= Helpers ========================= */
function mapDoc(d: any): ProjectDoc {
  const raw = d.data() as any;
  const data = raw as Partial<ProjectBase>;

  return {
    id: d.id,
    title: data?.title ?? "",
    area: Number(data?.area ?? 0),
    bedrooms: Number(data?.bedrooms ?? 0),
    bathrooms: Number(data?.bathrooms ?? 0),
    price: Number(data?.price ?? 0),
    lotWidth: Number(data?.lotWidth ?? 0),
    lotLength: Number(data?.lotLength ?? 0),
    tags: Array.isArray(data?.tags) ? (data!.tags as string[]) : [],
    description: data?.description ?? "",
    addons: Array.isArray(data?.addons) ? (data!.addons as any[]) : [],
    mainImageUrl: data?.mainImageUrl ?? "",
    galleryUrls: Array.isArray(data?.galleryUrls) ? (data!.galleryUrls as string[]) : [],
    images: Array.isArray(data?.images) ? (data!.images as any[]) : undefined,
    createdAt: raw?.createdAt,
  };
}

/** Garante que existe um usuário autenticado (anônimo ok) */
async function ensureAuth() {
  const auth = getAuth(app);
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch {
      // regras do Firebase cuidarão das permissões
    }
  }
}

// Storage instance
const storage = getStorage(app);

/* ========================= Exports ========================= */
export function watchProjects(cb: (items: ProjectDoc[]) => void): Unsubscribe {
  const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(mapDoc)));
}

export async function getProject(id: string): Promise<ProjectDoc | null> {
  const refDoc = doc(db, "projects", id);
  const snap = await getDoc(refDoc);
  return snap.exists() ? mapDoc(snap) : null;
}

export async function createProject(input: {
  data: ProjectBase;
  coverFile?: File | null;
  galleryFiles?: File[] | null;
}): Promise<string> {
  await ensureAuth();

  const { data, coverFile, galleryFiles } = input;
  const col = collection(db, "projects");
  const refDoc = await addDoc(col, {
    title: data.title,
    area: data.area,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    price: data.price,
    lotWidth: data.lotWidth,
    lotLength: data.lotLength,
    tags: data.tags ?? [],
    description: data.description ?? "",
    addons: data.addons ?? [],
    mainImageUrl: "",
    galleryUrls: [],
    createdAt: serverTimestamp(),
  });

  let mainUrl = "";
  const galUrls: string[] = [];

  try {
    if (coverFile) {
      const p = `catalogo/projects/${refDoc.id}/cover_${Date.now()}_${coverFile.name}`;
      const sref = ref(storage, p);
      await uploadBytes(sref, coverFile);
      mainUrl = await getDownloadURL(sref);
    }

    if (galleryFiles?.length) {
      for (const file of galleryFiles) {
        const p = `catalogo/projects/${refDoc.id}/gallery_${Date.now()}_${file.name}`;
        const sref = ref(storage, p);
        await uploadBytes(sref, file);
        const url = await getDownloadURL(sref);
        galUrls.push(url);
      }
    }
  } catch (err) {
    throw err;
  }

  if (mainUrl || galUrls.length) {
    await updateDoc(refDoc, {
      ...(mainUrl ? { mainImageUrl: mainUrl } : {}),
      ...(galUrls.length ? { galleryUrls: galUrls } : {}),
    });
  }

  return refDoc.id;
}

export async function removeProject(id: string): Promise<void> {
  await deleteDoc(doc(db, "projects", id));
}
