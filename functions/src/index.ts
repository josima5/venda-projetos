/**
 * Firebase Functions Gen-2 + Mercado Pago + E-mails (Trigger Email)
 * Região: southamerica-east1
 * Secrets:
 *  - MP_ACCESS_TOKEN
 *  - FRONTEND_URL
 *  - MP_WEBHOOK_SECRET
 *  - TEST_EMAIL_SECRET (opcional)
 *  - ADMIN_FIX_EMAIL_SECRET (opcional)
 *  - LOGO_URL
 *
 * Observações:
 *  - Não enviamos e-mail inline ao criar preferência (evita duplicidade).
 *  - Usamos ADC (Application Default Credentials) por padrão.
 */

import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";

/* -------------------- Admin SDK (ADC) -------------------- */
if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

/* -------------------- Global opts -------------------- */
const REGION = "southamerica-east1";
setGlobalOptions({
  region: REGION,
  timeoutSeconds: 60,
  memory: "512MiB",
  concurrency: 10,
  maxInstances: 3,
  minInstances: 0,
});

/* -------------------- Secrets -------------------- */
const MP_ACCESS_TOKEN        = defineSecret("MP_ACCESS_TOKEN");
const FRONTEND_URL           = defineSecret("FRONTEND_URL");
const MP_WEBHOOK_SECRET      = defineSecret("MP_WEBHOOK_SECRET");
const TEST_EMAIL_SECRET      = defineSecret("TEST_EMAIL_SECRET");
const ADMIN_FIX_EMAIL_SECRET = defineSecret("ADMIN_FIX_EMAIL_SECRET");
const LOGO_URL               = defineSecret("LOGO_URL");

const readSecret = (s: any) =>
  String(s?.value?.() ?? "").replace(/^['"]|['"]$/g, "").trim();

/* -------------------- Mercado Pago SDK dynamic import -------------------- */
async function getMp() {
  const mod = (await import("mercadopago")) as any;
  const MercadoPagoConfig = mod.default;
  const { Preference, Payment } = mod;
  return { MercadoPagoConfig, Preference, Payment };
}

/* -------------------- Tipos -------------------- */
type PaymentMethod = "pix" | "card" | "boleto";
type OrderStatus = "pending" | "paid" | "canceled" | "refunded" | "chargeback";

/* -------------------- Robustez (retry) -------------------- */
function isTransient(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message ?? err ?? "");
  const status = Number((err?.status ?? err?.statusCode ?? 0) || 0);
  return (
    status >= 500 ||
    /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(msg) ||
    /5\d\d/.test(msg)
  );
}
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 300): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) break;
      const jitter = Math.floor(Math.random() * 150);
      const delay = baseDelayMs * Math.pow(2, i) + jitter;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/* -------------------- Utils -------------------- */
function splitBRPhone(raw?: string) {
  const digits = String(raw || "").replace(/\D/g, "");
  const clean = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (clean.length < 10 || clean.length > 11) return null;
  return { area_code: clean.slice(0, 2), number: clean.slice(2) };
}

/* ===== CORS corrigido (normalização + eco de headers do preflight) ===== */
function normalizeOrigin(u: string): string | null {
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`; // sem path e sem barra no final
  } catch {
    return String(u || "").replace(/\/+$/, "") || null;
  }
}

/** CORS com opção de credentials (evita wildcard quando há credenciais) */
function setCors(req: any, res: any, allowedOrigins: string[], withCredentials = false): boolean {
  const reqOrigin = String(req.headers.origin || "");
  const reqOriginNorm = normalizeOrigin(reqOrigin);

  const normalizedAllowed = allowedOrigins
    .map(normalizeOrigin)
    .filter(Boolean) as string[];

  const allow = normalizedAllowed.find(o => o === reqOriginNorm) || null;

  if (!allow) {
    res.set("Vary", "Origin");
    // Em preflight, responda 204 para não gerar erro no console; o POST real será bloqueado.
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return true;
    }
    res.status(403).send("Origin not allowed");
    return true;
  }

  res.set("Access-Control-Allow-Origin", allow);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

  // ecoa exatamente os headers solicitados no preflight (ou usa um padrão)
  const reqHdrs = String(req.headers["access-control-request-headers"] || "").toLowerCase();
  res.set("Access-Control-Allow-Headers", reqHdrs || "content-type, authorization");

  if (withCredentials) res.set("Access-Control-Allow-Credentials", "true");
  res.set("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

function buildPaymentMethods(chosen: PaymentMethod | undefined, installments: number) {
  const pm: any = {};
  if (chosen === "pix") {
    pm.default_payment_method_id = "pix";
    pm.excluded_payment_types = [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }, { id: "atm" }];
  } else if (chosen === "card") {
    pm.excluded_payment_types = [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }];
    if (installments > 1) pm.installments = installments;
  } else if (chosen === "boleto") {
    pm.default_payment_type_id = "ticket";
    pm.excluded_payment_types = [{ id: "credit_card" }, { id: "debit_card" }, { id: "atm" }, { id: "bank_transfer" }];
  }
  return pm;
}

async function getUidFromAuthHeader(req: any): Promise<string | null> {
  try {
    const auth = String(req.headers?.authorization || "");
    if (!auth.startsWith("Bearer ")) return null;
    const idToken = auth.slice(7);
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded?.uid || null;
  } catch { return null; }
}

/* -------------------- E-mail helpers -------------------- */
function currencyBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}
function baseEmail({
  title, pill, pillColor = "#111827", bodyHtml, footer,
  logoUrl, companyName = "Malta Engenharia"
}: {
  title: string;
  pill?: string;
  pillColor?: string;
  bodyHtml: string;
  footer?: string;
  logoUrl?: string;
  companyName?: string;
}) {
  const year = new Date().getFullYear();
  const safeFooter = footer ?? `© ${year} ${companyName}. Todos os direitos reservados.`;
  const logo = logoUrl ? `<img class="brand_img" src="${logoUrl}" alt="${companyName}" />` : "";

  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
  <title>${title}</title>
  <style>
    body{margin:0;padding:0;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial}
    .wrap{max-width:680px;margin:0 auto;padding:24px}
    .header{background:linear-gradient(135deg,#f59e0b,#111827);border-radius:16px 16px 0 0;padding:20px 24px;color:#fff}
    .brand{display:flex;align-items:center;gap:12px}
    .brand_img{height:28px;width:auto;display:block}
    .brand strong{font-weight:700}
    .sub{opacity:.9,font-size:12px;margin-top:4px}
    .card{background:#fff;border-radius:0 0 16px 16px;padding:24px;box-shadow:0 2px 12px rgba(16,24,40,.06)}
    h1{font-size:20px;margin:0 0 12px;color:#111827}
    p{margin:8px 0;color:#374151;line-height:1.5}
    .pill{display:inline-block;color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600}
    .row{margin-top:16px;padding:12px 16px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa}
    .label{color:#6b7280;font-size:12px}
    .val{color:#111827;font-weight:600}
    .btn{display:inline-block;margin-top:18px;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600}
    .muted{color:#6b7280;font-size:12px;margin-top:16px}
    .footer{margin-top:24px;color:#9ca3af;font-size:12px;text-align:center}
    @media (prefers-color-scheme: dark){
      body{background:#0b0f14}
      .card{background:#0e1520;border:1px solid #1f2a37}
      h1,.val{color:#e5e7eb}
      .label,.muted{color:#9ca3af}
      .row{background:#0f1723;border-color:#1f2a37}
      .footer{color:#6b7280}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="brand">${logo}<strong>${companyName}</strong></div>
      <div class="sub">Obrigado por escolher a ${companyName}</div>
    </div>
    <div class="card">
      ${pill ? `<span class="pill" style="background:${pillColor}">${pill}</span>` : ``}
      <h1>${title}</h1>
      ${bodyHtml}
      <div class="footer">${safeFooter}</div>
    </div>
  </div>
</body>
</html>`;
}
function renderPendingEmailHTML(p: { orderId: string; projectTitle?: string; total: number; frontendUrl: string; logoUrl?: string; company?: string; }) {
  const orderUrl = `${p.frontendUrl.replace(/\/+$/,"")}/pedido/${p.orderId}?pay=1`;
  return baseEmail({
    title: "Pedido recebido",
    pill: "Aguardando pagamento",
    pillColor: "#6366f1",
    logoUrl: p.logoUrl,
    companyName: p.company ?? "Malta Engenharia",
    bodyHtml: `
      <p>Recebemos o seu pedido <strong>#${p.orderId}</strong>. Finalize o pagamento para darmos sequência.</p>
      <div class="row"><div class="label">Projeto</div><div class="val">${p.projectTitle || "Seu projeto"}</div></div>
      <div class="row"><div class="label">Valor</div><div class="val">${currencyBRL(p.total)}</div></div>
      <a class="btn" href="${orderUrl}" target="_blank" rel="noopener">Acompanhar pedido</a>
      <p class="muted">Se você não reconhece esta solicitação, responda este e-mail.</p>
    `,
  });
}
function renderPaidEmailHTML(p: { orderId: string; projectTitle?: string; total: number; frontendUrl: string; paymentMethod?: string; logoUrl?: string; company?: string; }) {
  const orderUrl = `${p.frontendUrl.replace(/\/+$/,"")}/pedido/${p.orderId}`;
  return baseEmail({
    title: "Pagamento aprovado",
    pill: "Pagamento aprovado",
    pillColor: "#10b981",
    logoUrl: p.logoUrl,
    companyName: p.company ?? "Malta Engenharia",
    bodyHtml: `
      <p>Recebemos o pagamento do seu pedido <strong>#${p.orderId}</strong>. Obrigado pela compra!</p>
      <div class="row"><div class="label">Projeto</div><div class="val">${p.projectTitle || "Seu projeto"}</div></div>
      <div class="row"><div class="label">Valor pago</div><div class="val">${currencyBRL(p.total)}</div></div>
      <div class="row"><div class="label">Forma de pagamento</div><div class="val">${p.paymentMethod || "Mercado Pago"}</div></div>
      <a class="btn" href="${orderUrl}" target="_blank" rel="noopener">Ver status do pedido</a>
    `,
  });
}
function renderCanceledEmailHTML(p: { orderId: string; projectTitle?: string; total: number; frontendUrl: string; logoUrl?: string; company?: string; }) {
  const orderUrl = `${p.frontendUrl.replace(/\/+$/,"")}/pedido/${p.orderId}`;
  return baseEmail({
    title: "Pagamento não aprovado",
    pill: "Pagamento recusado/cancelado",
    pillColor: "#ef4444",
    logoUrl: p.logoUrl,
    companyName: p.company ?? "Malta Engenharia",
    bodyHtml: `
      <p>O pagamento do pedido <strong>#${p.orderId}</strong> não foi aprovado ou foi cancelado.</p>
      <div class="row"><div class="label">Projeto</div><div class="val">${p.projectTitle || "Seu projeto"}</div></div>
      <div class="row"><div class="label">Valor</div><div class="val">${currencyBRL(p.total)}</div></div>
      <a class="btn" href="${p.frontendUrl.replace(/\/+$/,"")}/pedido/${p.orderId}" target="_blank" rel="noopener">Tentar novamente</a>
    `,
  });
}
function renderRefundEmailHTML(p: { orderId: string; projectTitle?: string; total: number; frontendUrl: string; logoUrl?: string; company?: string; }) {
  const orderUrl = `${p.frontendUrl.replace(/\/+$/,"")}/pedido/${p.orderId}`;
  return baseEmail({
    title: "Reembolso realizado",
    pill: "Reembolsado",
    pillColor: "#0ea5e9",
    logoUrl: p.logoUrl,
    companyName: p.company ?? "Malta Engenharia",
    bodyHtml: `
      <p>O pedido <strong>#${p.orderId}</strong> foi reembolsado.</p>
      <div class="row"><div class="label">Projeto</div><div class="val">${p.projectTitle || "Seu projeto"}</div></div>
      <div class="row"><div class="label">Valor reembolsado</div><div class="val">${currencyBRL(p.total)}</div></div>
      <a class="btn" href="${orderUrl}" target="_blank" rel="noopener">Ver detalhes</a>
    `,
  });
}
function renderChargebackEmailHTML(p: { orderId: string; projectTitle?: string; total: number; frontendUrl: string; logoUrl?: string; company?: string; }) {
  const orderUrl = `${p.frontendUrl.replace(/\/+$/,"")}/pedido/${p.orderId}`;
  return baseEmail({
    title: "Chargeback em análise",
    pill: "Chargeback",
    pillColor: "#f59e0b",
    logoUrl: p.logoUrl,
    companyName: p.company ?? "Malta Engenharia",
    bodyHtml: `
      <p>Detectamos um chargeback para o pedido <strong>#${p.orderId}</strong>. Estamos analisando.</p>
      <div class="row"><div class="label">Projeto</div><div class="val">${p.projectTitle || "Seu projeto"}</div></div>
      <div class="row"><div class="label">Valor</div><div class="val">${currencyBRL(p.total)}</div></div>
      <a class="btn" href="${orderUrl}" target="_blank" rel="noopener">Acompanhar</a>
    `,
  });
}

/** Grava doc na coleção "mail" (Extension Trigger Email) */
async function queueEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string[]; bcc?: string[];
  from?: string; replyTo?: string;
}) {
  const toArray = Array.isArray(args.to) ? args.to : [args.to];
  const doc: any = {
    to: toArray,
    from: args.from ?? "Malta Engenharia <pedidos@maltaeng.com.br>",
    replyTo: args.replyTo ?? "Malta Engenharia <pedidos@maltaeng.com.br>",
    message: { subject: args.subject, html: args.html },
    createdAt: FieldValue.serverTimestamp(),
  };
  if (args.cc?.length) doc.cc = args.cc;
  if (args.bcc?.length) doc.bcc = args.bcc;
  await db.collection("mail").add(doc);
}

/* ===========================
   1) HTTP: criar preferência
   =========================== */
export const createMpPreferenceHttp = onRequest(
  { secrets: [MP_ACCESS_TOKEN, FRONTEND_URL, MP_WEBHOOK_SECRET, LOGO_URL] },
  async (req, res) => {
    try {
      const frontend = readSecret(FRONTEND_URL) || "https://example.com";
      const allowed  = [frontend, "http://localhost:5173", "http://127.0.0.1:5173"];
      if (setCors(req, res, allowed)) return;
      if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }

      const token = readSecret(MP_ACCESS_TOKEN);
      if (!token) { res.status(500).json({ error: "mp_token_missing" }); return; }

      const { projectId, addons = [], customer = {}, payment = {} } = (req.body || {}) as {
        projectId: string;
        addons?: Array<{ id: string; label?: string; price?: number }>;
        customer?: { name?: string; email?: string; phone?: string };
        payment?: { method?: PaymentMethod; installments?: number };
      };
      if (!projectId) { res.status(400).json({ error: "invalid_argument", message: "projectId é obrigatório." }); return; }

      const projSnap = await db.collection("projects").doc(projectId).get();
      if (!projSnap.exists) { res.status(404).json({ error: "not_found", message: "Projeto não encontrado." }); return; }
      const proj = projSnap.data() || {};
      const basePrice = Number(proj.price || 0);

      const catalog: any[] = Array.isArray(proj.addons) ? proj.addons : [];
      const byId = new Map<string, any>(catalog.map((a) => [String(a.id), a]));
      const extras = (addons || []).map((a) => {
        const spec = byId.get(String(a.id));
        return { id: String(a.id), label: String(spec?.label ?? a.label ?? ""), price: Number(spec?.price ?? a.price ?? 0) };
      });

      const addonsTotal = extras.reduce((acc, a) => acc + (Number(a.price) || 0), 0);
      const total = basePrice + addonsTotal;
      if (!(total > 0)) { res.status(400).json({ error: "invalid_amount", message: "Total precisa ser maior que zero." }); return; }

      // grava customerId dentro do pedido (email > phone)
      const email = String((customer as any)?.email || "").trim().toLowerCase();
      const phone = String((customer as any)?.phone || "").replace(/\D/g, "");
      const customerId = email ? `email:${email}` : phone ? `phone:${phone}` : null;

      const uid = await getUidFromAuthHeader(req);
      const orderRef = await db.collection("orders").add({
        projectId,
        projectTitle: String(proj.title ?? ""),
        mainImageUrl: String(proj.mainImageUrl ?? ""),
        basePrice,
        addons: extras,
        addonsTotal,
        total,
        customerUid: uid ?? null,
        customerId: customerId ?? null,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        customer: {
          name: String((customer as any)?.name ?? ""),
          email: String((customer as any)?.email ?? ""),
          phone: String((customer as any)?.phone ?? ""),
        },
        payment: {
          method: String((payment as any)?.method ?? ""),
          installments: Number((payment as any)?.installments ?? 1),
        },
      });

      // ⚠️ NÃO enviamos e-mail inline aqui — o gatilho onOrderWrite cuida disso.

      const { MercadoPagoConfig, Preference } = await getMp();
      const client = new MercadoPagoConfig({ accessToken: token, options: { timeout: 10_000 } });

      const webhookSecret = readSecret(MP_WEBHOOK_SECRET);
      const projectIdEnv = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
      const webhookBase = `https://${REGION}-${projectIdEnv}.cloudfunctions.net/mpWebhook`;
      const notification_url = webhookSecret ? `${webhookBase}?secret=${encodeURIComponent(webhookSecret)}` : webhookBase;

      const chosen: PaymentMethod | undefined = (payment as any)?.method;
      const inst = Number((payment as any)?.installments ?? 1);
      const pm = buildPaymentMethods(chosen, inst);

      const phonePieces = splitBRPhone((customer as any)?.phone);
      const payer: any = { name: String((customer as any)?.name ?? "") };
      if ((customer as any)?.email) payer.email = String((customer as any).email);
      if (phonePieces) payer.phone = phonePieces;

      const orderId = orderRef.id;
      const back_urls = {
        success: `${frontend}/pedido/${orderId}`,
        failure: `${frontend}/pedido/${orderId}`,
        pending: `${frontend}/pedido/${orderId}`,
      };

      const body: any = {
        items: [{ id: projectId, title: `Projeto: ${String(proj.title ?? "")}`, quantity: 1, unit_price: Number(total), currency_id: "BRL" }],
        payer,
        payment_methods: pm,
        external_reference: orderId,
        back_urls,
        notification_url,
        statement_descriptor: "MaltaEng",
      };

      const isHttpsFrontend = String(frontend).trim().toLowerCase().startsWith("https://");
      if (chosen === "card" && isHttpsFrontend) body.auto_return = "approved";

      const idempotencyKey = `pref-${orderId}`;
      const prefRes: any = await withRetry(() =>
        new Preference(client).create({ body, requestOptions: { idempotencyKey } })
      );

      const initPoint =
        prefRes?.init_point ||
        prefRes?.sandbox_init_point ||
        prefRes?.point_of_interaction?.transaction_data?.ticket_url ||
        "";

      const preferenceId = String(prefRes?.id || "");
      await orderRef.set({ preferenceId, "payment.init_point": initPoint, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      res.status(200).json({ orderId, init_point: initPoint, preferenceId });
    } catch (err: any) {
      console.error("createMpPreferenceHttp fatal:", err?.message || err, err?.details || "");
      res.status(500).json({ error: "internal", message: err?.message || "Falha inesperada ao criar preferência.", details: err?.details || null });
    }
  }
);

/* ===========================================================
   1.1) HTTP: cancelar pedido pendente (com CORS + credentials)
   =========================================================== */
export const cancelOrderHttp = onRequest(
  { secrets: [FRONTEND_URL] },
  async (req, res) => {
    try {
      const frontend = readSecret(FRONTEND_URL) || "https://example.com";
      const allowed = [frontend, "http://localhost:5173", "http://127.0.0.1:5173"];
      if (setCors(req, res, allowed, true)) return;

      if (req.method !== "POST") {
        res.status(405).json({ error: "method_not_allowed" });
        return;
      }

      // Auth via Bearer ID token
      const uid = await getUidFromAuthHeader(req);
      if (!uid) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }

      const orderId = String((req.body?.orderId ?? "") as string).trim();
      if (!orderId) {
        res.status(400).json({ error: "orderId_required" });
        return;
      }

      const ref = db.collection("orders").doc(orderId);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const data = snap.data() as any;
      const status = String(data?.status || "").toLowerCase();
      const isPending = ["pending", "awaiting_payment", "open", "opened"].includes(status);

      // somente dono do pedido pode cancelar
      if (String(data?.customerUid || "") !== uid) {
        res.status(403).json({ error: "permission_denied" });
        return;
      }
      if (!isPending) {
        res.status(409).json({ error: "not_pending" });
        return;
      }

      await ref.update({
        status: "canceled",
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.status(200).json({ ok: true });
    } catch (e: any) {
      console.error("cancelOrderHttp error:", e?.message || e);
      res.status(500).json({ error: "internal" });
    }
  }
);

/* ===========================
   2) Webhook Mercado Pago
   =========================== */
export const mpWebhook = onRequest(
  { secrets: [MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET] },
  async (req, res): Promise<void> => {
    try {
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      const requiredSecret = readSecret(MP_WEBHOOK_SECRET);
      const received = String(req.query.secret ?? "").trim();
      if (requiredSecret && received !== requiredSecret) { res.status(401).send("Unauthorized"); return; }

      const token = readSecret(MP_ACCESS_TOKEN);
      if (!token) { res.status(500).send("MP token missing"); return; }

      const type = (req.query.type as string) || (req.body?.type as string) || (req.body?.action as string);
      const paymentId =
        (req.body?.data?.id as string | undefined) ||
        (req.query["data.id"] as string | undefined) ||
        (req.query.id as string | undefined);

      if (type !== "payment" || !paymentId) { res.status(200).send("Ignored"); return; }

      const { MercadoPagoConfig, Payment } = await getMp();
      const client = new MercadoPagoConfig({ accessToken: token, options: { timeout: 10_000 } });

      let p: any;
      try { p = await new Payment(client).get({ id: paymentId }); }
      catch { res.status(200).send("Payment not found (ignored)"); return; }

      const statusMp      = String(p.status || "pending");
      const externalRef   = String(p.external_reference || "");
      const paymentMethod = String(p.payment_method_id || "");
      const installments  = Number(p.installments || 0);
      const amount        = Number(p.transaction_amount || 0);
      const paidAt        = p.date_approved ? Timestamp.fromDate(new Date(p.date_approved)) : undefined;

      if (!externalRef) { res.status(200).send("No external_reference"); return; }

      let newStatus: OrderStatus = "pending";
      if (statusMp === "approved") newStatus = "paid";
      else if (["rejected", "cancelled"].includes(statusMp)) newStatus = "canceled";
      else if (statusMp === "refunded") newStatus = "refunded";
      else if (statusMp === "charged_back") newStatus = "chargeback";

      await db.collection("orders").doc(externalRef).set(
        {
          status: newStatus,
          "payment.gateway": "mercadopago",
          "payment.paymentId": paymentId,
          "payment.rawStatus": statusMp,
          "payment.paymentMethod": paymentMethod,
          "payment.installments": installments,
          "payment.amount": amount,
          "payment.paidAt": paidAt ?? FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      res.status(200).send("OK");
    } catch (err) {
      console.error("mpWebhook error:", err);
      res.status(500).send("Internal Server Error");
    }
  }
);

/* ============================================================
   3) Pós-pagamento: e-mails por gatilho (e flags idempotentes)
   ============================================================ */
export const onOrderWrite = onDocumentWritten(
  { document: "orders/{orderId}", region: REGION, secrets: [FRONTEND_URL, LOGO_URL] },
  async (event) => {
    const before = event.data?.before?.data() as any | undefined;
    const after  = event.data?.after?.data()  as any | undefined;
    const orderId = event.params.orderId as string;
    if (!after) return;

    const beforeStatus: OrderStatus | undefined = before?.status;
    const afterStatus:  OrderStatus | undefined = after?.status;

    // marcação idempotente ao mudar para "paid"
    if (beforeStatus !== "paid" && afterStatus === "paid" && !after?.postProcess?.paidHandled) {
      const docRef = db.collection("orders").doc(orderId);
      await db.runTransaction(async (t) => {
        const snap = await t.get(docRef);
        const cur = snap.data() as any;
        if (cur?.postProcess?.paidHandled) return;
        t.set(docRef, {
          postProcess: { ...(cur?.postProcess ?? {}), paidHandled: true, emailPaidQueued: cur?.postProcess?.emailPaidQueued ?? false },
          paidAt: cur?.paidAt ?? FieldValue.serverTimestamp(),
          fulfillment: {
            ...(cur?.fulfillment ?? {}),
            released: true,
            releasedAt: cur?.fulfillment?.releasedAt ?? FieldValue.serverTimestamp(),
          },
          statusHistory: FieldValue.arrayUnion({
            at: FieldValue.serverTimestamp(),
            from: beforeStatus ?? null,
            to: afterStatus,
            reason: "post-payment-processor",
          }),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
    }

    const frontend = readSecret(FRONTEND_URL) || "https://example.com";
    const logo     = readSecret(LOGO_URL) || "";
    async function markFlag(flag: string) {
      await db.collection("orders").doc(orderId).set({
        postProcess: { ...(after?.postProcess ?? {}), [flag]: true },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // pending -> e-mail (uma vez)
    if ((beforeStatus !== "pending") && afterStatus === "pending" && !after?.postProcess?.emailPendingQueued) {
      const to = String(after?.customer?.email || "");
      if (to) {
        const html = renderPendingEmailHTML({
          orderId, projectTitle: String(after?.projectTitle ?? ""), total: Number(after?.total ?? 0),
          frontendUrl: frontend, logoUrl: logo,
        });
        await queueEmail({ to, subject: `Pedido recebido • #${orderId}`, html });
        await markFlag("emailPendingQueued");
      }
    }

    // paid -> e-mail aprovado (uma vez)
    if (afterStatus === "paid" && !after?.postProcess?.emailPaidQueued) {
      const to = String(after?.customer?.email || "");
      if (to) {
        const html = renderPaidEmailHTML({
          orderId, projectTitle: String(after?.projectTitle ?? ""), total: Number(after?.total ?? 0),
          frontendUrl: frontend, paymentMethod: String(after?.payment?.paymentMethod || "Mercado Pago"),
          logoUrl: logo,
        });
        await queueEmail({ to, subject: `Pagamento aprovado • Pedido #${orderId}`, html });
        await markFlag("emailPaidQueued");
      }
    }

    // canceled
    if (afterStatus === "canceled" && !after?.postProcess?.emailCanceledQueued) {
      const to = String(after?.customer?.email || "");
      if (to) {
        const html = renderCanceledEmailHTML({
          orderId, projectTitle: String(after?.projectTitle ?? ""), total: Number(after?.total ?? 0),
          frontendUrl: frontend, logoUrl: logo,
        });
        await queueEmail({ to, subject: `Pagamento não aprovado • Pedido #${orderId}`, html });
        await markFlag("emailCanceledQueued");
      }
    }

    // refunded
    if (afterStatus === "refunded" && !after?.postProcess?.emailRefundQueued) {
      const to = String(after?.customer?.email || "");
      if (to) {
        const html = renderRefundEmailHTML({
          orderId, projectTitle: String(after?.projectTitle ?? ""), total: Number(after?.total ?? 0),
          frontendUrl: frontend, logoUrl: logo,
        });
        await queueEmail({ to, subject: `Reembolso realizado • Pedido #${orderId}`, html });
        await markFlag("emailRefundQueued");
      }
    }

    // chargeback
    if (afterStatus === "chargeback" && !after?.postProcess?.emailChargebackQueued) {
      const to = String(after?.customer?.email || "");
      if (to) {
        const html = renderChargebackEmailHTML({
          orderId, projectTitle: String(after?.projectTitle ?? ""), total: Number(after?.total ?? 0),
          frontendUrl: frontend, logoUrl: logo,
        });
        await queueEmail({ to, subject: `Chargeback em análise • Pedido #${orderId}`, html });
        await markFlag("emailChargebackQueued");
      }
    }
  }
);

/* =================================================================
   4) Reconciliação de pedidos pendentes consultando o MP (cron)
   ================================================================= */
const RECONCILE_MAX_PER_RUN = 25;
const RECONCILE_MIN_AGE_MIN = 10;

async function searchPaymentByExternalRef(accessToken: string, externalRef: string): Promise<any | null> {
  const { MercadoPagoConfig, Payment } = await getMp();
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
  const resp: any = await withRetry(() => new Payment(client).search({ options: { external_reference: externalRef } }));
  const results: any[] = resp?.results || resp?.body?.results || [];
  if (!Array.isArray(results) || results.length === 0) return null;
  results.sort((a: any, b: any) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
  return results[0];
}

export const reconcileMpPendingOrders = onSchedule(
  {
    region: REGION,
    schedule: "every 15 minutes",
    timeZone: "America/Sao_Paulo",
    secrets: [MP_ACCESS_TOKEN],
    concurrency: 1,
    maxInstances: 1,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async () => {
    const token = readSecret(MP_ACCESS_TOKEN);
    if (!token) { console.error("Reconciliação abortada: MP token ausente"); return; }

    const cutoff = Timestamp.fromDate(new Date(Date.now() - RECONCILE_MIN_AGE_MIN * 60_000));
    const qsnap = await db.collection("orders")
      .where("status", "==", "pending")
      .where("createdAt", "<", cutoff)
      .limit(RECONCILE_MAX_PER_RUN)
      .get();

    if (qsnap.empty) return;

    for (const doc of qsnap.docs) {
      const orderId = doc.id;
      const cur = doc.data() as any;

      try {
        const p = await searchPaymentByExternalRef(token, orderId);
        if (!p) continue;

        const statusMp      = String(p.status || "pending");
        const paymentMethod = String(p.payment_method_id || "");
        const installments  = Number(p.installments || 0);
        const amount        = Number(p.transaction_amount || 0);
        const paidAt        = p.date_approved ? Timestamp.fromDate(new Date(p.date_approved)) : undefined;

        let newStatus: OrderStatus = "pending";
        if (statusMp === "approved") newStatus = "paid";
        else if (["rejected", "cancelled"].includes(statusMp)) newStatus = "canceled";
        else if (statusMp === "refunded") newStatus = "refunded";
        else if (statusMp === "charged_back") newStatus = "chargeback";

        if (newStatus !== "pending") {
          await db.collection("orders").doc(orderId).set(
            {
              status: newStatus,
              "payment.gateway": "mercadopago",
              "payment.paymentId": p.id ?? cur?.payment?.paymentId ?? null,
              "payment.rawStatus": statusMp,
              "payment.paymentMethod": paymentMethod,
              "payment.installments": installments,
              "payment.amount": amount,
              "payment.paidAt": paidAt ?? FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (e: any) {
        console.warn("reconcile: falha ao processar", orderId, e?.message || e);
      }
    }
  }
);

/* =========================================================================
   5) Cron Fallback: enviar e-mail "paid" que porventura não foi enfileirado
   ========================================================================= */
export const fixMissingPaidEmails = onSchedule(
  {
    region: REGION,
    schedule: "every 10 minutes",
    timeZone: "America/Sao_Paulo",
    secrets: [FRONTEND_URL, LOGO_URL],
    concurrency: 1,
    maxInstances: 1,
  },
  async () => {
    const frontend = readSecret(FRONTEND_URL) || "https://example.com";
    const logo     = readSecret(LOGO_URL) || "";

    const qsnap = await db.collection("orders")
      .where("status", "==", "paid")
      .where("postProcess.emailPaidQueued", "==", false)
      .limit(25)
      .get()
      .catch(() => null);

    if (!qsnap || qsnap.empty) return;

    for (const doc of qsnap.docs) {
      const id = doc.id;
      const o = doc.data() || {};
      const to = String(o?.customer?.email || "");
      if (!to) continue;

      try {
        const html = renderPaidEmailHTML({
          orderId: id,
          projectTitle: String(o?.projectTitle ?? ""),
          total: Number(o?.total ?? 0),
          frontendUrl: frontend,
          paymentMethod: String(o?.payment?.paymentMethod || "Mercado Pago"),
          logoUrl: logo,
        });
        await queueEmail({ to, subject: `Pagamento aprovado • Pedido #${id}`, html });
        await db.collection("orders").doc(id).set({
          postProcess: { ...(o.postProcess ?? {}), emailPaidQueued: true },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.warn("fixMissingPaidEmails failed:", id, (e as any)?.message || e);
      }
    }
  }
);

/* =========================================================
   6) Endpoint para "forçar" o envio do email de pago
   ========================================================= */
export const forceSendPaidEmail = onRequest(
  { secrets: [FRONTEND_URL, ADMIN_FIX_EMAIL_SECRET, LOGO_URL] },
  async (req, res) => {
    try {
      const required = readSecret(ADMIN_FIX_EMAIL_SECRET);
      const ok = !required || String(req.query.secret || "") === required;
      if (!ok) { res.status(401).send("Unauthorized"); return; }

      const orderId   = String(req.query.orderId   || "").trim();
      const prefId    = String((req.query.prefId   || req.query.preferenceId || "") as string).trim();
      const paymentId = String(req.query.paymentId || "").trim();

      let snap: FirebaseFirestore.DocumentSnapshot | null = null;

      if (orderId) {
        const s = await db.collection("orders").doc(orderId).get();
        if (s.exists) snap = s;
      }
      if (!snap && prefId) {
        const qs = await db.collection("orders").where("preferenceId", "==", prefId).limit(1).get();
        if (!qs.empty) snap = qs.docs[0];
      }
      if (!snap && paymentId) {
        const qs2 = await db.collection("orders").where("payment.paymentId", "==", paymentId).limit(1).get();
        if (!qs2.empty) snap = qs2.docs[0];
      }

      if (!snap) { res.status(404).send("Order not found"); return; }

      const id   = snap.id;
      let data   = snap.data() || {};
      const to   = String(data?.customer?.email || "");
      if (!to) { res.status(400).send("Order has no customer.email"); return; }

      if (String(data.status) !== "paid" && String(req.query.force || "") === "1") {
        await db.collection("orders").doc(id).set(
          { status: "paid", updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        data = (await db.collection("orders").doc(id).get()).data() || data;
      }

      if (String(data.status) !== "paid") { res.status(400).send("Order not paid"); return; }
      if (data?.postProcess?.emailPaidQueued) { res.status(200).send("Already queued"); return; }

      const frontend = readSecret(FRONTEND_URL) || "https://example.com";
      const logo     = readSecret(LOGO_URL) || "";

      const html = renderPaidEmailHTML({
        orderId: id,
        projectTitle: String(data?.projectTitle ?? ""),
        total: Number(data?.total ?? data?.payment?.amount ?? 0),
        frontendUrl: frontend,
        paymentMethod: String(data?.payment?.paymentMethod || "Mercado Pago"),
        logoUrl: logo,
      });

      await queueEmail({ to, subject: `Pagamento aprovado • Pedido #${id}`, html });
      await db.collection("orders").doc(id).set({
        postProcess: { ...(data.postProcess ?? {}), emailPaidQueued: true },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      res.status(200).send(`ok: queued email for ${id}`);
    } catch (e: any) {
      console.error("forceSendPaidEmail error:", e?.message || e);
      res.status(500).send(e?.message || "error");
    }
  }
);

/* =========================================================
   7) Endpoint de teste simples (fila de e-mail)
   ========================================================= */
export const sendTestEmail = onRequest(
  { secrets: [TEST_EMAIL_SECRET, LOGO_URL] },
  async (req, res) => {
    const required = readSecret(TEST_EMAIL_SECRET);
    const ok = !required || String(req.query.secret ?? "") === required;
    if (!ok) { res.status(401).send("Unauthorized"); return; }
    try {
      const logo = readSecret(LOGO_URL) || "";
      const html = baseEmail({
        title: "Teste de e-mail (Firebase Extension)",
        pill: "Teste",
        pillColor: "#6366f1",
        bodyHtml: `<p>Olá! Este é um e-mail de teste enviado pela extensão.</p>`,
        logoUrl: logo,
      });
      await queueEmail({ to: "pedidos@maltaeng.com.br", subject: "Teste de e-mail (Firebase Extension)", html });
      res.status(200).send("queued");
    } catch (e: any) {
      console.error("sendTestEmail error:", e?.message || e);
      res.status(500).send(e?.message || "error");
    }
  }
);

/* =========================================================
   8) Agregação de cliente / customers (gatilho separado)
   ========================================================= */
export const onOrderStatusWritten = onDocumentWritten(
  { document: "orders/{orderId}", region: REGION },
  async (event) => {
    const orderId = event.params.orderId as string;
    const before = (event.data?.before?.data() as any) || null;
    const after = (event.data?.after?.data() as any) || null;
    if (!after) return;

    const cust = after.customer || {};
    const email = String(cust.email || "").trim().toLowerCase();
    const phone = String(cust.phone || "").replace(/\D/g, "");
    const customerId = after.customerId || (email ? `email:${email}` : phone ? `phone:${phone}` : null);
    if (!customerId) return;

    const custId = String(customerId).replace(/[^a-z0-9:_-]/gi, "_");
    const custRef = db.collection("customers").doc(custId);

    const becamePaid =
      before?.status !== "paid" &&
      after?.status === "paid" &&
      !after?.postProcess?.aggPaidCounted;

    await db.runTransaction(async (t) => {
      const snap = await t.get(custRef);
      const cur = (snap.exists ? snap.data() : {}) as any;

      const addr = cust.address || {};
      const patch: any = {
        name: String(cust.name || cur?.name || ""),
        email: email || cur?.email || null,
        phone: phone || cur?.phone || null,
        taxId: String(cust.taxId || cur?.taxId || "").replace(/\D/g, "") || null,
        address: {
          zip: String(addr.zip || cur?.address?.zip || "").replace(/\D/g, "") || null,
          street: addr.street ?? cur?.address?.street ?? null,
          number: addr.number ?? cur?.address?.number ?? null,
          complement: addr.complement ?? cur?.address?.complement ?? null,
          district: addr.district ?? cur?.address?.district ?? null,
          city: addr.city ?? cur?.address?.city ?? null,
          state: addr.state ?? cur?.address?.state ?? null,
        },
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: cur?.createdAt || FieldValue.serverTimestamp(),
      };

      if (becamePaid) {
        patch.ordersCount = FieldValue.increment(1);
        const amount = Number(after?.payment?.amount || after?.total || 0);
        patch.totalSpent = FieldValue.increment(amount);
        patch.lastOrderAt = FieldValue.serverTimestamp();
      }

      t.set(custRef, patch, { merge: true });

      const post = { ...(after?.postProcess ?? {}), customerLinked: true, customerRef: custId };
      if (becamePaid) (post as any).aggPaidCounted = true;

      t.set(
        db.collection("orders").doc(orderId),
        { postProcess: post, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    });
  }
);
