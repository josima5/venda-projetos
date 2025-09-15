"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMpPreferenceHttp = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
// todas as functions desta file na mesma região
(0, v2_1.setGlobalOptions)({ region: "southamerica-east1" });
/** ID determinístico do cliente (email > phone) */
function customerIdFrom(email, phone) {
    const e = (email ?? "").trim().toLowerCase();
    const p = (phone ?? "").replace(/\D/g, "");
    if (e)
        return `email:${e}`;
    if (p)
        return `phone:${p}`;
    return null;
}
/** Upsert no /customers com os campos permitidos/úteis */
async function upsertCustomerFromPayload(payload) {
    const cid = customerIdFrom(payload.customer?.email, payload.customer?.phone);
    if (!cid)
        return null;
    await db.doc(`customers/${cid}`).set({
        name: payload.customer?.name ?? "",
        email: payload.customer?.email ?? "",
        phone: (payload.customer?.phone ?? "").replace(/\D/g, "") || null,
        taxId: (payload.customer?.taxId ?? "").replace(/\D/g, "") || null,
        address: payload.customer?.address ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return cid;
}
/**
 * Handler HTTP do checkout.
 * Mantenha aqui o SEU fluxo de Mercado Pago (criação da preferência),
 * e a criação do pedido em /orders. Depois, chamamos o upsert de cliente.
 */
exports.createMpPreferenceHttp = (0, https_1.onRequest)(async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }
        const payload = req.body;
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
            total: Number((payload.addons ?? []).reduce((acc, a) => acc + (Number(a.price) || 0), 0)), // ajuste conforme sua regra
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
    }
    catch (err) {
        console.error("createMpPreferenceHttp error:", err);
        res.status(500).json({ error: err?.message || "internal error" });
        return;
    }
});
