// Inicialização central do Admin SDK (uma única vez)
import { initializeApp, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp(); // GCF usa ADC por padrão
}

// Reexporta utilidades para o restante do código
export * from "firebase-admin/app";
export * from "firebase-admin/firestore";
export * from "firebase-admin/auth";
