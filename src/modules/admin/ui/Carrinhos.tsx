import { useEffect, useMemo, useState } from "react";
import {
  watchOrdersByPeriod,
  type OrderDoc,
  type PeriodKey,
  isPending,
} from "../services/metricsService";
import {
  MessageCircle,
  Download,
  Search as SearchIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

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
function daysBetween(a: Date, b?: any) {
  const dt = toDate(b);
  if (!dt) return 0;
  return Math.max(0, Math.floor((a.getTime() - dt.getTime()) / 86_400_000));
}
function getStatus(o: OrderDoc): string {
  const s = (o as any).status;
  if (s) return String(s);
  return (o as any).paidAt ? "paid" : "pending";
}
function waLinkFromOrder(o: OrderDoc, customText?: string) {
  const raw = (o as any).customer?.phone ?? "";
  const digits = String(raw).replace(/\D/g, "");
  const phone = digits.length >= 10 ? `55${digits}` : digits; // BR
  const name = (o as any).customer?.name ?? "Olá";
  const text =
    customText ??
    `${name}, tudo bem? Notamos que seu pedido ainda não foi concluído e gostaríamos de ajudar.
    
Pedido: ${o.id}
Projeto: ${(o as any).project?.title ?? "-"}
Valor: ${BRL(o.total)}

Posso te auxiliar com o pagamento?`;
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
}

/** -------- recuperação local (etapas + notas) -------- */
type RecoveryStage = "novo" | "contatado" | "followup" | "convertido" | "desistiu";
type RecoveryNote = { stage: RecoveryStage; notes?: string; last?: number };
const LS_KEY = "carts/recovery/v1";
function readRecovery(): Record<string, RecoveryNote> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeRecovery(map: Record<string, RecoveryNote>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {}
}
/** ----------------------------------------------------- */

type SortKey = "createdAt" | "total" | "name";
type SortDir = "asc" | "desc";

export default function Carrinhos() {
  // dados
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [orders, setOrders] = useState<OrderDoc[]>([]);

  // recuperação local
  const [recMap, setRecMap] = useState<Record<string, RecoveryNote>>(() => readRecovery());
  useEffect(() => writeRecovery(recMap), [recMap]);

  // seleção em lote
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // filtros
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");
  const [phoneFilter, setPhoneFilter] = useState<"all" | "with" | "without">("all");
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<"all" | RecoveryStage>("all");

  // ordenação
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // carrega do serviço
  useEffect(() => {
    const off = watchOrdersByPeriod(period, setOrders);
    return () => off();
  }, [period]);

  // lista derivada + filtros
  const now = new Date();
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const min = Number(minValue || 0);
    const max = Number(maxValue || 0);

    let arr = orders.slice();

    // status
    if (statusFilter === "pending") arr = arr.filter(isPending);

    // busca
    if (term) {
      arr = arr.filter((o) => {
        const hay = `${(o as any).customer?.name ?? ""} ${(o as any).customer?.email ?? ""} ${(o as any).customer?.phone ?? ""} ${(o as any).project?.title ?? ""} ${o.id}`.toLowerCase();
        return hay.includes(term);
      });
    }

    // telefone
    if (phoneFilter !== "all") {
      const has = (o: OrderDoc) => /\d{10,}/.test(String((o as any).customer?.phone ?? "").replace(/\D/g, ""));
      arr = arr.filter((o) => (phoneFilter === "with" ? has(o) : !has(o)));
    }

    // faixa de valor
    if (min > 0) arr = arr.filter((o) => (o.total ?? 0) >= min);
    if (max > 0) arr = arr.filter((o) => (o.total ?? 0) <= max);

    // etapa
    if (stageFilter !== "all") {
      arr = arr.filter((o) => (recMap[o.id]?.stage ?? "novo") === stageFilter);
    }

    // ordenação
    arr.sort((a, b) => {
      let va = 0;
      let vb = 0;
      if (sortKey === "createdAt") {
        va = toDate(a.createdAt)?.getTime() ?? 0;
        vb = toDate(b.createdAt)?.getTime() ?? 0;
      } else if (sortKey === "total") {
        va = a.total ?? 0;
        vb = b.total ?? 0;
      } else if (sortKey === "name") {
        const na = String((a as any).customer?.name ?? "");
        const nb = String((b as any).customer?.name ?? "");
        return sortDir === "asc" ? na.localeCompare(nb) : nb.localeCompare(na);
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return arr;
  }, [
    orders,
    q,
    statusFilter,
    phoneFilter,
    minValue,
    maxValue,
    stageFilter,
    sortKey,
    sortDir,
    recMap,
  ]);

  // KPIs
  const kpis = useMemo(() => {
    const qtd = list.length;
    const valor = list.reduce((s, o) => s + (o.total ?? 0), 0);
    const ticket = qtd ? valor / qtd : 0;
    return { qtd, valor, ticket };
  }, [list]);

  // helpers recuperação
  const setStage = (id: string, stage: RecoveryStage) =>
    setRecMap((m) => ({ ...m, [id]: { ...(m[id] || { notes: "" }), stage, last: Date.now() } }));
  const setNotes = (id: string, notes: string) =>
    setRecMap((m) => ({ ...m, [id]: { ...(m[id] || { stage: "novo" }), notes, last: Date.now() } }));

  // seleção
  const allSelected = list.length > 0 && list.every((o) => selected[o.id]);
  const toggleAll = () => {
    if (allSelected) setSelected({});
    else {
      const next: Record<string, boolean> = {};
      list.forEach((o) => (next[o.id] = true));
      setSelected(next);
    }
  };

  // exportar csv
  function exportCsv() {
    const header = [
      "id",
      "status",
      "cliente",
      "email",
      "telefone",
      "projeto",
      "valor",
      "criado_em",
      "dias",
      "etapa",
      "anotacoes",
    ].join(";");
    const lines = list.map((o) => {
      const cust = (o as any).customer ?? {};
      const proj = (o as any).project ?? {};
      const stage = recMap[o.id]?.stage ?? "novo";
      const notes = (recMap[o.id]?.notes ?? "").replace(/\s+/g, " ").trim();
      return [
        o.id,
        getStatus(o),
        cust.name ?? "",
        cust.email ?? "",
        String(cust.phone ?? "").replace(/\D/g, ""),
        proj.title ?? "",
        o.total ?? 0,
        formatDate(o.createdAt),
        daysBetween(new Date(), o.createdAt),
        stage,
        notes,
      ]
        .map((v) => String(v).replace(/;/g, ","))
        .join(";");
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carrinhos_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // whatsapp em lote (abre uma aba por seleção)
  function openWhatsBatch() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    ids.forEach((id) => {
      const o = list.find((x) => x.id === id);
      if (!o) return;
      const link = waLinkFromOrder(o);
      if (link) window.open(link, "_blank");
    });
  }

  return (
    <div className="space-y-6">
      {/* filtros */}
      <div className="flex flex-wrap items-end gap-3">
        {/* período */}
        <div className="flex gap-2">
          {(["today", "7d", "30d", "90d"] as PeriodKey[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 text-sm font-semibold rounded-lg ${
                period === p ? "bg-indigo-600 text-white" : "bg-slate-100"
              }`}
            >
              {p === "today" ? "Hoje" : `Últimos ${p}`}
            </button>
          ))}
        </div>

        {/* busca */}
        <div className="relative">
          <SearchIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="Buscar nome, email, projeto, id, telefone…"
            className="pl-8 pr-3 py-2 rounded-lg border"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* status */}
        <select
          className="border rounded-lg px-2 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "pending" | "all")}
          title="Status"
        >
          <option value="pending">Apenas pendentes</option>
          <option value="all">Todos os status</option>
        </select>

        {/* telefone */}
        <select
          className="border rounded-lg px-2 py-2 text-sm"
          value={phoneFilter}
          onChange={(e) => setPhoneFilter(e.target.value as any)}
          title="Telefone"
        >
          <option value="all">Com e sem telefone</option>
          <option value="with">Somente com telefone</option>
          <option value="without">Somente sem telefone</option>
        </select>

        {/* faixa de valor */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Valor mín"
            className="w-28 border rounded-lg px-2 py-2 text-sm"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
          />
          <input
            type="number"
            placeholder="Valor máx"
            className="w-28 border rounded-lg px-2 py-2 text-sm"
            value={maxValue}
            onChange={(e) => setMaxValue(e.target.value)}
          />
        </div>

        {/* etapa */}
        <select
          className="border rounded-lg px-2 py-2 text-sm"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as any)}
          title="Etapa de recuperação"
        >
          <option value="all">Todas as etapas</option>
          <option value="novo">Novo</option>
          <option value="contatado">Contatado</option>
          <option value="followup">Follow-up</option>
          <option value="convertido">Convertido</option>
          <option value="desistiu">Desistiu</option>
        </select>

        {/* ações em lote */}
        <div className="ml-auto flex gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border"
            title="Exportar CSV"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button
            onClick={openWhatsBatch}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white"
            title="Abrir WhatsApp em lote"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp (lote)
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Carrinhos</div>
          <div className="text-xl font-semibold">{kpis.qtd}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Valor potencial</div>
          <div className="text-xl font-semibold">{BRL(kpis.valor)}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Ticket médio</div>
          <div className="text-xl font-semibold">{BRL(kpis.ticket)}</div>
        </div>
      </div>

      {/* tabela */}
      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="p-3 text-left">
                <button className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                  Cliente {sortKey === "name" ? (sortDir === "asc" ? <ChevronUp /> : <ChevronDown />) : null}
                </button>
              </th>
              <th className="p-3 text-left">Projeto</th>
              <th className="p-3 text-left">
                <button className="inline-flex items-center gap-1" onClick={() => toggleSort("total")}>
                  Valor {sortKey === "total" ? (sortDir === "asc" ? <ChevronUp /> : <ChevronDown />) : null}
                </button>
              </th>
              <th className="p-3 text-left">
                <button className="inline-flex items-center gap-1" onClick={() => toggleSort("createdAt")}>
                  Criado em {sortKey === "createdAt" ? (sortDir === "asc" ? <ChevronUp /> : <ChevronDown />) : null}
                </button>
              </th>
              <th className="p-3 text-left">Dias</th>
              <th className="p-3 text-left">Etapa</th>
              <th className="p-3 text-left">Notas</th>
              <th className="p-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => {
              const wa = waLinkFromOrder(o);
              const cust = (o as any).customer ?? {};
              const proj = (o as any).project ?? {};
              const stage = recMap[o.id]?.stage ?? "novo";
              const notes = recMap[o.id]?.notes ?? "";
              const age = daysBetween(now, o.createdAt);
              return (
                <tr key={o.id} className="border-b align-top">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={!!selected[o.id]}
                      onChange={(e) =>
                        setSelected((s) => ({ ...s, [o.id]: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{cust.name ?? "-"}</div>
                    <div className="text-xs text-slate-500">{cust.email ?? ""}</div>
                    <div className="text-[11px] text-slate-500">{cust.phone ?? ""}</div>
                  </td>
                  <td className="p-3">{proj.title ?? "-"}</td>
                  <td className="p-3">{BRL(o.total)}</td>
                  <td className="p-3">{formatDate(o.createdAt)}</td>
                  <td className="p-3">{age}</td>
                  <td className="p-3">
                    <select
                      className="border rounded px-2 py-1 text-xs"
                      value={stage}
                      onChange={(e) => setStage(o.id, e.target.value as RecoveryStage)}
                    >
                      <option value="novo">Novo</option>
                      <option value="contatado">Contatado</option>
                      <option value="followup">Follow-up</option>
                      <option value="convertido">Convertido</option>
                      <option value="desistiu">Desistiu</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <textarea
                      className="w-56 h-16 border rounded p-1 text-xs"
                      placeholder="Anotações…"
                      value={notes}
                      onChange={(e) => setNotes(o.id, e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-600 text-white"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">sem telefone</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500">
                  Nenhum carrinho correspondente aos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Carrinhos listam pedidos não pagos. Use as etapas de recuperação para acompanhar follow-ups e o
        export CSV para operar em outras ferramentas.
      </p>
    </div>
  );
}
