import { useEffect, useMemo, useState } from "react";
import {
  watchOrdersByPeriod,
  type OrderDoc,
  type PeriodKey,
  isPaid,
} from "../services/metricsService";
// caminho correto: serviço fica no módulo de pedidos
import { setInvoiceStatus } from "../../pedidos/services/ordersService";
import { Check, X, Hash } from "lucide-react";

function BRL(n?: number) {
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
  return dt ? dt.toLocaleDateString("pt-BR") : "-";
}

// helper para acessar o número da NFS-e sem erro de tipagem
function invNumber(o: OrderDoc): string | null {
  return ((o as any)?.invoice?.number ?? null) as string | null;
}

type Tab = "pendentes" | "enviadas";

export default function Fiscal() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [tab, setTab] = useState<Tab>("pendentes");
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const off = watchOrdersByPeriod(period, setOrders);
    return () => off();
  }, [period]);

  const list = useMemo(() => {
    return orders
      .filter(isPaid)
      .filter((o) =>
        tab === "pendentes"
          ? ((o as any).invoice?.status ?? "pending") !== "sent"
          : ((o as any).invoice?.status ?? "pending") === "sent"
      )
      .sort((a, b) => {
        const da = toDate((a as any).paidAt)?.getTime() ?? 0;
        const db = toDate((b as any).paidAt)?.getTime() ?? 0;
        return db - da;
      });
  }, [orders, tab]);

  const mark = async (o: OrderDoc, status: "sent" | "pending") => {
    setBusyId(o.id);
    let number: string | null | undefined = undefined;
    if (status === "sent") {
      number = window.prompt("Número da NFS-e (opcional):", invNumber(o) ?? "") ?? undefined;
    }
    await setInvoiceStatus(o.id, status, { number });
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      {/* Filtros top */}
      <div className="flex items-center gap-3">
        {(["today", "7d", "30d", "90d"] as PeriodKey[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${
              period === p ? "bg-indigo-600 text-white" : "bg-slate-100"
            }`}
          >
            {p === "today" ? "Hoje" : `Últimos ${p}`}
          </button>
        ))}

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setTab("pendentes")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              tab === "pendentes" ? "bg-indigo-600 text-white" : "bg-slate-100"
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setTab("enviadas")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              tab === "enviadas" ? "bg-indigo-600 text-white" : "bg-slate-100"
            }`}
          >
            Enviadas
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Pedido", "Cliente", "Valor", "Data Pgto.", "NFS-e", "Ação"].map((h) => (
                <th key={h} className="p-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="p-3 font-mono">{o.id}</td>
                <td className="p-3">
                  {(o as any).customer?.name ?? "-"}
                  <div className="text-xs text-slate-500">
                    {(o as any).customer?.email ?? ""}
                  </div>
                </td>
                <td className="p-3">{BRL((o as any).total)}</td>
                <td className="p-3">{formatDate((o as any).paidAt)}</td>
                <td className="p-3">
                  {invNumber(o) ? (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5">
                      <Hash className="w-3 h-3" /> {invNumber(o)}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="p-3">
                  {tab === "pendentes" ? (
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50"
                      onClick={() => mark(o, "sent")}
                      disabled={busyId === o.id}
                      title="Marcar como NF-e Enviada"
                    >
                      <Check className="w-4 h-4" /> Marcar Enviada
                    </button>
                  ) : (
                    <button
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-50"
                      onClick={() => mark(o, "pending")}
                      disabled={busyId === o.id}
                      title="Voltar para Pendente"
                    >
                      <X className="w-4 h-4" /> Voltar
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {!list.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  Nenhum pedido {tab === "pendentes" ? "pendente" : "com NF-e enviada"} no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        A emissão da NF-e é feita fora do sistema (Prefeitura). Use este painel
        para controlar manualmente o que já foi enviado. Somente pedidos{" "}
        <b>pagos/aprovados</b> são exibidos aqui.
      </p>
    </div>
  );
}
