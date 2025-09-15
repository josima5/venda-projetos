// src/modules/portal/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  ArrowRight,
  BadgeInfo,
  CloudDownload,
  CreditCard,
  Loader2,
  LogOut,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Sun,
  Moon,
  Copy,
  ShoppingBag,
  FolderDown,
} from "lucide-react";
import { auth, db } from "../../../firebase/config";
import { getRecentUserFiles } from "../services/filesService";
import type { ProjectFile } from "../services/filesService";

/* -------------------- helpers -------------------- */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: any) => {
  try {
    if (!d) return "";
    if (d?.toDate) return new Date(d.toDate()).toLocaleString("pt-BR");
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return "";
  }
};

type OrderDoc = {
  id: string;
  status: string;
  total?: number;
  createdAt?: any;
  projectId?: string;
  projectTitle?: string;
};

/** Meta por status: texto PT-BR, classes e ícone */
const STATUS_META: Record<
  string,
  { label: string; cls: string; Icon: (props: any) => JSX.Element }
> = {
  paid: {
    label: "pago",
    cls: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    Icon: (p) => <CheckCircle2 {...p} />,
  },
  pending: {
    label: "pendente",
    cls: "bg-amber-100 text-amber-700 ring-amber-200",
    Icon: (p) => <Clock {...p} />,
  },
  awaiting_payment: {
    label: "pendente",
    cls: "bg-amber-100 text-amber-700 ring-amber-200",
    Icon: (p) => <Clock {...p} />,
  },
  open: {
    label: "pendente",
    cls: "bg-amber-100 text-amber-700 ring-amber-200",
    Icon: (p) => <Clock {...p} />,
  },
  opened: {
    label: "pendente",
    cls: "bg-amber-100 text-amber-700 ring-amber-200",
    Icon: (p) => <Clock {...p} />,
  },
  canceled: {
    label: "cancelado",
    cls: "bg-rose-100 text-rose-700 ring-rose-200",
    Icon: (p) => <XCircle {...p} />,
  },
  refunded: {
    label: "reembolsado",
    cls: "bg-slate-100 text-slate-700 ring-slate-200",
    Icon: (p) => <RotateCcw {...p} />,
  },
  chargeback: {
    label: "contestação",
    cls: "bg-orange-100 text-orange-700 ring-orange-200",
    Icon: (p) => <AlertTriangle {...p} />,
  },
  default: {
    label: "—",
    cls: "bg-slate-100 text-slate-700 ring-slate-200",
    Icon: (p) => <BadgeInfo {...p} />,
  },
};

const PENDING = ["pending", "awaiting_payment", "open", "opened"];

/* -------------------- subcomponentes -------------------- */
function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const meta = STATUS_META[s] || STATUS_META.default;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ${meta.cls}`}>
      <meta.Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: JSX.Element;
}) {
  return (
    <div className="rounded-xl border p-5 shadow-[0_1px_0_0_rgba(16,24,40,.04)] transition hover:-translate-y-0.5 hover:shadow-sm dark:bg-white/5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{title}</p>
        <div className="rounded-md bg-slate-50 p-1.5 dark:bg-white/10">{icon}</div>
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="animate-pulse rounded-lg border px-4 py-3">
          <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
          <div className="h-2 w-1/2 rounded bg-gray-200" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
      <div className="text-gray-400">{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {desc ? <p className="text-xs text-gray-500">{desc}</p> : null}
      </div>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-lg bg-black/90 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

/* -------------------- principal -------------------- */
export default function Dashboard() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [startingPay, setStartingPay] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "paid" | "canceled">("all");
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  const [toast, setToast] = useState<string>("");

  /* Últimos pedidos em tempo real */
  useEffect(() => {
    if (!user) return;
    setLoadingOrders(true);
    const q = query(
      collection(db, "orders"),
      where("customerUid", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const off = onSnapshot(
      q,
      (snap) => {
        const list: OrderDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setOrders(list);
        setLoadingOrders(false);
      },
      () => setLoadingOrders(false)
    );
    return () => off();
  }, [user?.uid]);

  /* Downloads recentes */
  useEffect(() => {
    if (!user) return;
    getRecentUserFiles(user.uid, 3)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [user?.uid]);

  /* Tema */
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved) {
        const isDark = saved === "dark";
        setDark(isDark);
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", isDark);
        }
      }
    } catch {}
  }, []);

  const pendingOrder = useMemo(
    () => orders.find((o) => PENDING.includes(o.status?.toLowerCase?.() || "")),
    [orders]
  );

  const paidOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() === "paid"),
    [orders]
  );
  const pendingCount = useMemo(
    () => orders.filter((o) => PENDING.includes((o.status || "").toLowerCase())).length,
    [orders]
  );
  const canceledCount = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() === "canceled").length,
    [orders]
  );
  const paidTotal = useMemo(
    () => paidOrders.reduce((acc, o) => acc + (o.total || 0), 0),
    [paidOrders]
  );

  /* abre checkout + navega para status do pedido */
  async function startPaymentFlow(orderId: string) {
    if (!orderId || startingPay) return;
    setStartingPay(orderId);

    const statusUrl = `/pedido/${orderId}?pay=1`;

    try {
      const fnUrl = import.meta.env.VITE_CREATE_MP_URL as string | undefined;

      if (fnUrl) {
        const resp = await fetch(fnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId }),
          mode: "cors",
        });
        const data = await resp.json().catch(() => ({}));
        const checkoutUrl =
          data?.init_point || data?.sandbox_init_point || data?.url || data?.redirectUrl;

        if (checkoutUrl) {
          window.open(checkoutUrl, "_blank", "noopener");
        }
      }
    } catch {
      // fallback: apenas navegar para o status
    } finally {
      setStartingPay(null);
      navigate(statusUrl, { replace: true });
    }
  }

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return orders;
    if (orderFilter === "pending")
      return orders.filter((o) => PENDING.includes((o.status || "").toLowerCase()));
    if (orderFilter === "paid") return orders.filter((o) => (o.status || "").toLowerCase() === "paid");
    return orders.filter((o) => (o.status || "").toLowerCase() === "canceled");
  }, [orders, orderFilter]);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 1800);
  }

  function copyId(id: string) {
    try {
      void navigator.clipboard.writeText(id);
      showToast("ID copiado");
    } catch {}
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bem-vindo ao seu Portal</h1>
          <p className="text-sm text-gray-500">
            Olá, {user?.displayName || user?.email}. Acompanhe pedidos, pagamentos e downloads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/portal/pedidos"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-gray-50"
          >
            <ShoppingBag className="h-4 w-4" />
            Ver pedidos
          </Link>
          <Link
            to="/portal/arquivos"
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-gray-50"
          >
            <FolderDown className="h-4 w-4" />
            Meus arquivos
          </Link>
          <button
            onClick={toggleTheme}
            className="rounded-lg border p-2 transition hover:bg-gray-50"
            title="Alternar tema"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => auth.signOut()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      {/* Ação necessária */}
      {pendingOrder && (
        <section className="rounded-xl border p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Wallet className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Pagamento pendente</h3>
                <p className="text-xs text-gray-500">
                  Você possui um pedido pendente de pagamento (#{pendingOrder.id}). Finalize para
                  liberar os downloads.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => startPaymentFlow(pendingOrder.id)}
                disabled={startingPay === pendingOrder.id}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {startingPay === pendingOrder.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" /> Finalizar pagamento
                  </>
                )}
              </button>

              <button
                onClick={() => navigate(`/pedido/${pendingOrder.id}?pay=1`)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-gray-50"
              >
                Acompanhar status <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Pagos (listados)"
          value={String(paidOrders.length)}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          title="Pendentes"
          value={String(pendingCount)}
          icon={<Clock className="h-4 w-4 text-amber-600" />}
        />
        <StatCard
          title="Total pago (listados)"
          value={BRL.format(paidTotal)}
          icon={<CreditCard className="h-4 w-4 text-blue-600" />}
        />
      </section>

      {/* Grid: Downloads + Últimos pedidos (com respiro) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Downloads recentes */}
        <section className="rounded-xl border p-5 lg:col-span-1 min-h-[18rem]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-50 p-2">
                <CloudDownload className="h-5 w-5 text-violet-700" />
              </div>
              <h2 className="text-sm font-semibold">Downloads recentes</h2>
            </div>
            <Link to="/portal/arquivos" className="text-xs font-medium text-violet-700 hover:underline">
              Ver todos
            </Link>
          </div>

          {files === null ? (
            <SkeletonList />
          ) : files.length === 0 ? (
            <EmptyState
              icon={<BadgeInfo className="h-5 w-5" />}
              title="Nenhum arquivo disponível."
              desc="Assim que o pagamento for confirmado, seus arquivos aparecerão aqui."
            />
          ) : (
            <ul className="space-y-3">
              {files.map((f) => (
                <li
                  key={`${f.projectId}-${f.name}`}
                  onClick={() => navigate("/portal/arquivos")}
                  className="group flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 text-sm transition hover:shadow-sm hover:ring-1 hover:ring-violet-200"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.name}</p>
                    {f.updated ? (
                      <p className="truncate text-xs text-gray-500">
                        Atualizado em {fmtDate(f.updated)}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5" />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Últimos pedidos — agora em 2 colunas no desktop para não “apertar” */}
        <section className="rounded-xl border p-5 lg:col-span-2 min-h-[18rem]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Últimos pedidos</h2>
            <div className="flex items-center gap-2">
              {[
                { k: "all", label: "Todos" },
                { k: "pending", label: `Pendentes (${pendingCount})` },
                { k: "paid", label: `Pagos (${paidOrders.length})` },
                { k: "canceled", label: `Cancelados (${canceledCount})` },
              ].map((f) => (
                <button
                  key={f.k}
                  onClick={() => setOrderFilter(f.k as any)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs ring-1 transition",
                    orderFilter === f.k
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}
              <Link to="/portal/pedidos" className="text-xs font-medium text-blue-700 hover:underline">
                Ver todos
              </Link>
            </div>
          </div>

          {loadingOrders ? (
            <SkeletonList rows={4} />
          ) : filteredOrders.length === 0 ? (
            <EmptyState icon={<BadgeInfo className="h-5 w-5" />} title="Nenhum pedido neste filtro." />
          ) : (
            <ul className="divide-y">
              {filteredOrders.map((o) => {
                const s = (o.status || "").toLowerCase();
                const isPending = PENDING.includes(s);
                return (
                  <li
                    key={o.id}
                    className="group grid grid-cols-12 items-center gap-4 py-3 transition hover:bg-gray-50/70"
                  >
                    {/* ID + Título + Data */}
                    <div className="col-span-12 min-w-0 sm:col-span-6">
                      <p className="truncate text-sm font-medium">
                        #{o.id} {o.projectTitle ? `• ${o.projectTitle}` : ""}
                      </p>
                      <p className="text-xs text-gray-500">{fmtDate(o.createdAt)}</p>
                    </div>

                    {/* Status */}
                    <div className="col-span-6 sm:col-span-3">
                      <StatusBadge status={o.status} />
                    </div>

                    {/* Valor + Ações */}
                    <div className="col-span-6 flex items-center justify-end gap-2 sm:col-span-3">
                      <span className="text-sm font-semibold">{BRL.format(o.total || 0)}</span>

                      {isPending ? (
                        <button
                          onClick={() => startPaymentFlow(o.id)}
                          disabled={startingPay === o.id}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                          aria-label={`Pagar pedido ${o.id}`}
                        >
                          {startingPay === o.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Abrindo…
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-3.5 w-3.5" /> Pagar
                            </>
                          )}
                        </button>
                      ) : null}

                      <button
                        onClick={() => copyId(o.id)}
                        className="rounded-md border px-2 py-1.5 text-xs transition hover:bg-gray-100"
                        title="Copiar ID"
                      >
                        <Copy className="h-4 w-4" />
                      </button>

                      <Link
                        to={`/pedido/${o.id}`}
                        className="rounded-md border px-2 py-1.5 text-xs transition hover:bg-gray-100"
                        aria-label={`Ir para o pedido ${o.id}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}
