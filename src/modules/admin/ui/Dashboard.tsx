// src/modules/admin/ui/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import KpiCard from "./components/KpiCard";
import { DollarSign, ShoppingCart, BarChart2, FileText } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  computeMetrics,
  watchOrdersByPeriod,
  type OrderDoc,
  type PeriodKey,
} from "../services/metricsService";

const COLORS = ["#4f46e5", "#06b6d4", "#f59e0b", "#10b981", "#ef4444"];

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [orders, setOrders] = useState<OrderDoc[]>([]);

  useEffect(() => {
    const off = watchOrdersByPeriod(period, setOrders);
    return () => off();
  }, [period]);

  const metrics = useMemo(() => computeMetrics(orders), [orders]);

  return (
    <div className="space-y-8">
      {/* Filtro de período */}
      <div className="flex items-center gap-3">
        {(["today", "7d", "30d", "90d"] as PeriodKey[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              period === p ? "bg-indigo-600 text-white" : "bg-slate-100"
            }`}
          >
            {p === "today" ? "Hoje" : `Últimos ${p}`}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Receita Bruta"
          value={formatCurrency(metrics.grossRevenue)}
          icon={DollarSign}
        />
        <KpiCard
          title="Pedidos Pagos"
          value={metrics.paidCount}
          icon={ShoppingCart}
        />
        <KpiCard
          title="Ticket Médio"
          value={formatCurrency(metrics.ticket)}
          icon={BarChart2}
        />
        <KpiCard
          title="NF-e Pendentes"
          value={metrics.pendingInvoices}
          icon={FileText}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="p-6 bg-white border rounded-xl lg:col-span-2">
          <h3 className="mb-2 font-semibold">Receita por Dia</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={metrics.revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <Tooltip
                formatter={(v: any) => formatCurrency(Number(v))}
                labelFormatter={(v) => `Dia ${v}`}
              />
              <Line type="monotone" dataKey="Receita" stroke="#4f46e5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-6 bg-white border rounded-xl">
          <h3 className="mb-2 font-semibold">Métodos de Pagamento</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={metrics.paymentMethodData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {metrics.paymentMethodData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
