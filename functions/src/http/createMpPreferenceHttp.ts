import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import type { Request, Response } from "express";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// todas as functions desta file na mesma região
setGlobalOptions({ region: "southamerica-east1" });

/* ===================== C O R S ===================== */
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,                           // ex.: https://vendasprojetos.maltaeng1.com.br
  "https://vendasprojetos.maltaeng1.com.br",
  "http://localhost:5173",
].filter(Boolean) as string[];

/**
 * Aplica CORS e trata preflight (OPTIONS).
 * Retorna true se já respondeu (preflight), false para seguir o fluxo normal.
 */
function applyCors(req: Request, res: Response): boolean {
  const origin = (req.headers.origin as string) || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // Se preferir bloquear origens desconhecidas, troque por 403.
    // res.status(403).send("Origin not allowed");
    // return true;
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  // Garante comportamento correto de caches/CDN com Vary
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}
/* =================================================== */

/** Tipos do payload (frontend) */
type PaymentMethod = "pix" | "card" | "boleto";
type Address = {
  zip: string;        // CEP (só dígitos)
  street: string;
  number: string;
  complement?: string;
  district?: string;  // bairro
  city: string;
  state: string;      // UF
};
type CreatePrefPayload = {
  projectId: string;
  addons: { id: string; label: string; price: number }[];
  customer: {
    name: string;
    email: string;
    phone?: string;
    taxId?: string;         // CPF/CNPJ (só dígitos)
    address?: Address|null; // opcional
  };
  payment: { method: PaymentMethod; installments: number };
};

/** ID determinístico do cliente (email > phone) */
function customerIdFrom(email?: string, phone?: string): string | null {
  const e = (email ?? "").trim().toLowerCase();
  const p = (phone ?? "").replace(/\D/g, "");
  if (e) return `email:${e}`;
  if (p) return `phone:${p}`;
  return null;
}

/** Upsert no /customers com os campos permitidos/úteis */
async function upsertCustomerFromPayload(payload: CreatePrefPayload): Promise<string | null> {
  const cid = customerIdFrom(payload.customer?.email, payload.customer?.phone);
  if (!cid) return null;

  await db.doc(`customers/${cid}`).set(
    {
      name:  payload.customer?.name ?? "",
      email: payload.customer?.email ?? "",
      phone: (payload.customer?.phone ?? "").replace(/\D/g, "") || null,
      taxId: (payload.customer?.taxId ?? "").replace(/\D/g, "") || null,
      address: payload.customer?.address ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return cid;
}

/**
 * Handler HTTP do checkout.
 * Mantenha aqui o SEU fluxo de Mercado Pago (criação da preferência),
 * e a criação do pedido em /orders. Depois, chamamos o upsert de cliente.
 */
export const createMpPreferenceHttp = onRequest(async (req: Request, res: Response): Promise<void> => {
  try {
    // CORS + preflight
    if (applyCors(req, res)) return;

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const payload = req.body as CreatePrefPayload;

    // ------------------------------------------------------------------
    // 1) SEU CÓDIGO: criar preferência no Mercado Pago
    // const { init_point, preferenceId } = await createPreferenceInMP(payload);
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // 2) SEU CÓDIGO: criar pedido em /orders (exemplo ilustrativo)
    //    Recomendado salvar também o customerId calculado.
    const cid = customerIdFrom(payload.customer?.email, payload.customer?.phone);

    const orderDoc = {
      projectId: payload.projectId,
      customer: {
        name: payload.customer.name,
        email: payload.customer.email,
        phone: (payload.customer.phone ?? "").replace(/\D/g, "") || null,
      },
      customerId: cid ?? null,
      addons: payload.addons ?? [],
      total: Number(
        (payload.addons ?? []).reduce((acc, a) => acc + (Number(a.price) || 0), 0)
      ), // ajuste conforme sua regra
      status: "pending",
      payment: {
        method: payload.payment.method,
        installments: payload.payment.method === "card" ? payload.payment.installments : 1,
        gateway: "mercadopago",
        // init_point, preferenceId
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Se você já cria em outro lugar, mantenha o seu código e apenas
    // garanta o upsert do cliente logo após.
    const orderRef = await db.collection("orders").add(orderDoc);
    // ------------------------------------------------------------------

    // 3) Garante /customers/{cid}
    const ensuredCustomerId = await upsertCustomerFromPayload(payload);

    // 4) Resposta como o frontend espera (ajuste conforme seu app)
    res.json({
      orderId: orderRef.id,
      // init_point,
      // preferenceId,
      customerId: ensuredCustomerId,
      ok: true,
    });
    return;
  } catch (err: any) {
    console.error("createMpPreferenceHttp error:", err);
    res.status(500).json({ error: err?.message || "internal error" });
    return;
  }
});
