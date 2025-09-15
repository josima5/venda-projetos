import { db } from "../../../firebase/config";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";

export type OrderDoc = {
  id: string;
  status?:
    | "pending"
    | "paid"
    | "approved"
    | "canceled"
    | "refunded"
    | "chargeback"
    | "succeeded"
    | "completed"
    | string;
  total?: number;
  createdAt?: Timestamp | Date | null;
  paidAt?: Timestamp | Date | null;
  payment?: {
    paymentMethod?: string; // "pix" | "card" | "boleto" | ...
    method?: string;        // fallback, em alguns docs
    status?: string;        // "approved" | ...
  };
  invoice?: {
    status?: "pending" | "sent" | "n/a";
    number?: string | null;                 // ⬅️ adicionado
    sentAt?: Timestamp | Date | null;       // ⬅️ adicionado
  };
  // campos extras podem existir
  [k: string]: any;
};

export type PeriodKey = "today" | "7d" | "30d" | "90d";

/** Considera um pedido como PAGO/APROVADO. */
export function isPaid(o: OrderDoc): boolean {
  const s = String(o.status ?? "").toLowerCase();
  if (["paid", "approved", "succeeded", "completed"].includes(s)) return true;

  const ps = String(o.payment?.status ?? "").toLowerCase();
  if (["paid", "approved", "succeeded", "completed"].includes(ps)) return true;

  const p = o.paidAt;
  if (p && (p instanceof Date || (p as any)?.toDate)) return true;

  return false;
}

/** Considera um pedido como PENDENTE (não pago e não cancelado). */
export function isPending(o: OrderDoc): boolean {
  if (isPaid(o)) return false;
  const s = String(o.status ?? "").toLowerCase();
  if (["canceled", "refunded", "chargeback"].includes(s)) return false;
  return true; // tudo que não se enquadra como pago/cancelado tratamos como pendente
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getPeriodRange(period: PeriodKey): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;

  switch (period) {
    case "today":
      start = startOfToday();
      break;
    case "7d":
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case "30d":
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      break;
    case "90d":
    default:
      start = new Date(now);
      start.setDate(now.getDate() - 90);
      break;
  }
  return { start, end: now };
}

/** Ouve pedidos por período com live updates (filtra por createdAt >= start). */
export function watchOrdersByPeriod(
  period: PeriodKey,
  cb: (orders: OrderDoc[]) => void
) {
  const { start } = getPeriodRange(period);
  const ordersRef = collection(db, "orders");

  const q = query(
    ordersRef,
    where("createdAt", ">=", Timestamp.fromDate(start)),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snap) => {
    const list: OrderDoc[] = snap.docs.map((d) => {
      const data = d.data() as DocumentData;
      return { id: d.id, ...data } as OrderDoc;
    });
    cb(list);
  });
}

/** Agregações para o Dashboard – SOMENTE pagos. */
export function computeMetrics(orders: OrderDoc[]) {
  const paid = orders.filter(isPaid);

  const grossRevenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
  const paidCount = paid.length;
  const ticket = paidCount ? grossRevenue / paidCount : 0;

  // NF-e pendentes (faz sentido olhar só nos pagos)
  const pendingInvoices = paid.filter(
    (o) => (o.invoice?.status ?? "pending") === "pending"
  ).length;

  // Receita por dia (usa paidAt se existir, senão createdAt)
  const revenueByDayMap: Record<string, number> = {};
  for (const o of paid) {
    const when =
      (o.paidAt instanceof Timestamp
        ? o.paidAt.toDate()
        : o.paidAt instanceof Date
        ? o.paidAt
        : o.createdAt instanceof Timestamp
        ? o.createdAt.toDate()
        : o.createdAt instanceof Date
        ? o.createdAt
        : new Date()) ?? new Date();

    const key = when.toLocaleDateString("pt-BR");
    revenueByDayMap[key] = (revenueByDayMap[key] || 0) + Number(o.total || 0);
  }

  const revenueByDay = Object.entries(revenueByDayMap)
    .map(([name, Receita]) => ({ name, Receita }))
    .sort(
      (a, b) =>
        new Date(a.name.split("/").reverse().join("-")).getTime() -
        new Date(b.name.split("/").reverse().join("-")).getTime()
    );

  // Métodos de pagamento
  const methodCount: Record<string, number> = {};
  for (const o of paid) {
    const m =
      o.payment?.paymentMethod ||
      o.payment?.method ||
      (o as any).paymentMethod ||
      "desconhecido";
    methodCount[m] = (methodCount[m] || 0) + 1;
  }

  const paymentMethodData = Object.entries(methodCount).map(([name, value]) => ({
    name,
    value,
  }));

  return {
    grossRevenue,
    paidCount,
    ticket,
    pendingInvoices,
    revenueByDay,
    paymentMethodData,
  };
}
