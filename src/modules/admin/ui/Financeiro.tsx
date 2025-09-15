import { useEffect, useMemo, useState } from "react";
import {
  watchOrdersByPeriod,
  type OrderDoc,
  type PeriodKey,
  isPaid, // helper para filtrar somente pedidos pagos
} from "../services/metricsService";
import {
  getTaxesConfig,
  saveTaxesConfig,
  estimateMpFee,
  computeTaxes,
  watchTaxesConfig,
  type TaxesConfig,
} from "../../config/services/taxesService";
import { Settings } from "lucide-react";

/* ---------------------- Formatação ---------------------- */

function BRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPctStringFromDec(dec: number) {
  const n = dec * 100;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}
function parsePctStringToDec(str: string) {
  const n = Number(str.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n / 100;
}

/** Normaliza método do pagamento para mapear a taxa MP */
function normalizeMethod(o: OrderDoc): "pix" | "cartao_credito" | "boleto" {
  const raw =
    o?.payment?.paymentMethod ??
    o?.payment?.method ??
    (o as any).paymentMethod ??
    "desconhecido";

  const r = String(raw).toLowerCase();
  if (r.includes("pix")) return "pix";
  if (r.includes("boleto")) return "boleto";
  return "cartao_credito";
}

/* ---------------------- Componente ---------------------- */

export default function Financeiro() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [cfg, setCfg] = useState<TaxesConfig | null>(null);

  // Modal de atualização do ISS
  const [issOpen, setIssOpen] = useState(false);
  const [issStr, setIssStr] = useState("");

  useEffect(() => {
    const offOrders = watchOrdersByPeriod(period, setOrders);
    const offCfg = watchTaxesConfig(setCfg);
    return () => {
      offOrders();
      offCfg();
    };
  }, [period]);

  // **Somente pedidos pagos/aprovados**
  const paid = useMemo(() => orders.filter(isPaid), [orders]);

  const totals = useMemo(() => {
    if (!cfg) {
      return {
        bruto: 0,
        tarifasMp: 0,
        tributos: 0,
        liquido: 0,
        porMetodo: [] as Array<{
          metodo: string;
          pedidos: number;
          bruto: number;
          tarifas: number;
          tributos: number;
          liquido: number;
        }>,
      };
    }

    const methodMap: Record<
      "pix" | "cartao_credito" | "boleto",
      { pedidos: number; bruto: number; tarifas: number; tributos: number }
    > = {
      pix: { pedidos: 0, bruto: 0, tarifas: 0, tributos: 0 },
      cartao_credito: { pedidos: 0, bruto: 0, tarifas: 0, tributos: 0 },
      boleto: { pedidos: 0, bruto: 0, tarifas: 0, tributos: 0 },
    };

    let bruto = 0;
    let tarifasMp = 0;
    let tributos = 0;

    for (const o of paid) {
      const total = Number(o.total || 0);
      const m = normalizeMethod(o);
      const fee = estimateMpFee(total, m, cfg);
      const t = computeTaxes(total, cfg).total;

      bruto += total;
      tarifasMp += fee;
      tributos += t;

      methodMap[m].pedidos += 1;
      methodMap[m].bruto += total;
      methodMap[m].tarifas += fee;
      methodMap[m].tributos += t;
    }

    const porMetodo = (Object.keys(methodMap) as Array<
      "pix" | "cartao_credito" | "boleto"
    >).map((k) => {
      const x = methodMap[k];
      return {
        metodo:
          k === "pix" ? "PIX" : k === "boleto" ? "Boleto" : "Cartão de Crédito",
        pedidos: x.pedidos,
        bruto: x.bruto,
        tarifas: x.tarifas,
        tributos: x.tributos,
        liquido: x.bruto - x.tarifas - x.tributos,
      };
    });

    return {
      bruto,
      tarifasMp,
      tributos,
      liquido: bruto - tarifasMp - tributos,
      porMetodo,
    };
  }, [paid, cfg]);

  /* ------------- Modal: Atualização rápida do ISS ------------- */

  const openIss = async () => {
    const c = cfg ?? (await getTaxesConfig());
    setIssStr(fmtPctStringFromDec(c.taxes.iss || 0));
    setIssOpen(true);
  };

  const saveIss = async () => {
    const issDec = parsePctStringToDec(issStr);
    // agora aceita objeto parcial aninhado
    await saveTaxesConfig({ taxes: { iss: issDec } });
    setIssOpen(false);
  };

  /* ---------------------- UI ---------------------- */

  return (
    <div className="space-y-6">
      {/* Filtros de período */}
      <div className="flex items-center gap-2">
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
      </div>

      {/* Cards resumidos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="p-4 bg-white border rounded-xl">
          <div className="text-sm text-slate-600">Recebido (bruto)</div>
          <div className="text-2xl font-bold">{BRL(totals.bruto)}</div>
        </div>

        <div className="p-4 bg-white border rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Tarifas MP (estim.)</div>
          </div>
          <div className="text-2xl font-bold">{BRL(totals.tarifasMp)}</div>
        </div>

        <div className="p-4 bg-white border rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Tributos (estim.)</div>
            <button
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200"
              onClick={openIss}
              title="Atualizar ISS rapidamente"
            >
              <Settings className="w-3.5 h-3.5" />
              Atualizar ISS
            </button>
          </div>
          <div className="text-2xl font-bold">{BRL(totals.tributos)}</div>
          {cfg && (
            <div className="text-xs text-slate-500 mt-1">
              ISS atual: {fmtPctStringFromDec(cfg.taxes.iss)}%
            </div>
          )}
        </div>

        <div className="p-4 bg-white border rounded-xl">
          <div className="text-sm text-slate-600">Líquido (estim.)</div>
          <div className="text-2xl font-bold">{BRL(totals.liquido)}</div>
        </div>
      </div>

      {/* Tabela por método */}
      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Método", "Pedidos", "Bruto", "Tarifas", "Tributos", "Líquido"].map(
                (h) => (
                  <th key={h} className="p-3 text-left">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
        <tbody>
            {totals.porMetodo.map((r) => (
              <tr key={r.metodo} className="border-b">
                <td className="p-3">{r.metodo}</td>
                <td className="p-3">{r.pedidos}</td>
                <td className="p-3">{BRL(r.bruto)}</td>
                <td className="p-3">{BRL(r.tarifas)}</td>
                <td className="p-3">{BRL(r.tributos)}</td>
                <td className="p-3">{BRL(r.liquido)}</td>
              </tr>
            ))}
            {!totals.porMetodo.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  Sem pedidos pagos no período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de atualização rápida do ISS */}
      {issOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-sm p-5 bg-white rounded-xl shadow-lg">
            <div className="font-semibold text-lg">Atualizar ISS</div>
            <p className="text-sm text-slate-600 mt-1">
              Informe o ISS do mês (em %). Ex.: <b>2,21</b>.
            </p>
            <label className="block text-sm mt-4">ISS (%)</label>
            <input
              className="w-full mt-1 p-2 border rounded"
              inputMode="decimal"
              value={issStr}
              onChange={(e) => setIssStr(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="ex.: 2,21"
            />

            <div className="flex justify-end gap-2 mt-5">
              <button
                className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200"
                onClick={() => setIssOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={saveIss}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        As taxas e tributos utilizados aqui vêm de <b>Configurações → Configurações</b>.
        Apenas pedidos pagos/aprovados entram nos cálculos.
      </p>
    </div>
  );
}
