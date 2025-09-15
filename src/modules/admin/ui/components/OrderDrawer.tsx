// src/modules/admin/ui/components/OrderDrawer.tsx
import { X, CheckCircle } from "lucide-react";
import type { OrderDoc } from "../../services/metricsService";

type Props = {
  open: boolean;
  order: OrderDoc | null;
  onClose: () => void;
};

function formatCurrency(n?: number) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function toDate(d: any): Date | null {
  if (!d) return null;
  if (d?.toDate) return d.toDate();
  if (d instanceof Date) return d;
  return null;
}
function formatDate(d: any) {
  const dt = toDate(d);
  return dt ? dt.toLocaleString("pt-BR") : "-";
}
function methodLabel(o: OrderDoc) {
  const raw =
    o?.payment?.paymentMethod ?? o?.payment?.method ?? (o as any).paymentMethod ?? "desconhecido";
  const map: Record<string, string> = {
    pix: "PIX",
    card: "Cartão",
    cartao_credito: "Cartão",
    boleto: "Boleto",
  };
  return map[raw] || String(raw);
}

export default function OrderDrawer({ open, order, onClose }: Props) {
  if (!open || !order) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Pedido {order.id}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100"
          >
            <X />
          </button>
        </div>

        <div className="p-6 space-y-6 text-slate-700">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border">
              <p className="text-sm text-slate-500">Valor</p>
              <p className="text-xl font-bold">{formatCurrency(order.total)}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border">
              <p className="text-sm text-slate-500">Status</p>
              <p className="text-xl font-bold capitalize">{order.status}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border">
              <p className="text-sm text-slate-500">Método</p>
              <p className="text-xl font-bold">{methodLabel(order)}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border">
              <p className="text-sm text-slate-500">NF-e</p>
              <p className="text-xl font-bold">{order.invoice?.status ?? "n/a"}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border">
            <h3 className="font-semibold mb-3">Timeline</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <CheckCircle className="text-blue-500" />
                <div>
                  <p>Pedido criado</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
              </li>
              {order.paidAt ? (
                <li className="flex gap-3">
                  <CheckCircle className="text-green-500" />
                  <div>
                    <p>Pagamento confirmado</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(order.paidAt)}
                    </p>
                  </div>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg">
              Reenviar e-mail
            </button>
            <button className="px-4 py-2 text-sm font-semibold rounded-lg border">
              Copiar link de download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
