import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

type Addon = { id: string; label: string; price: number };
type PaymentInfo = {
  gateway?: string;
  paymentId?: string;
  rawStatus?: string;
  paymentMethod?: string;
  installments?: number;
  amount?: number;
  paidAt?: Timestamp | null;
  init_point?: string;          // ← ADICIONADO: link do checkout
};

type OrderDoc = {
  projectId: string;
  projectTitle?: string;
  mainImageUrl?: string;
  basePrice: number;
  addons?: Addon[];
  addonsTotal?: number;
  total: number;
  status: "pending" | "paid" | "canceled";
  customerUid?: string | null;
  customer?: { name?: string; email?: string; phone?: string };
  payment?: PaymentInfo;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const db = getFirestore(getApp());
    const ref = doc(db, "orders", id);

    const off = onSnapshot(
      ref,
      (snap) => {
        setOrder(snap.exists() ? (snap.data() as OrderDoc) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => off();
  }, [id]);

  if (!id) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-slate-600">Pedido sem ID informado.</p>
          <Link to="/" className="underline">← Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold">Detalhes do Pedido</h1>
        <p className="text-sm text-slate-500">ID: <span className="font-mono">{id}</span></p>

        {loading && <p className="text-slate-500">Carregando…</p>}

        {!loading && !order && (
          <div className="space-y-2">
            <p className="text-slate-600">Pedido não encontrado.</p>
            <Link to="/" className="underline">← Voltar para a Home</Link>
          </div>
        )}

        {!!order && (
          <div className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-4">
              {order.mainImageUrl ? (
                <img
                  src={order.mainImageUrl}
                  alt=""
                  className="w-24 h-24 object-cover rounded"
                />
              ) : null}
              <div>
                <div className="text-sm text-slate-500">Projeto</div>
                <div className="font-medium">
                  {order.projectTitle || order.projectId}
                </div>
              </div>
              <div className="ml-auto">
                <span className="px-2 py-1 rounded text-xs border capitalize">
                  {order.status}
                </span>
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-500 mb-1">Itens</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Base: R$ {Number(order.basePrice).toFixed(2)}</li>
                {(order.addons || []).map((a) => (
                  <li key={a.id}>
                    {a.label} — R$ {Number(a.price || 0).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-right text-lg font-semibold">
              Total: R$ {Number(order.total || 0).toFixed(2)}
            </div>

            <div className="text-sm text-slate-600 space-y-1">
              <div>
                <span className="font-medium">Pagamento:</span>{" "}
                {order.payment?.rawStatus ?? "—"}
              </div>
              {order.payment?.paymentMethod && (
                <div>Método: {order.payment.paymentMethod}</div>
              )}
              {order.payment?.installments ? (
                <div>Parcelas: {order.payment.installments}</div>
              ) : null}
              {order.payment?.amount ? (
                <div>Valor pago: R$ {Number(order.payment.amount).toFixed(2)}</div>
              ) : null}
            </div>

            {/* Botão para pagar, se ainda pendente e com link salvo */}
            {order.status === "pending" && order.payment?.init_point && (
              <a
                href={order.payment.init_point}
                className="inline-block rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700"
              >
                Pagar no Mercado Pago
              </a>
            )}
          </div>
        )}

        <Link to="/" className="inline-block underline">
          ← Voltar para a Home
        </Link>
      </div>
    </div>
  );
}
