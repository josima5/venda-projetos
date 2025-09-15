// src/modules/pedidos/ui/OrderStatusPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

type OrderDoc = {
  status: "pending" | "paid" | "canceled";
  projectId?: string;
  projectTitle?: string;
  total?: number;
  payment?: {
    method?: string;
    installments?: number;
    gateway?: string;
    rawStatus?: string;
    paymentMethod?: string;
    amount?: number;
    init_point?: string;
  };
};

function reais(n = 0) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  } catch {
    return `R$ ${Number(n || 0).toFixed(2)}`;
  }
}

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [noPermission, setNoPermission] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [triedOpen, setTriedOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth(getApp());
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try { await signInAnonymously(auth); } catch {}
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!id || !authReady) return;
    const db = getFirestore(getApp());
    const ref = doc(db, "orders", id);
    const stop = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        setOrder(snap.data() as OrderDoc);
      },
      (err) => {
        setLoading(false);
        if ((err as any).code === "permission-denied") {
          setNoPermission("Sem permissão para visualizar este pedido.");
        }
      }
    );
    return () => stop();
  }, [id, authReady]);

  useEffect(() => {
    const initPoint = order?.payment?.init_point;
    const params = new URLSearchParams(location.search);
    const mustOpen = params.get("pay") === "1";

    if (!initPoint || !mustOpen || triedOpen) return;

    try { window.history.replaceState({}, "", location.pathname); } catch {}

    const w = window.open(initPoint, "_blank", "noopener,noreferrer");
    const opened = !!(w && !w.closed);
    if (!opened) {
      try { window.location.assign(initPoint); }
      catch {
        const a = document.createElement("a");
        a.href = initPoint; a.target = "_self"; a.rel = "noopener noreferrer";
        document.body.appendChild(a); a.click(); a.remove();
      }
    }
    setTriedOpen(true);
  }, [order?.payment?.init_point, location.pathname, location.search, triedOpen]);

  if (!id) {
    return <div className="max-w-4xl mx-auto px-4 py-10"><p className="text-slate-600">ID do pedido ausente.</p></div>;
  }
  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-10"><p className="text-slate-600">Carregando status do pedido…</p></div>;
  }
  if (noPermission) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <p className="text-red-700">{noPermission}</p>
        <button className="underline" onClick={() => navigate("/")}>Voltar para a Home</button>
      </div>
    );
  }
  if (notFound || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <p className="text-slate-600">Pedido não encontrado.</p>
        <button className="underline" onClick={() => navigate("/")}>Voltar para a Home</button>
      </div>
    );
  }

  const isPaid = order.status === "paid";
  const isCanceled = order.status === "canceled";
  const isPending = order.status === "pending";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-xl font-semibold">Status do pedido</h1>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm space-y-1">
          <div>
            <span className="text-zinc-600">Produto: </span>
            <span className="font-medium">{order.projectTitle || "Projeto"}</span>
          </div>
          <div>
            <span className="text-zinc-600">Total: </span>
            <span className="font-medium">{reais(order.total || order.payment?.amount || 0)}</span>
          </div>
          <div>
            <span className="text-zinc-600">Pagamento: </span>
            <span className="font-medium">
              {order.payment?.method?.toUpperCase() || order.payment?.paymentMethod || "—"}
              {order.payment?.installments && order.payment?.installments > 1
                ? ` (${order.payment?.installments}x)` : ""}
            </span>
          </div>
          <div>
            <span className="text-zinc-600">Gateway: </span>
            <span className="font-medium">{order.payment?.gateway || "mercadopago"}</span>
          </div>
          {order.payment?.rawStatus && (
            <div>
              <span className="text-zinc-600">Status no gateway: </span>
              <span className="font-medium">{order.payment.rawStatus}</span>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {isPaid && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-700">
              Pagamento aprovado! 🎉 Obrigado pela compra.
            </div>
          )}

          {isPending && (
            <>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-700">
                Estamos aguardando a confirmação do pagamento.
                {order.payment?.method === "pix" && " Geralmente o PIX confirma em segundos."}
                {order.payment?.method === "ticket" && " O boleto pode levar até 3 dias úteis."}
                <div className="text-xs text-amber-600 mt-1">
                  Esta página atualiza automaticamente quando o pagamento for confirmado.
                </div>
              </div>

              {order.payment?.init_point && (
                <a
                  href={order.payment.init_point}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700"
                >
                  Abrir pagamento
                </a>
              )}
            </>
          )}

          {isCanceled && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700">
              Pagamento cancelado ou rejeitado.
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {order.projectId && (
          <button className="underline" onClick={() => navigate(`/projeto/${order.projectId}`)}>
            Voltar para o projeto
          </button>
        )}
        <button className="underline" onClick={() => navigate("/")}>Voltar para a Home</button>
      </div>
    </div>
  );
}
