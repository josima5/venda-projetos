// src/modules/pedidos/services/ordersService.ts
import { db } from "../../../firebase/config";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  setDoc,
  deleteDoc,
  type Unsubscribe,
} from "firebase/firestore";

export type OrderDoc = {
  id: string;
  status: string;
  total?: number;
  createdAt?: any;
  paidAt?: any;
  projectId?: string;
  projectTitle?: string;
  paymentMethod?: string;
  installments?: number;
  fulfillment?: { released?: boolean; releasedAt?: any; updatedAt?: any };
  mainImageUrl?: string;
  customerUid?: string | null;
  invoice?: {
    status?: InvoiceStatus;
    number?: string | null;
    sentAt?: any;
    updatedAt?: any;
  };
};

export type InvoiceStatus = "pending" | "sent";

/** Observa pedidos do cliente (filtra por customerUid) */
export function watchMyOrders(uid: string, cb: (rows: OrderDoc[]) => void): Unsubscribe {
  const q = query(
    collection(db, "orders"),
    where("customerUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  const off = onSnapshot(q, (snap) => {
    const list: OrderDoc[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
    cb(list);
  });

  return off;
}

/** Observa um pedido específico em tempo real (útil para telas de detalhe) */
export function watchOrder(orderId: string, cb: (row: OrderDoc | null) => void): Unsubscribe {
  const ref = doc(db, "orders", orderId);
  return onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as OrderDoc) : null),
    () => cb(null)
  );
}

/** Cancela um pedido (atenção às regras de segurança) */
export async function customerCancelOrder(orderId: string) {
  const ref = doc(db, "orders", orderId);
  await updateDoc(ref, {
    status: "canceled",
    canceledAt: serverTimestamp(),
  });
}

/**
 * ✅ Atualiza o status da NFS-e do pedido.
 * - `status`: "pending" | "sent"
 * - `opts.number`: número da NFS-e (opcional). Se não vier, mantém o atual.
 *   Se vier `null`/string vazia, zera o número.
 */
export async function setInvoiceStatus(
  orderId: string,
  status: InvoiceStatus,
  opts?: { number?: string | null }
) {
  const ref = doc(db, "orders", orderId);

  const data: Record<string, any> = {
    "invoice.status": status,
    "invoice.updatedAt": serverTimestamp(),
  };

  // se marcou como "sent", registra o momento
  if (status === "sent") {
    data["invoice.sentAt"] = serverTimestamp();
  }

  // tratar número (manter, definir, ou limpar)
  if (opts && "number" in opts) {
    const n = (opts.number ?? "").trim();
    data["invoice.number"] = n ? n : null;
  }

  await updateDoc(ref, data);
}

/** (Admin) Marca/Desmarca a liberação de downloads do pedido */
export async function setFulfillmentReleased(orderId: string, released: boolean) {
  const ref = doc(db, "orders", orderId);
  const patch: Record<string, any> = {
    "fulfillment.released": released,
    "fulfillment.updatedAt": serverTimestamp(),
  };
  if (released) {
    patch["fulfillment.releasedAt"] = serverTimestamp();
  } else {
    patch["fulfillment.releasedAt"] = null;
  }
  await updateDoc(ref, patch);
}

/** (Admin) Atualiza o status bruto do pedido (ex.: "paid", "pending", "canceled", ...) */
export async function setOrderStatus(orderId: string, status: string) {
  const ref = doc(db, "orders", orderId);
  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp(),
    ...(status === "paid" ? { paidAt: serverTimestamp() } : {}),
  });
}

/**
 * (Opcional/Admin) Concede acesso do cliente aos entregáveis de um projeto
 * criando um índice em: deliveryAccess/{projectId}/users/{customerUid}
 * — compatível com as regras incrementadas do Firestore.
 */
export async function grantDownloadsAccessByOrder(orderId: string) {
  const orderSnap = await getDoc(doc(db, "orders", orderId));
  if (!orderSnap.exists()) throw new Error("Pedido não encontrado");

  const o = orderSnap.data() as any;
  const projectId = String(o.projectId || "");
  const customerUid = String(o.customerUid || o.userId || "");

  if (!projectId || !customerUid) {
    throw new Error("Pedido sem projectId ou customerUid");
  }

  const accessRef = doc(db, "deliveryAccess", projectId, "users", customerUid);
  await setDoc(
    accessRef,
    {
      orderId,
      projectId,
      customerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      granted: true,
    },
    { merge: true }
  );
}

/** (Opcional/Admin) Revoga o acesso criado em deliveryAccess */
export async function revokeDownloadsAccessByOrder(orderId: string) {
  const orderSnap = await getDoc(doc(db, "orders", orderId));
  if (!orderSnap.exists()) return;

  const o = orderSnap.data() as any;
  const projectId = String(o.projectId || "");
  const customerUid = String(o.customerUid || o.userId || "");

  if (!projectId || !customerUid) return;

  const accessRef = doc(db, "deliveryAccess", projectId, "users", customerUid);
  await deleteDoc(accessRef);
}
