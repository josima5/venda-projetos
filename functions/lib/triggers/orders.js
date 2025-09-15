"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onOrderStatusWritten = void 0;
require("../admin");
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const REGION = "southamerica-east1";
const db = (0, firestore_2.getFirestore)();
/**
 * Mantém agregados no /customers e sincroniza dados do checkout
 * (nome, email, phone, taxId e address) vindos do /orders.
 */
exports.onOrderStatusWritten = (0, firestore_1.onDocumentWritten)({ document: "orders/{orderId}", region: REGION }, async (event) => {
    const orderId = event.params.orderId;
    const before = event.data?.before?.data() || null;
    const after = event.data?.after?.data() || null;
    if (!after)
        return;
    // identifica cliente
    const cust = after.customer || {};
    const email = String(cust.email || "").trim().toLowerCase();
    const phone = String(cust.phone || "").replace(/\D/g, "");
    const customerId = after.customerId || (email ? `email:${email}` : phone ? `phone:${phone}` : null);
    if (!customerId)
        return;
    const custId = String(customerId).replace(/[^a-z0-9:_-]/gi, "_");
    const custRef = db.collection("customers").doc(custId);
    // status → pagou?
    const becamePaid = before?.status !== "paid" &&
        after?.status === "paid" &&
        !after?.postProcess?.aggPaidCounted;
    await db.runTransaction(async (t) => {
        const snap = await t.get(custRef);
        const cur = (snap.exists ? snap.data() : {});
        const addr = cust.address || {};
        const patch = {
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
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
            createdAt: cur?.createdAt || firestore_2.FieldValue.serverTimestamp(),
        };
        if (becamePaid) {
            patch.ordersCount = firestore_2.FieldValue.increment(1);
            const amount = Number(after?.payment?.amount || after?.total || 0);
            patch.totalSpent = firestore_2.FieldValue.increment(amount);
            patch.lastOrderAt = firestore_2.FieldValue.serverTimestamp();
        }
        t.set(custRef, patch, { merge: true });
        // marcações idempotentes no pedido
        const post = { ...(after?.postProcess ?? {}), customerLinked: true, customerRef: custId };
        if (becamePaid)
            post.aggPaidCounted = true;
        t.set(db.collection("orders").doc(orderId), { postProcess: post, updatedAt: firestore_2.FieldValue.serverTimestamp() }, { merge: true });
    });
});
