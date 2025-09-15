// src/modules/portal/services/filesService.ts
import app, { db, storage } from "../../../firebase/config";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, getMetadata, listAll, ref } from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";

/** Tipo único usado por todo o app */
export type ProjectFile = {
  projectId: string;
  name: string;
  url: string;
  /** usado apenas para ordenação interna (mais recente primeiro) */
  updated?: number;
};

const auth = getAuth(app);

/** Garante um ID token fresco antes de falar com o Storage (evita 401/403 travestidos de CORS) */
async function ensureAuthReadyAndFreshToken(): Promise<void> {
  const u = auth.currentUser;
  if (u) {
    await u.getIdToken(true).catch(() => {});
    return;
  }
  await new Promise<void>((resolve) => {
    const off = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await user.getIdToken(true).catch(() => {});
      }
      off();
      resolve();
    });
  });
}

/**
 * Flag para alternar entre:
 * - OFF (default):  projects/{projectId}/entregaveis/{arquivo}
 * - ON:            portal/{uid}/{projectId}/{arquivo}  (isolado por usuário)
 * ATENÇÃO: ambas as opções estão cobertas pelas suas regras atuais.
 */
const USE_PER_USER = (import.meta.env.VITE_STORAGE_DELIVERIES_BY_UID ?? "0") === "1";

/** Monta o prefixo base no Storage conforme a convenção ativa (alinhado às regras) */
function buildBasePath(projectId: string, userId?: string | null) {
  if (USE_PER_USER) {
    if (!userId) throw new Error("userId obrigatório quando VITE_STORAGE_DELIVERIES_BY_UID=1");
    return `portal/${userId}/${projectId}`;
  }
  return `projects/${projectId}/entregaveis`;
}

/**
 * Lista os arquivos do Storage para um projeto específico.
 * - Se VITE_STORAGE_DELIVERIES_BY_UID=1, exige userId para montar o caminho seguro.
 * - Correção: usar Promise.allSettled para não perder itens válidos quando algum arquivo falhar.
 */
export async function listFilesForProject(
  projectId: string,
  opts?: { userId?: string | null }
): Promise<ProjectFile[]> {
  await ensureAuthReadyAndFreshToken();

  const base = buildBasePath(projectId, opts?.userId ?? null);
  const baseRef = ref(storage, base);

  try {
    const res = await listAll(baseRef);

    // Executa downloads/metadata em paralelo por item,
    // mas não falha o lote todo se um arquivo der erro.
    const settled = await Promise.allSettled(
      res.items.map(async (itemRef) => {
        const [url, meta] = await Promise.all([
          getDownloadURL(itemRef), // se falhar, este item vira 'rejected'
          getMetadata(itemRef).catch(() => undefined),
        ]);

        return {
          projectId,
          name: itemRef.name,
          url,
          updated: meta?.updated ? new Date(meta.updated).getTime() : 0,
        } as ProjectFile;
      })
    );

    const entries = settled
      .filter((r): r is PromiseFulfilledResult<ProjectFile> => r.status === "fulfilled")
      .map((r) => r.value)
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));

    return entries;
  } catch (err) {
    console.warn("[filesService] listFilesForProject falhou:", err);
    return [];
  }
}

/**
 * Retorna todos os arquivos de projetos referentes aos pedidos pagos do usuário.
 * OBS: as regras do Firestore checam dono pelo campo `customerUid`.
 */
export async function getUserFiles(userId: string): Promise<ProjectFile[]> {
  const q = query(
    collection(db, "orders"),
    where("customerUid", "==", userId),
    where("status", "==", "paid")
  );
  const snap = await getDocs(q);

  const projectIds = new Set<string>();
  snap.forEach((d) => {
    const data = d.data() as any;
    if (data?.projectId) projectIds.add(String(data.projectId));
  });

  const lists = await Promise.all(
    Array.from(projectIds).map((pid) => listFilesForProject(pid, { userId }))
  );

  const all = lists.flat();
  all.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  return all;
}

/** Retorna até N arquivos mais recentes do usuário. */
export async function getRecentUserFiles(userId: string, n = 3): Promise<ProjectFile[]> {
  const all = await getUserFiles(userId);
  return all.slice(0, n);
}
