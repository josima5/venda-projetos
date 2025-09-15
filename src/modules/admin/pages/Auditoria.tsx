// src/modules/admin/pages/Auditoria.tsx
import { useEffect, useState } from "react";
import { Star, StarOff } from "lucide-react";

/* ------------------- Tipos e Dados de Exemplo (Mocks) ------------------- */

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "payment"
  | "file_upload"
  | "login"
  | "custom";

export type AuditPeriod = "today" | "7d" | "30d" | "90d" | "all";
export type AuditSeverity = "info" | "alert" | "critical";

export interface AuditComment {
  id: string;
  ts: number;
  text: string;
  author?: { id: string; name?: string; email?: string };
}

export interface AuditLog {
  id: string;
  ts: number;
  action: AuditAction;
  summary?: string;
  important?: boolean;
  severity?: AuditSeverity;
  actor?: { id: string; name?: string; email?: string };
  // Mantido por compatibilidade; não exibimos mais:
  entity?: { type: string; id: string };
  comments?: AuditComment[];
}

/* ---------------------- Base de dados de exemplo ----------------------- */
const MOCK_DB: AuditLog[] = [
  {
    id: "log_1",
    ts: Date.now() - 86400000 * 1,
    action: "update",
    summary: "Configurações de pagamento atualizadas",
    actor: { id: "user_a", name: "Alice", email: "alice@example.com" },
    entity: { type: "settings", id: "payment_gateway" },
    severity: "critical",
    important: true,
    comments: [
      {
        id: "c1",
        ts: Date.now() - 86400000 * 1 + 60000,
        text: "Alteração confirmada pelo time financeiro.",
        author: { id: "admin_user", name: "Admin" },
      },
    ],
  },
  {
    id: "log_2",
    ts: Date.now() - 86400000 * 2,
    action: "create",
    summary: "Novo projeto 'Orion' criado",
    actor: { id: "user_b", name: "Bob", email: "bob@example.com" },
    entity: { type: "project", id: "proj_orion" },
    severity: "info",
  },
  {
    id: "log_3",
    ts: Date.now() - 86400000 * 5,
    action: "login",
    summary: "Login bem-sucedido",
    actor: { id: "user_a", name: "Alice", email: "alice@example.com" },
    entity: { type: "customer", id: "cust_123" },
    severity: "info",
  },
  {
    id: "log_4",
    ts: Date.now() - 86400000 * 10,
    action: "delete",
    summary: "Pedido #ORD-555 cancelado",
    actor: { id: "system", name: "Sistema" },
    entity: { type: "order", id: "ORD-555" },
    severity: "alert",
  },
];

/* -------------------------- Serviço mockado ---------------------------- */
type WatchFilters = {
  period: AuditPeriod;
  text: string | null;
  action: AuditAction | null;
  severity: AuditSeverity | null;
};

const watchAudit = (filters: WatchFilters, callback: (logs: AuditLog[]) => void) => {
  let results = [...MOCK_DB];

  if (filters.text) {
    const txt = filters.text.toLowerCase();
    results = results.filter((r) => JSON.stringify(r).toLowerCase().includes(txt));
  }
  if (filters.action) {
    results = results.filter((r) => r.action === filters.action);
  }
  if (filters.severity) {
    results = results.filter((r) => r.severity === filters.severity);
  }

  const now = new Date();
  const periodMap: Record<AuditPeriod, number> = {
    today: new Date().setHours(0, 0, 0, 0),
    "7d": new Date().setDate(now.getDate() - 7),
    "30d": new Date().setDate(now.getDate() - 30),
    "90d": new Date().setDate(now.getDate() - 90),
    all: 0,
  };
  results = results.filter((r) => r.ts >= periodMap[filters.period]);

  callback(results.sort((a, b) => b.ts - a.ts));
  return () => {
    /* cleanup */
  };
};

const toCSV = (rows: AuditLog[]): string => {
  if (!rows.length) return "";
  const headers = "ID,Timestamp,Action,Summary,Actor\n";
  const body = rows
    .map(
      (r) =>
        `"${r.id}","${new Date(r.ts).toISOString()}","${r.action}","${(r.summary ?? "").replace(
          /"/g,
          '""'
        )}","${(r.actor?.name ?? "").replace(/"/g, '""')}"`,
    )
    .join("\n");
  return headers + body;
};

const downloadCSV = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

const toggleImportant = async (id: string, important: boolean): Promise<void> => {
  const log = MOCK_DB.find((r) => r.id === id);
  if (log) log.important = important;
};

const addAuditComment = async (id: string, text: string): Promise<AuditComment> => {
  const log = MOCK_DB.find((r) => r.id === id);
  const newComment: AuditComment = {
    id: `comment_${Date.now()}`,
    ts: Date.now(),
    text,
    author: { id: "current_user", name: "Usuário Atual" },
  };
  if (log) {
    if (!log.comments) log.comments = [];
    log.comments.push(newComment);
  }
  return newComment;
};

/* -------------------------------- Utils -------------------------------- */
function fmtDate(ms: number) {
  try {
    return new Date(ms).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

/* ------------------------------ Constantes ------------------------------ */
const ACTIONS: AuditAction[] = [
  "create",
  "update",
  "delete",
  "status_change",
  "payment",
  "file_upload",
  "login",
  "custom",
];

const SEVERITIES: AuditSeverity[] = ["info", "alert", "critical"];

/* -------------------------------- Página -------------------------------- */
export default function Auditoria() {
  const [period, setPeriod] = useState<AuditPeriod>("30d");
  const [text, setText] = useState("");
  const [action, setAction] = useState<AuditAction | "">("");
  const [severity, setSeverityFilter] = useState<AuditSeverity | "">("");

  const [rows, setRows] = useState<AuditLog[]>([]);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const off = watchAudit(
      {
        period,
        action: (action || null) as AuditAction | null,
        text: text || null,
        severity: (severity || null) as AuditSeverity | null,
      },
      setRows,
    );
    return () => off();
  }, [period, text, action, severity]);

  const total = rows.length;

  const exportCsv = () => {
    downloadCSV(`auditoria_${period}.csv`, toCSV(rows));
  };

  return (
    <div className="space-y-6">
      {/* Header / Filtros — compatível com as demais páginas */}
      <div className="flex flex-wrap items-end gap-3">
        {/* períodos rápidos */}
        <div className="flex gap-2">
          {(["today", "7d", "30d", "90d", "all"] as AuditPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 text-sm font-semibold rounded-lg ${
                period === p ? "bg-indigo-600 text-white" : "bg-slate-100"
              }`}
            >
              {p === "today" ? "Hoje" : p === "all" ? "Tudo" : `Últimos ${p.replace("d", " dias")}`}
            </button>
          ))}
        </div>

        {/* filtros adicionais */}
        <input
          className="text-sm border rounded-lg px-3 py-2 min-w-[220px] outline-none"
          placeholder="Buscar (id, ação, ator...)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <select
          className="text-sm border rounded-lg px-2 py-2 outline-none"
          value={action}
          onChange={(e) => setAction(e.target.value as AuditAction | "")}
        >
          <option value="">Todas ações</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          className="text-sm border rounded-lg px-2 py-2 outline-none"
          value={severity}
          onChange={(e) => setSeverityFilter(e.target.value as AuditSeverity | "")}
        >
          <option value="">Todas severidades</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* ações à direita */}
        <div className="ml-auto flex gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50"
            title="Exportar CSV"
          >
            Exportar CSV ({total})
          </button>
        </div>
      </div>

      {/* Tabela — mantida como antes (overflow visível para o popover de Detalhes) */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-visible">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-gray-600">
            <tr>
              <th className="p-3 font-medium">Quando</th>
              <th className="p-3 font-medium">Ação</th>
              <th className="p-3 font-medium">Por</th>
              <th className="p-3 font-medium">Resumo</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap text-gray-500">{fmtDate(r.ts)}</td>
                <td className="p-3">
                  <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-zinc-50 text-zinc-700 ring-zinc-600/20">
                    {r.action}
                  </span>
                </td>
                <td className="p-3">
                  <div className="text-xs">
                    {r.actor?.name ?? "—"}
                    {r.actor?.email ? (
                      <div className="text-[11px] text-zinc-500">{r.actor.email}</div>
                    ) : null}
                  </div>
                </td>
                <td className="p-3 text-gray-800">{r.summary ?? "—"}</td>
                <td className="p-3 text-right relative">
                  <div className="flex items-center gap-2 justify-end">
                    {/* Botão de importante */}
                    <button
                      className={`rounded-md border p-1.5 ${
                        r.important ? "text-amber-500" : "text-gray-500"
                      } hover:bg-gray-100`}
                      title={r.important ? "Desmarcar importante" : "Marcar importante"}
                      onClick={async () => {
                        setRows((cur) =>
                          cur.map((x) => (x.id === r.id ? { ...x, important: !r.important } : x)),
                        );
                        try {
                          await toggleImportant(r.id, !r.important);
                        } catch {}
                      }}
                    >
                      {r.important ? (
                        <Star className="w-4 h-4 fill-amber-400" />
                      ) : (
                        <StarOff className="w-4 h-4" />
                      )}
                    </button>

                    {/* Detalhes: SOMENTE COMENTÁRIOS */}
                    <details className="inline-block text-left">
                      <summary className="cursor-pointer text-indigo-600 hover:underline text-xs font-medium p-1.5">
                        Detalhes
                      </summary>
                      <div className="absolute right-0 top-full mt-2 w-[min(90vw,720px)] z-20 rounded-md bg-white shadow-lg ring-1 ring-black/10 p-4 space-y-4">
                        <div className="rounded border p-2">
                          <div className="text-xs font-semibold mb-1">Comentários</div>
                          <div className="space-y-2">
                            {(r.comments ?? []).map((c: AuditComment) => (
                              <div key={c.id} className="text-xs">
                                <div className="text-[11px] text-zinc-500">
                                  {fmtDate(c.ts)} — {c.author?.name ?? c.author?.email ?? "Sistema"}
                                </div>
                                <div>{c.text}</div>
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <input
                                className="flex-1 rounded border-gray-300 px-2 py-1 text-xs"
                                placeholder="Adicionar comentário…"
                                value={commentDraft[r.id] ?? ""}
                                onChange={(e) =>
                                  setCommentDraft((m) => ({ ...m, [r.id]: e.target.value }))
                                }
                                onKeyDown={async (e) => {
                                  if (e.key !== "Enter") return;
                                  const txt = (commentDraft[r.id] ?? "").trim();
                                  if (!txt) return;
                                  setCommentDraft((m) => ({ ...m, [r.id]: "" }));
                                  try {
                                    const comment = await addAuditComment(r.id, txt);
                                    setRows((cur) =>
                                      cur.map((x) =>
                                        x.id === r.id
                                          ? { ...x, comments: [...(x.comments ?? []), comment] }
                                          : x,
                                      ),
                                    );
                                  } catch {}
                                }}
                              />
                              <button
                                className="rounded-md border px-2 py-1 text-xs bg-white hover:bg-gray-50"
                                onClick={async () => {
                                  const txt = (commentDraft[r.id] ?? "").trim();
                                  if (!txt) return;
                                  setCommentDraft((m) => ({ ...m, [r.id]: "" }));
                                  try {
                                    const comment = await addAuditComment(r.id, txt);
                                    setRows((cur) =>
                                      cur.map((x) =>
                                        x.id === r.id
                                          ? { ...x, comments: [...(x.comments ?? []), comment] }
                                          : x,
                                      ),
                                    );
                                  } catch {}
                                }}
                              >
                                Comentar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  Nenhum evento encontrado para o filtro atual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 text-center">
        Os eventos exibidos aqui são registros de atividades no sistema.
      </p>
    </div>
  );
}
