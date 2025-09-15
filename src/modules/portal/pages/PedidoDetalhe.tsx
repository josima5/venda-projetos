// src/modules/portal/pages/PedidoDetalhe.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db, auth } from "../../../firebase/config";
import { listFilesForProject } from "../services/filesService";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Copy,
  CreditCard,
  FileDown,
  Loader2,
  Wallet,
  Info,
  Sparkles,
  ClipboardList,
} from "lucide-react";

type OrderItem = { name: string; qty?: number; price?: number };

type OrderDoc = {
  id: string;
  status: string;
  total?: number;
  createdAt?: any;
  projectId?: string;
  items?: OrderItem[];
  paymentMethod?: string;
  installments?: number;
  projectTitle?: string;
};

const PENDING_STATUSES = ["pending", "awaiting_payment", "opened", "open"];

const STATUS_COLOR: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  awaiting_payment: "bg-amber-100 text-amber-700",
  open: "bg-amber-100 text-amber-700",
  opened: "bg-amber-100 text-amber-700",
  canceled: "bg-rose-100 text-rose-700",
  refunded: "bg-slate-200 text-slate-700",
  default: "bg-slate-100 text-slate-700",
};

/** Rótulos PT */
const STATUS_LABEL_PT: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  awaiting_payment: "Aguardando pagamento",
  open: "Em aberto",
  opened: "Em aberto",
  canceled: "Cancelado",
  refunded: "Reembolsado",
  default: "—",
};

function reais(n?: number) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
  } catch {
    return `R$ ${(n ?? 0).toFixed(2)}`;
  }
}

function fmt(ts?: any) {
  try {
    if (ts?.toDate) return new Date(ts.toDate()).toLocaleString("pt-BR");
    if (typeof ts === "number") return new Date(ts).toLocaleString("pt-BR");
    if (typeof ts === "string") return new Date(ts).toLocaleString("pt-BR");
    return "";
  } catch {
    return "";
  }
}

export default function PedidoDetalhe() {
  const { id } = ((): { id?: string } => {
    // Suporta /portal/pedidos/:id e /pedido/:id
    const m = window.location.pathname.match(/\/(?:portal\/pedidos|pedido)\/([^/]+)/);
    return { id: m?.[1] };
  })();

  const user = auth.currentUser;

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [startingPay, setStartingPay] = useState(false);
  const [copied, setCopied] = useState(false);

  // formulário de entrega: existe?
  const [formExists, setFormExists] = useState(false);

  // ---- tempo real do pedido
  useEffect(() => {
    if (!id) return;
    setLoadingOrder(true);
    const off = onSnapshot(
      doc(db, "orders", id),
      (snap) => {
        if (!snap.exists()) {
          setOrder(null);
          setLoadingOrder(false);
          return;
        }
        const data = { id: snap.id, ...(snap.data() as any) } as OrderDoc;
        setOrder(data);
        setLoadingOrder(false);
      },
      () => setLoadingOrder(false)
    );
    return () => off();
  }, [id]);

  // ---- monitora se já existe um formulário de entrega para este pedido/usuário
  useEffect(() => {
    if (!order?.id || !user?.uid) {
      setFormExists(false);
      return;
    }
    const q = query(
      collection(db, "deliveryForms"),
      where("orderId", "==", order.id),
      where("customerUid", "==", user.uid),
      limit(1)
    );
    const off = onSnapshot(
      q,
      (snap) => setFormExists(snap.size > 0),
      () => setFormExists(false)
    );
    return () => off();
  }, [order?.id, user?.uid]);

  // ---- baixa os arquivos apenas quando PAGO + formulário existente
  useEffect(() => {
    const s = order?.status?.toLowerCase();
    const pid = order?.projectId;
    if (s !== "paid" || !pid || !formExists) {
      setFiles([]);
      return;
    }

    let active = true;
    (async () => {
      setLoadingFiles(true);
      try {
        const list = await listFilesForProject(pid as string, {
          userId: user?.uid ?? null,
        });
        if (active) setFiles(list);
      } finally {
        if (active) setLoadingFiles(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [order?.status, order?.projectId, user?.uid, formExists]);

  const canPay = useMemo(
    () => (order?.status ? PENDING_STATUSES.includes(order.status.toLowerCase()) : false),
    [order?.status]
  );

  async function startPaymentFlow() {
    if (!order?.id || startingPay) return;
    setStartingPay(true);

    const statusUrl = `/pedido/${order.id}?pay=1`;

    try {
      const fnUrl = import.meta.env.VITE_CREATE_MP_URL as string | undefined;

      if (fnUrl) {
        const resp = await fetch(fnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId: order.id }),
          mode: "cors",
        });

        const data = await resp.json().catch(() => ({}));
        const checkoutUrl =
          data?.init_point || data?.sandbox_init_point || data?.url || data?.redirectUrl;

        if (checkoutUrl) {
          window.open(checkoutUrl, "_blank", "noopener");
        }
      }
    } finally {
      window.location.assign(statusUrl);
      setStartingPay(false);
    }
  }

  /** Chip de status com rótulo em PT */
  function statusChip(status?: string) {
    const key = (status || "").toLowerCase();
    const color = STATUS_COLOR[key] || STATUS_COLOR.default;
    const label = STATUS_LABEL_PT[key] || STATUS_LABEL_PT.default;
    return <span className={`rounded-full px-2 py-0.5 text-xs ${color}`}>{label}</span>;
  }

  async function copyId() {
    if (!order?.id) return;
    try {
      await navigator.clipboard.writeText(order.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  if (loadingOrder) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
        <div className="h-24 animate-pulse rounded-xl border bg-gray-50" />
        <div className="h-48 animate-pulse rounded-xl border bg-gray-50" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link
          to="/portal/pedidos"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <p className="text-sm text-gray-500">Pedido não encontrado.</p>
      </div>
    );
  }

  const sKey = (order.status || "").toLowerCase();
  const isPaid = sKey === "paid";
  const isCanceled = sKey === "canceled";
  const isRefunded = sKey === "refunded";

  // Pronto para liberar (pago + formulário enviado)
  const formDone = isPaid && formExists;
  // Arquivos realmente disponíveis (mostra "tudo verde")
  const filesReady = formDone && !loadingFiles && files.length > 0;

  return (
    <div className="space-y-5">
      {/* topo */}
      <div className="flex items-center justify-between">
        <Link
          to="/portal/pedidos"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        {statusChip(order.status)}
      </div>

      <header className="flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">
            Pedido #{order.id} {order.projectTitle ? `• ${order.projectTitle}` : ""}
          </h1>
          <p className="text-sm text-gray-500">{fmt(order.createdAt)}</p>

          <button
            onClick={copyId}
            className="mt-2 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
            title="Copiar ID do pedido"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copiado!" : "Copiar ID"}
          </button>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-lg font-semibold">{reais(order.total)}</p>
        </div>
      </header>

      {/* CTA de formulário (apenas quando pago e ainda não existe formulário) */}
      {isPaid && !formExists && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3 text-blue-800">
            <Info className="mt-0.5 h-5 w-5" />
            <div className="flex-1">
              <p className="font-semibold">Pagamento confirmado!</p>
              <p className="text-sm">
                Para liberar os downloads, precisamos de alguns dados da obra. Clique no botão abaixo
                (leva menos de 2 minutos).
              </p>
              <Link
                to={`/portal/pedidos/${order.id}/entrega`}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Sparkles className="h-4 w-4" />
                Preencher formulário de entrega
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stepper moderno de status */}
      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold">Status</h2>
        <ModernStepper
          state={{
            pending: PENDING_STATUSES.includes(sKey),
            paid: isPaid,
            formDone,
            filesReady,
            canceled: isCanceled,
            refunded: isRefunded,
          }}
          onPay={canPay ? startPaymentFlow : undefined}
        />
      </section>

      {/* Itens */}
      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold">Itens</h2>
        <div className="divide-y">
          {(order.items || []).map((it, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate">{it.name}</span>
              <span className="text-gray-500">
                {it.qty ?? 1} × {reais(it.price)}
              </span>
            </div>
          ))}
          {(!order.items || order.items.length === 0) && (
            <p className="text-sm text-gray-500">Sem itens listados.</p>
          )}
        </div>
      </section>

      {/* Pagamento (se pendente) */}
      {canPay && (
        <section className="rounded-xl border p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Wallet className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Pagamento pendente</h3>
                <p className="text-xs text-gray-500">
                  Finalize para liberar os downloads. Você será direcionado ao Mercado Pago e voltará
                  para esta página.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={startPaymentFlow}
                disabled={startingPay}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {startingPay ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" /> Pagar
                  </>
                )}
              </button>

              <Link
                to={`/pedido/${order.id}?pay=1`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Acompanhar status de pagamento <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Downloads (apenas quando formulário enviado; ficam verdes quando arquivos existem) */}
      {formDone && (
        <section className="rounded-xl border p-4">
          <div className="mb-3 flex items-center gap-3">
            <FileDown className="h-5 w-5" />
            <h2 className="text-sm font-semibold">Downloads</h2>
          </div>

          {loadingFiles ? (
            <ul className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="animate-pulse rounded-lg border px-3 py-2">
                  <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
                  <div className="h-2 w-1/2 rounded bg-gray-200" />
                </li>
              ))}
            </ul>
          ) : files.length === 0 ? (
            <p className="text-sm text-gray-500">
              Formulário recebido. Estamos preparando seus arquivos — assim que estiverem
              disponíveis, aparecerão aqui para download.
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <a
                  key={f.name}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition hover:bg-gray-50"
                >
                  <span className="truncate">{f.name}</span>
                  <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------- Stepper moderno ---------- */
function ModernStepper({
  state,
  onPay,
}: {
  state: {
    pending: boolean;
    paid: boolean;
    formDone: boolean;    // formulário enviado
    filesReady: boolean;  // arquivos realmente disponíveis
    canceled: boolean;
    refunded: boolean;
  };
  onPay?: () => void;
}) {
  // Definição das etapas
  const steps = [
    { key: "created", label: "Pedido criado", icon: Clock },
    { key: "payment", label: state.paid ? "Pagamento confirmado" : "Pagamento", icon: CreditCard },
    { key: "form", label: "Formulário de entrega", icon: ClipboardList },
    { key: "downloads", label: "Downloads liberados", icon: FileDown },
  ] as const;

  // Concluído por etapa
  const done = {
    created: true,
    payment: state.paid,
    form: state.formDone,
    downloads: state.filesReady,
  };

  // Etapa atual (azul)
  let currentKey: (typeof steps)[number]["key"] = "created";
  if (state.pending) currentKey = "payment";
  else if (!state.formDone && state.paid) currentKey = "form";
  else if (state.formDone && !state.filesReady) currentKey = "downloads";
  else if (state.filesReady) currentKey = "downloads";

  // Estilização
  const colorFor = (k: (typeof steps)[number]["key"]) => {
    if (state.canceled) return "border-rose-300 bg-rose-50 text-rose-700";
    if (state.refunded) return "border-slate-300 bg-slate-50 text-slate-700";
    if (done[k]) return "border-emerald-300 bg-emerald-50 text-emerald-700";
    if (k === currentKey) return "border-blue-300 bg-blue-50 text-blue-700";
    return "border-gray-200 bg-white text-gray-600";
  };
  const barColor = (isGreen: boolean) =>
    state.canceled ? "bg-rose-200"
      : state.refunded ? "bg-slate-200"
      : isGreen ? "bg-emerald-300"
      : "bg-gray-200";

  return (
    <div className="space-y-3">
      {/* Linha com ícones + conectores que ocupam todo o espaço */}
      <div className="flex items-center">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full border text-xs font-medium transition",
                  colorFor(s.key),
                  done[s.key] ? "shadow-sm" : "",
                ].join(" ")}
                title={s.label}
              >
                <Icon className={`h-4 w-4 ${done[s.key] ? "scale-110" : ""}`} />
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 min-w-[24px] rounded ${barColor(done[s.key])}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Rótulos abaixo */}
      <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-gray-600 sm:text-xs">
        {steps.map((s) => (
          <div key={s.key} className={s.key === currentKey ? "font-semibold text-gray-900" : ""}>
            {s.label}
          </div>
        ))}
      </div>

      {/* Ação só para pagamento */}
      {currentKey === "payment" && onPay ? (
        <div className="pt-2">
          <button
            onClick={onPay}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <CreditCard className="h-4 w-4" />
            Pagar agora
          </button>
        </div>
      ) : null}
    </div>
  );
}
