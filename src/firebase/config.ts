// src/firebase/config.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/** Lê as variáveis do .env e valida o mínimo necessário */
function readFirebaseEnv() {
  const cfg = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    // use o NOME EXATO do bucket que aparece no console (ex.: <project-id>.firebasestorage.app)
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // opcional
  };

  const missing = Object.entries(cfg)
    .filter(([k, v]) => !v && k !== "measurementId")
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(`[Firebase] Variáveis ausentes: ${missing.join(", ")}.`);
  }
  return cfg as Required<typeof cfg>;
}

/** Garante que o storageBucket esteja no formato somente host (sem gs:// ou https://) */
function normalizeBucketHost(b: string) {
  return b
    .replace(/^gs:\/\//i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*/g, ""); // remove qualquer path que venha por engano
}

const env = readFirebaseEnv();
const bucketHost = normalizeBucketHost(env.storageBucket);

/** Reaproveita o app se já existir (evita duplicação em dev/HMR) */
const app = getApps().length ? getApps()[0] : initializeApp(env);

/** Exports globais */
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Storage amarrado explicitamente ao bucket informado no .env.
 * Evita 404 "Not Found" por bucket incorreto ou default errado.
 */
export const storage = getStorage(app, `gs://${bucketHost}`);

export default app;
