import { useEffect, useMemo, useState } from "react";
import {
  watchOrdersByPeriod,
  type OrderDoc,
  type PeriodKey,
} from "../services/metricsService";
import { Search, Download } from "lucide-react";
import { downloadCsv } from "../services/exportCsv";
import { useNavigate } from "react-router-dom";

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
  return dt ? dt.toLocaleDateString("pt-BR") : "-";
}
function methodLabel(o: OrderDoc) {
  const raw =
    o?.payment?.paymentMethod ?? o?.payment?.method ?? (o as any).paymentMethod ?? "desconhecido";
  const map: Record<string, string> = {
    pix: "PIX",
    card: "Cartão",
    cartao_credito: "Cartão",
    boleto: "Boleto",
    master: "Cartão", // compat testes
  };
  return map[raw] || String(raw);
}
function statusPt(o: OrderDoc) {
  const raw = (o.status || "").toLowerCase();
  const map: Record<string, string> = {
    paid: "PAGO",
    pending: "PENDENTE",
    canceled: "CANCELADO",
    refunded: "REEMBOLSADO",
    chargeback: "CHARGEBACK",
  };
  return map[raw] || raw.toUpperCase() || "-";
}

type Filters = {
  method: "all" | "pix" | "cartao_credito" | "card" | "boleto" | "desconhecido";
  q: string;
};

export default function Vendas() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [filters, setFilters] = useState<Filters>({
    method: "all",
    q: "",
  });

  useEffect(() => {
    const off = watchOrdersByPeriod(period, setOrders);
    return () => off();
  }, [period]);

  // Somente vendas pagas
  const filtered = useMemo(() => {
    return orders
      .filter((o) => (o.status || "").toLowerCase() === "paid")
      .filter((o) => {
        if (filters.method !== "all") {
          const m =
            o?.payment?.paymentMethod ??
            o?.payment?.method ??
            (o as any).paymentMethod ??
            "desconhecido";
          if (m !== filters.method) return false;
        }
        if (filters.q) {
          const q = filters.q.toLowerCase();
          const customerName = (o as any).customer?.name?.toLowerCase?.() ?? "";
          const customerEmail = (o as any).customer?.email?.toLowerCase?.() ?? "";
          const projectTitle = (o as any).project?.title?.toLowerCase?.() ?? "";
          if (
            !o.id.toLowerCase().includes(q) &&
            !customerName.includes(q) &&
            !customerEmail.includes(q) &&
            !projectTitle.includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const da = toDate(a.createdAt)?.getTime() ?? 0;
        const db = toDate(b.createdAt)?.getTime() ?? 0;
        return db - da;
      });
  }, [orders, filters]);

  const exportCsv = () => {
    const rows = filtered.map((o) => ({
      id: o.id,
      cliente: (o as any).customer?.name ?? "",
      email: (o as any).customer?.email ?? "",
      projeto: (o as any).project?.title ?? "",
      valor: (o.total ?? 0).toFixed(2).replace(".", ","),
      metodo: methodLabel(o),
      status: statusPt(o), // sempre "PAGO" aqui
      criado_em: formatDate(o.createdAt),
      pago_em: formatDate(o.paidAt),
      nfe: o.invoice?.status ?? "n/a",
    }));
    downloadCsv(`vendas_${period}`, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <h2 className="text-2xl font-bold">Vendas e Pedidos</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros (sem seletor de Status – esta página mostra somente PAGO) */}
      <div className="grid grid-cols-1 gap-4 p-4 bg-white border rounded-xl md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute w-5 h-5 top-2.5 left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID, cliente, e-mail, projeto..."
            className="w-full py-2 pl-10 pr-3 border rounded-lg"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>

        <select
          value={filters.method}
          onChange={(e) =>
            setFilters((f) => ({ ...f, method: e.target.value as Filters["method"] }))
          }
          className="w-full p-2 border rounded-lg"
        >
          <option value="all">Todos Métodos</option>
          <option value="pix">PIX</option>
          <option value="cartao_credito">Cartão</option>
          <option value="card">Cartão (alt)</option>
          <option value="boleto">Boleto</option>
          <option value="desconhecido">Desconhecido</option>
        </select>

        <div className="flex gap-2">
          {(["today", "7d", "30d", "90d"] as PeriodKey[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border ${
                period === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"
              }`}
            >
              {p === "today" ? "Hoje" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "ID",
                "Cliente",
                "Projeto",
                "Valor",
                "Método",
                "Status",
                "Criado em",
                "Pago em",
                "NF-e",
              ].map((h) => (
                <th key={h} className="p-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o.id}
                className="border-b hover:bg-slate-50 cursor-pointer"
                onClick={() => navigate(`/admin/vendas/${o.id}`)}
              >
                <td className="p-3 font-mono">{o.id}</td>
                <td className="p-3">
                  {(o as any).customer?.name ?? "-"}
                  <div className="text-xs text-slate-500">
                    {(o as any).customer?.email ?? ""}
                  </div>
                </td>
                <td className="p-3">{(o as any).project?.title ?? "-"}</td>
                <td className="p-3">{formatCurrency(o.total)}</td>
                <td className="p-3">{methodLabel(o)}</td>
                <td className="p-3">{statusPt(o)}</td>
                <td className="p-3">{formatDate(o.createdAt)}</td>
                <td className="p-3">{formatDate(o.paidAt)}</td>
                <td className="p-3">{o.invoice?.status ?? "n/a"}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500">
                  Nenhum pedido pago encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
