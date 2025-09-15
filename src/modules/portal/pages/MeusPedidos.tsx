// src/modules/portal/pages/MeusPedidos.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../../../firebase/config";
import { ArrowRight, CreditCard } from "lucide-react";

/* -------------------- helpers -------------------- */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: any) => {
  try {
    if (!d) return "";
    if (d?.toDate) return new Date(d.toDate()).toLocaleString("pt-BR");
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return "";
  }
};

type OrderDoc = {
  id: string;
  status: string;
  total?: number;
  createdAt?: any;
  projectId?: string;
  projectTitle?: string;
};

/** Cores do chip por status */
const STATUS_COLOR: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  awaiting_payment: "bg-amber-100 text-amber-700",
  opened: "bg-amber-100 text-amber-700",
  open: "bg-amber-100 text-amber-700",
  canceled: "bg-rose-100 text-rose-700",
  refunded: "bg-slate-200 text-slate-700",
  default: "bg-slate-100 text-slate-700",
};

/** Traduções do rótulo do status */
const STATUS_LABEL_PT: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  awaiting_payment: "Aguardando pagamento",
  open: "Em aberto",
  opened: "Em aberto",
  canceled: "Cancelado",
  refunded: "Reembolsado",
  default: "—",
};

export default function MeusPedidos() {
  const user = auth.currentUser;
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingPay, setStartingPay] = useState<string | null>(null);
  const [canceling, setCanceling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, "orders"),
      where("customerUid", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const off = onSnapshot(
      q,
      (snap) => {
        const list: OrderDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setOrders(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => off();
  }, [user?.uid]);

  const hasOrders = useMemo(() => orders.length > 0, [orders]);

  function statusChip(status?: string) {
    const key = (status || "").toLowerCase();
    const color = STATUS_COLOR[key] || STATUS_COLOR.default;
    const label = STATUS_LABEL_PT[key] || STATUS_LABEL_PT.default;
    return <span className={`rounded-full px-2 py-0.5 text-xs ${color}`}>{label}</span>;
  }

  async function startPaymentFlow(orderId: string) {
    if (!orderId || startingPay) return;
    setStartingPay(orderId);

    const statusUrl = `/pedido/${orderId}?pay=1`;
    try {
      const fnUrl = import.meta.env.VITE_CREATE_MP_URL as string | undefined;
      if (fnUrl) {
        const resp = await fetch(fnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId }),
          mode: "cors",
        });
        const data = await resp.json().catch(() => ({}));
        const checkoutUrl =
          data?.init_point || data?.sandbox_init_point || data?.url || data?.redirectUrl;
        if (checkoutUrl) window.open(checkoutUrl, "_blank", "noopener");
      }
    } finally {
      setStartingPay(null);
      navigate(statusUrl, { replace: true });
    }
  }

  /** Cancela pedido pendente via Cloud Function (requer Authorization: Bearer <idToken>) */
  async function cancelOrder(orderId: string) {
    if (!orderId || canceling) return;
    const ok = window.confirm("Deseja realmente cancelar este pedido?");
    if (!ok) return;

    setCanceling(orderId);
    try {
      const direct = (import.meta.env as any).VITE_CANCEL_ORDER_HTTP as string | undefined;
      const base = (import.meta.env as any).VITE_CF_BASE as string | undefined;
      const url = direct || (base ? `${base}/cancelOrderHttp` : undefined);

      if (!url) {
        alert("Endpoint de cancelamento não configurado. Defina VITE_CANCEL_ORDER_HTTP ou VITE_CF_BASE.");
        return;
      }

      // pega o ID token do usuário logado
      const token = await auth.currentUser?.getIdToken?.();

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}), // << essencial
        },
        body: JSON.stringify({ orderId }),
        mode: "cors",
      });

      if (!resp.ok) {
        // ajuda no diagnóstico (401/403/5xx)
        const txt = await resp.text().catch(() => "");
        throw new Error(`Falha HTTP ${resp.status}: ${txt || "erro ao cancelar"}`);
      }

      // nada a fazer — o onSnapshot atualizará a lista automaticamente.
    } catch (e) {
      console.error("cancelOrder error:", e);
      alert("Não foi possível cancelar agora. Tente novamente.");
    } finally {
      setCanceling(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Meus pedidos</h1>

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="animate-pulse rounded-xl border px-4 py-3">
              <div className="mb-2 h-4 w-2/3 rounded bg-gray-200" />
              <div className="h-3 w-1/3 rounded bg-gray-200" />
            </li>
          ))}
        </ul>
      ) : !hasOrders ? (
        <p className="text-sm text-gray-500">Você ainda não possui pedidos.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const sKey = (o.status || "").toLowerCase();
            const isPending = ["pending", "awaiting_payment", "open", "opened"].includes(sKey);
            return (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-xl border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {o.projectTitle || "Projeto"} • <span className="text-gray-500">#{o.id}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Valor: {BRL.format(o.total || 0)} • Criado em: {fmtDate(o.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {statusChip(o.status)}

                  {/* Detalhes sempre disponível */}
                  <Link
                    className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                    to={`/portal/pedidos/${o.id}`}
                    aria-label={`Detalhes do pedido ${o.id}`}
                  >
                    Detalhes <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>

                  {/* Cancelar (somente pendentes) */}
                  {isPending && (
                    <button
                      onClick={() => cancelOrder(o.id)}
                      disabled={canceling === o.id}
                      className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-60"
                      title="Cancelar pedido"
                    >
                      {canceling === o.id ? "Cancelando…" : "Cancelar"}
                    </button>
                  )}

                  {/* Pagar agora (somente pendentes) */}
                  {isPending && (
                    <button
                      onClick={() => startPaymentFlow(o.id)}
                      disabled={startingPay === o.id}
                      className="inline-flex items-center rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                      {startingPay === o.id ? "Abrindo…" : "Pagar agora"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
