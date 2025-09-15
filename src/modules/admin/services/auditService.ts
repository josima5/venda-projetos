// Módulo de auditoria - persistência local (localStorage) com pontos de troca para backend
// Se usar Firestore/SQL, troque somente as funções readAll/saveAll/updateOne/subscribe.

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "payment"
  | "file_upload"
  | "login"
  | "custom";

export type AuditEntityType = "project" | "order" | "customer" | "settings" | "addon" | "other";
export type AuditPeriod = "today" | "7d" | "30d" | "90d" | "all";
export type AuditSeverity = "info" | "alert" | "critical";

export type AuditActor = { id?: string; name?: string; email?: string };
export type AuditEntity = { type: AuditEntityType | string; id?: string; label?: string };
export type AuditDiff = Record<string, { from: unknown; to: unknown }>;

export type AuditComment = {
  id: string;
  ts: number;
  text: string;
  author?: { name?: string; email?: string };
};

export type AuditLog = {
  id: string;
  ts: number; // epoch ms
  action: AuditAction;
  actor?: AuditActor;
  entity?: AuditEntity;
  summary?: string;
  before?: unknown;
  after?: unknown;
  diff?: AuditDiff;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
  /** campos adicionados */
  important?: boolean;
  severity?: AuditSeverity;
  comments?: AuditComment[];
};

export type CreateAuditInput = Omit<AuditLog, "id" | "ts" | "diff"> & {
  before?: unknown;
  after?: unknown;
};

const STORAGE_KEY = "__audit_logs__";

/* ----------------------------- Persistência ----------------------------- */

function readAll(): AuditLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // normaliza (caso versões antigas não tenham campos novos)
    return arr.map((r) => ({
      important: false,
      severity: "info",
      comments: [],
      ...r,
    })) as AuditLog[];
  } catch {
    return [];
  }
}

function saveAll(list: AuditLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function saveOne(item: AuditLog) {
  const list = readAll();
  list.push(item);
  list.sort((a, b) => b.ts - a.ts);
  saveAll(list.slice(0, 5000));
}

function updateOne(id: string, patch: Partial<AuditLog>) {
  const list = readAll();
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    saveAll(list);
  }
}

/* “tempo real” com event bus simples */
const listeners = new Set<(rows: AuditLog[]) => void>();
function notify() {
  const rows = readAll();
  listeners.forEach((fn) => fn(rows));
}

/* --------------------------------- Utils -------------------------------- */

export function generateAuditId() {
  const rnd = (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? (globalThis.crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);
  return rnd.replace(/-/g, "") + Date.now().toString(36);
}

function isObj(x: unknown) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function shallowDiff(before?: unknown, after?: unknown): AuditDiff | undefined {
  if (!isObj(before) || !isObj(after)) return undefined;
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  const out: AuditDiff = {};
  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    const changed = JSON.stringify(va) !== JSON.stringify(vb);
    if (changed) out[k] = { from: va, to: vb };
  }
  return Object.keys(out).length ? out : undefined;
}

function rangeFromPeriod(p: AuditPeriod): { start: number | null; end: number } {
  const end = Date.now();
  if (p === "all") return { start: null, end };
  if (p === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return { start: d.getTime(), end };
  }
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  return { start: end - days * 24 * 60 * 60 * 1000, end };
}

/* --------------------------------- API ---------------------------------- */

export async function logAudit(input: CreateAuditInput): Promise<string> {
  const id = generateAuditId();
  const log: AuditLog = {
    id,
    ts: Date.now(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    important: false,
    severity: "info",
    comments: [],
    ...input,
    diff: shallowDiff(input.before, input.after),
  };
  saveOne(log);
  notify();
  return id;
}

export type WatchAuditOptions = {
  period?: AuditPeriod;
  entityType?: string | null;
  action?: AuditAction | null;
  severity?: AuditSeverity | null;
  text?: string | null; // busca simples
};

export function watchAudit(
  opts: WatchAuditOptions,
  cb: (rows: AuditLog[]) => void
): () => void {
  const handler = () => {
    const all = readAll();
    const { start, end } = rangeFromPeriod(opts.period ?? "30d");
    const filtered = all.filter((it) => {
      if (start && (it.ts < start || it.ts > end)) return false;
      if (opts.entityType && it.entity?.type !== opts.entityType) return false;
      if (opts.action && it.action !== opts.action) return false;
      if (opts.severity && it.severity !== opts.severity) return false;
      if (opts.text) {
        const q = opts.text.toLowerCase();
        const hay =
          `${it.id} ${it.action} ${it.actor?.name ?? ""} ${it.actor?.email ?? ""} ${it.entity?.type ?? ""} ${it.entity?.id ?? ""} ${it.entity?.label ?? ""} ${it.summary ?? ""}`
            .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    filtered.sort((a, b) => b.ts - a.ts);
    cb(filtered);
  };

  handler(); // primeira entrega
  const fn = () => handler();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------ ações extras (importadas pelo componente) ----------------- */

export async function toggleImportant(id: string, value: boolean) {
  updateOne(id, { important: value });
  notify();
}

export async function setSeverity(id: string, severity: AuditSeverity) {
  updateOne(id, { severity });
  notify();
}

export async function addAuditComment(id: string, text: string): Promise<AuditComment> {
  const c: AuditComment = {
    id: generateAuditId(),
    ts: Date.now(),
    text,
  };
  const rows = readAll();
  const idx = rows.findIndex((x) => x.id === id);
  if (idx >= 0) {
    const prev = rows[idx].comments ?? [];
    rows[idx] = { ...rows[idx], comments: [...prev, c] };
    saveAll(rows);
    notify();
  }
  return c;
}

/* ------------------------------ Exportações ----------------------------- */

export function toCSV(rows: AuditLog[]): string {
  const header = [
    "id",
    "timestamp",
    "action",
    "severity",
    "entityType",
    "entityId",
    "actorName",
    "actorEmail",
    "summary",
  ];
  const lines = rows.map((r) => {
    const line = [
      r.id,
      new Date(r.ts).toISOString(),
      r.action,
      r.severity ?? "",
      r.entity?.type ?? "",
      r.entity?.id ?? "",
      r.actor?.name ?? "",
      r.actor?.email ?? "",
      (r.summary ?? "").replace(/\n/g, " "),
    ];
    return line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 300);
}
