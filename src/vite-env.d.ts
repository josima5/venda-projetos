/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string; // ex.: <project-id>.firebasestorage.app
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;

  readonly VITE_CF_BASE?: string;
  readonly VITE_CF_REGION?: string;
  readonly VITE_CREATE_MP_URL?: string;
  readonly VITE_FRONTEND_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
