// src/modules/admin/pages/VendaDetalhe.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
  getDocs,
  updateDoc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, deleteObject } from "firebase/storage";
import JSZip from "jszip";
import app from "../../../firebase/config";
import { listFilesForProject } from "../../portal/services/filesService";

/* ---------- Tipos ---------- */
type DeliveryForm = {
  id?: string;
  customerUid: string;
  orderId: string;
  responsible?: {
    name?: string;
    telefone?: string;
    cpfCnpj?: string;
    email?: string;
  };
  land?: {
    area?: string;
    frente?: string;
    fundos?: string;
    lateralDireita?: string;
    lateralEsquerda?: string;
    quadra?: string;
    lote?: string;
    matricula?: string;
  };
  address?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
  createdAt?: any;
  updatedAt?: any;
};

type StoredFile = { name: string; url: string; cat?: string };

/* ---------- Catálogo de categorias (inclui NF-e) ---------- */
const DELIVERABLES: Array<{ id: string; label: string }> = [
  { id: "nfe", label: "NF-e (PDF)" }, // <— para enviar o PDF da nota
  { id: "arquitetonico", label: "Projeto Arquitetônico" },
  { id: "arts", label: "ART's de Projetos" },
  { id: "hidrossanitario", label: "Projeto Hidrossanitário" },
  { id: "eletrico", label: "Projeto Elétrico" },
  { id: "estrutural", label: "Projeto Estrutural" },
  { id: "caderno-executivo", label: "Caderno Executivo (interiores)" },
  { id: "imagens-3d", label: "Caderno de Imagens 3D (brinde)" },
];

/* ---------- Helpers ---------- */
function formatCurrencyBRL(n?: number) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function parseCat(name: string): string | undefined {
  const m = name.match(/^([a-z0-9\-]+)__\d{10,}__/i);
  return m?.[1]?.toLowerCase();
}
function ViewItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium break-words">{value || "—"}</div>
    </div>
  );
}

export default function VendaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const db = useMemo(() => getFirestore(app), []);
  const storage = useMemo(() => getStorage(app), []);

  const [order, setOrder] = useState<any | null>(null);
  const [form, setForm] = useState<DeliveryForm | null>(null);
  const [editForm, setEditForm] = useState<DeliveryForm | null>(null);

  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState<string | null>(null); // catId
  const [dragCat, setDragCat] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);    // url being removed
  const [zipping, setZipping] = useState<string | null>(null);      // catId being zipped

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

  // Email
  const [sendingEmail, setSendingEmail] = useState<false | "ok" | "err">(false);

  /* ---------- Pedido ---------- */
  useEffect(() => {
    if (!id) return;
    const off = onSnapshot(doc(db, "orders", id), (snap) => {
      setOrder(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    return () => off();
  }, [db, id]);

  /* ---------- Formulário (1 doc) ---------- */
  useEffect(() => {
    if (!order?.id || !order?.customerUid) {
      setForm(null);
      setEditForm(null);
      return;
    }
    (async () => {
      const qForm = query(
        collection(db, "deliveryForms"),
        where("orderId", "==", order.id),
        where("customerUid", "==", order.customerUid),
        limit(1)
      );
      const s = await getDocs(qForm);
      const d = s.docs[0];
      if (d) {
        setForm({ id: d.id, ...(d.data() as DeliveryForm) });
        setEditForm(null);
      } else {
        setForm(null);
        setEditForm(null);
      }
    })();
  }, [db, order?.id, order?.customerUid]);

  /* ---------- Arquivos já entregues ---------- */
  useEffect(() => {
    let active = true;
    (async () => {
      if (!order?.projectId) { setFiles([]); return; }
      const list = await listFilesForProject(order.projectId, {
        userId: order.customerUid ?? null,
      });
      if (active) {
        setFiles(list.map((f: any) => ({
          name: f.name,
          url: f.url,
          cat: parseCat(f.name) || "outros",
        })));
      }
    })();
    return () => { active = false; };
  }, [order?.projectId, order?.customerUid]);

  /* ---------- Caminhos no Storage ---------- */
  function storageBasePath() {
    const byUser = (import.meta.env.VITE_STORAGE_DELIVERIES_BY_UID ?? "0") === "1";
    if (byUser) return `portal/${order.customerUid}/${order.projectId}`;
    return `projects/${order.projectId}/entregaveis`;
  }
  function fullStoragePathFromName(name: string) {
    return name.includes("/") ? name : `${storageBasePath()}/${name}`;
  }

  /* ---------- Upload ---------- */
  async function onUploadCat(catId: string, fileList: FileList | null) {
    if (!order || !fileList?.length) return;
    setUploading(catId);
    try {
      const base = storageBasePath();
      for (const file of Array.from(fileList)) {
        const safeName = file.name.replace(/\s+/g, "_");
        const path = `${base}/${catId}__${Date.now()}__${safeName}`;
        await uploadBytes(ref(storage, path), file);

        // log simples (se regra não permitir, ignora)
        try {
          await addDoc(collection(db, "audit"), {
            type: "upload",
            orderId: order.id,
            projectId: order.projectId,
            file: path,
            cat: catId,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn("Audit log skipped:", e);
        }
      }
      // reload
      const list = await listFilesForProject(order.projectId, {
        userId: order.customerUid ?? null,
      });
      setFiles(list.map((f: any) => ({
        name: f.name,
        url: f.url,
        cat: parseCat(f.name) || "outros",
      })));
    } finally {
      setUploading(null);
      setDragCat(null);
    }
  }

  /* ---------- ZIP ---------- */
  async function onZipCategory(catId: string) {
    const items = filesByCat.get(catId) || [];
    if (!items.length) return;
    setZipping(catId);
    try {
      const zip = new JSZip();
      for (const f of items) {
        const resp = await fetch(f.url);
        const blob = await resp.blob();
        const pretty = f.name.replace(`${catId}__`, "").replace(/^(\d{10,})__/, "");
        zip.file(pretty, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${catId}_${order.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      console.error(e);
      alert("Não foi possível gerar o ZIP agora.");
    } finally {
      setZipping(null);
    }
  }

  /* ---------- Remover ---------- */
  async function onRemove(file: StoredFile) {
    if (!order) return;
    const ok = window.confirm("Remover este arquivo definitivamente?");
    if (!ok) return;
    setRemoving(file.url);
    try {
      const objectPath = fullStoragePathFromName(file.name);
      await deleteObject(ref(storage, objectPath));
      try {
        await addDoc(collection(db, "audit"), {
          type: "remove",
          orderId: order.id,
          projectId: order.projectId,
          file: objectPath,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("Audit log skipped:", e);
      }
      const list = await listFilesForProject(order.projectId, {
        userId: order.customerUid ?? null,
      });
      setFiles(list.map((f: any) => ({
        name: f.name,
        url: f.url,
        cat: parseCat(f.name) || "outros",
      })));
    } finally {
      setRemoving(null);
    }
  }

  /* ---------- Edit form ---------- */
  function startEdit() {
    if (form) { setEditForm(JSON.parse(JSON.stringify(form))); setSaved(null); }
  }
  function cancelEdit() { setEditForm(null); setSaved(null); }
  function dotify(obj: any, prefix = ""): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (k === "id") continue;
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v) && !(v as any).toDate) {
        Object.assign(out, dotify(v, key));
      } else {
        out[key] = v;
      }
    }
    return out;
  }
  async function saveEdit() {
    if (!editForm || !form?.id) return;
    setSaving(true); setSaved(null);
    try {
      const payload = dotify(editForm);
      payload["updatedAt"] = serverTimestamp();
      await updateDoc(doc(db, "deliveryForms", form.id), payload);
      setSaved("ok");
      setEditForm(null);
      setForm({ ...editForm, id: form.id });
    } catch (e) {
      console.error(e);
      setSaved("err");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(null), 2500);
    }
  }

  /* ---------- Agrupamento ---------- */
  const filesByCat = useMemo(() => {
    const map = new Map<string, StoredFile[]>();
    for (const f of files) {
      const k = f.cat || "outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    }
    return map;
  }, [files]);

  /* ---------- Email (extensão) ---------- */
  async function sendFilesByEmail() {
    if (!order?.customer?.email) { alert("Pedido sem e-mail do cliente."); return; }
    if (!files.length) { alert("Nenhum arquivo disponível para enviar."); return; }
    setSendingEmail(false);
    try {
      const groups = Array.from(filesByCat.entries());
      const lines = groups.map(([cat, arr]) => {
        const def = DELIVERABLES.find((d) => d.id === cat);
        const title = def ? def.label : cat.toUpperCase();
        const links = arr.map((f) =>
          `<li><a href="${f.url}" target="_blank">${f.name.replace(`${cat}__`, "")}</a></li>`
        ).join("");
        return `<h4 style="margin:16px 0 4px">${title}</h4><ul>${links}</ul>`;
      });
      const html = `
        <div style="font-family:ui-sans-serif,system-ui">
          <p>Olá ${order.customer?.name || ""},</p>
          <p>Segue abaixo os arquivos liberados do seu projeto <b>${order.projectTitle || order.projectId}</b>:</p>
          ${lines.join("")}
          <p>Qualquer dúvida, estamos à disposição.</p>
          <p>— Malta Engenharia</p>
        </div>
      `;
      await addDoc(collection(db, "mail"), {
        to: order.customer.email,
        message: {
          subject: `Arquivos do projeto ${order.projectTitle || order.projectId}`,
          html,
          text: "Arquivos do seu projeto foram liberados.",
        },
      });
      setSendingEmail("ok");
      setTimeout(() => setSendingEmail(false), 2500);
    } catch (e) {
      console.error(e);
      setSendingEmail("err");
      setTimeout(() => setSendingEmail(false), 3000);
    }
  }

  /* ---------- UI ---------- */
  if (loading) return <div>Carregando…</div>;
  if (!order) {
    return (
      <div>
        Pedido não encontrado.{" "}
        <Link to="/admin/vendas" className="underline">Voltar</Link>
      </div>
    );
  }

  const paidAt = order.paidAt?.toDate?.() ? new Date(order.paidAt.toDate()) : null;
  const invoiceStatus = order?.invoice?.status as "sent" | "pending" | undefined;
  const invoiceNumber = order?.invoice?.number as string | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/admin" className="hover:text-slate-700 transition">Admin</Link>
          <span>›</span>
          <Link to="/admin/vendas" className="hover:text-slate-700 transition">Vendas</Link>
          <span>›</span>
          <span className="text-slate-800 font-medium">#{order.id}</span>
        </div>
        <Link
          to="/admin/vendas"
          className="text-indigo-700 hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-md transition"
        >
          ← Voltar
        </Link>
      </div>

      {/* Resumo do pedido */}
      <section className="rounded-xl border p-4 bg-white shadow-sm transition hover:shadow-md">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-lg font-semibold">
            {order.projectTitle || order.projectId || "Projeto"}
          </span>
          <span
            className={classNames(
              "px-2 py-0.5 rounded-full text-xs border",
              order.status === "paid"
                ? "bg-green-50 text-green-700 border-green-200"
                : order.status === "pending"
                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                : "bg-slate-50 text-slate-700 border-slate-200"
            )}
          >
            {order.status === "paid"
              ? "PAGO"
              : order.status === "pending"
              ? "PENDENTE"
              : (order.status || "").toUpperCase()}
          </span>
          <span
            className={classNames(
              "px-2 py-0.5 rounded-full text-xs border",
              invoiceStatus === "sent"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}
          >
            NF-e: {invoiceStatus === "sent" ? "enviada" : "pendente"}
            {invoiceNumber ? ` • Nº ${invoiceNumber}` : ""}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Cliente</div>
            <div className="font-medium">{order.customer?.name || "—"}</div>
            <div className="text-xs text-slate-500">
              {order.customer?.email ? (
                <a
                  className="text-indigo-600 hover:underline"
                  href={`mailto:${order.customer.email}`}
                >
                  {order.customer.email}
                </a>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Pago em</div>
            <div>{paidAt ? paidAt.toLocaleString("pt-BR") : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total</div>
            <div className="font-semibold">{formatCurrencyBRL(order.total)}</div>
          </div>

          {/* Ação: enviar e-mail ao cliente */}
          <div className="flex items-end justify-end gap-2">
            <button
              onClick={sendFilesByEmail}
              className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition"
              title="Enviar e-mail ao cliente com os links dos arquivos"
            >
              {sendingEmail === "ok"
                ? "E-mail enviado!"
                : sendingEmail === "err"
                ? "Falha ao enviar"
                : "Enviar e-mail ao cliente"}
            </button>
          </div>
        </div>
      </section>

      {/* (REMOVIDO) Bloco Fiscal / NF-e do topo */}

      {/* Formulário de entrega */}
      <section className="rounded-xl border p-4 bg-white shadow-sm transition hover:shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Formulário de entrega</h2>
          {form ? (
            editForm ? (
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 text-sm rounded-md border hover:bg-slate-50"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
                  onClick={saveEdit}
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            ) : (
              <button
                className="px-3 py-1.5 text-sm rounded-md border hover:bg-slate-50"
                onClick={startEdit}
              >
                Editar
              </button>
            )
          ) : null}
        </div>

        {!form ? (
          <p className="text-sm text-slate-500">Cliente ainda não preencheu.</p>
        ) : editForm ? (
          // edição
          <div className="grid gap-6">
            <fieldset className="grid gap-3 sm:grid-cols-2 border rounded-lg p-3">
              <legend className="text-xs font-semibold text-slate-600 px-1">
                Dados do proprietário do terreno
              </legend>
              <label className="text-sm">
                <div className="text-xs text-slate-500">Nome completo</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.responsible?.name || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      responsible: { ...editForm.responsible, name: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-500">CPF/CNPJ</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.responsible?.cpfCnpj || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      responsible: { ...editForm.responsible, cpfCnpj: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-500">E-mail</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.responsible?.email || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      responsible: { ...editForm.responsible, email: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <div className="text-xs text-slate-500">Telefone</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.responsible?.telefone || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      responsible: { ...editForm.responsible, telefone: e.target.value },
                    })
                  }
                />
              </label>
            </fieldset>

            <fieldset className="grid gap-3 sm:grid-cols-6 border rounded-lg p-3">
              <legend className="text-xs font-semibold text-slate-600 px-1">
                Endereço da Obra
              </legend>
              <label className="text-sm sm:col-span-2">
                <div className="text-xs text-slate-500">CEP</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.address?.cep || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      address: { ...editForm.address, cep: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm sm:col-span-4">
                <div className="text-xs text-slate-500">Logradouro</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.address?.logradouro || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      address: { ...editForm.address, logradouro: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <div className="text-xs text-slate-500">Número</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.address?.numero || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      address: { ...editForm.address, numero: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <div className="text-xs text-slate-500">Complemento</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.address?.complemento || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      address: { ...editForm.address, complemento: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <div className="text-xs text-slate-500">Bairro</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.address?.bairro || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      address: { ...editForm.address, bairro: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm sm:col-span-4">
                <div className="text-xs text-slate-500">Cidade</div>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.address?.cidade || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      address: { ...editForm.address, cidade: e.target.value },
                    })
                  }
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <div className="text-xs text-slate-500">UF</div>
                <input
                  className="w-full border rounded-md px-3 py-2 uppercase"
                  value={editForm.address?.estado || ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      address: {
                        ...editForm.address,
                        estado: e.target.value.toUpperCase(),
                      },
                    })
                  }
                />
              </label>
            </fieldset>

            <fieldset className="grid gap-3 sm:grid-cols-4 border rounded-lg p-3">
              <legend className="text-xs font-semibold text-slate-600 px-1">
                Dados do terreno
              </legend>
              {[
                ["lote", "Lote"],
                ["quadra", "Quadra"],
                ["matricula", "Matrícula"],
                ["area", "Área (m²)"],
                ["frente", "Frente (m)"],
                ["fundos", "Fundos (m)"],
                ["lateralDireita", "Lateral direita (m)"],
                ["lateralEsquerda", "Lateral esquerda (m)"],
              ].map(([key, label]) => (
                <label className="text-sm" key={key}>
                  <div className="text-xs text-slate-500">{label}</div>
                  <input
                    className="w-full border rounded-md px-3 py-2"
                    value={(editForm.land as any)?.[key] || ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        land: { ...editForm.land, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </fieldset>

            {saved === "ok" && (
              <div className="text-green-700 text-sm">Alterações salvas.</div>
            )}
            {saved === "err" && (
              <div className="text-red-700 text-sm">
                Não foi possível salvar. Tente novamente.
              </div>
            )}
          </div>
        ) : (
          // visualização
          <div className="grid gap-6">
            <div className="grid gap-3 sm:grid-cols-2 border rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-600 col-span-full">
                Dados do proprietário do terreno
              </div>
              <ViewItem label="Nome completo" value={form.responsible?.name} />
              <ViewItem label="CPF/CNPJ" value={form.responsible?.cpfCnpj} />
              <ViewItem label="E-mail" value={form.responsible?.email} />
              <ViewItem label="Telefone" value={form.responsible?.telefone} />
            </div>

            <div className="grid gap-3 sm:grid-cols-6 border rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-600 col-span-full">
                Endereço da Obra
              </div>
              <ViewItem label="CEP" value={form.address?.cep} />
              <div className="sm:col-span-5">
                <ViewItem label="Logradouro" value={form.address?.logradouro} />
              </div>
              <ViewItem label="Número" value={form.address?.numero} />
              <ViewItem label="Complemento" value={form.address?.complemento} />
              <ViewItem label="Bairro" value={form.address?.bairro} />
              <div className="sm:col-span-4">
                <ViewItem label="Cidade" value={form.address?.cidade} />
              </div>
              <ViewItem label="UF" value={form.address?.estado} />
            </div>

            <div className="grid gap-3 sm:grid-cols-4 border rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-600 col-span-full">
                Dados do terreno
              </div>
              <ViewItem label="Lote" value={form.land?.lote} />
              <ViewItem label="Quadra" value={form.land?.quadra} />
              <ViewItem label="Matrícula" value={form.land?.matricula} />
              <ViewItem label="Área (m²)" value={form.land?.area} />
              <ViewItem label="Frente (m)" value={form.land?.frente} />
              <ViewItem label="Fundos (m)" value={form.land?.fundos} />
              <ViewItem label="Lateral direita (m)" value={form.land?.lateralDireita} />
              <ViewItem label="Lateral esquerda (m)" value={form.land?.lateralEsquerda} />
            </div>
          </div>
        )}
      </section>

      {/* Entregáveis */}
      <section className="rounded-xl border p-4 bg-white shadow-sm transition hover:shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Entregáveis para o cliente {files.length ? `(${files.length})` : ""}
          </h2>
        </div>

        <div className="space-y-5">
          {DELIVERABLES.map((cat) => {
            const list = filesByCat.get(cat.id) || [];
            const inputId = `file-${cat.id}`;
            return (
              <div
                key={cat.id}
                className={classNames(
                  "rounded-lg border px-3 py-3 transition group",
                  dragCat === cat.id ? "ring-2 ring-indigo-400 bg-indigo-50" : "hover:shadow"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragCat(cat.id); }}
                onDragLeave={() => setDragCat(null)}
                onDrop={(e) => { e.preventDefault(); onUploadCat(cat.id, e.dataTransfer.files); setDragCat(null); }}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {cat.label} {list.length ? `(${list.length})` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onZipCategory(cat.id)}
                      className="text-xs border rounded px-2 py-1 hover:bg-slate-50 transition"
                      disabled={!list.length || zipping === cat.id}
                      title="Baixar todos arquivos em ZIP"
                    >
                      {zipping === cat.id ? "Gerando ZIP..." : "Baixar ZIP"}
                    </button>
                    <label
                      htmlFor={inputId}
                      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-white text-xs font-medium cursor-pointer hover:bg-indigo-500 transition"
                      title="Clique para enviar ou solte arquivos aqui"
                    >
                      {uploading === cat.id ? "Enviando..." : "Enviar arquivos"}
                    </label>
                    <input
                      id={inputId}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => { onUploadCat(cat.id, e.currentTarget.files); e.currentTarget.value = ""; }}
                      disabled={!!uploading}
                    />
                  </div>
                </div>

                {!list.length ? (
                  <p className="text-sm text-slate-500">
                    Nenhum arquivo nesta categoria. Clique em <b>Enviar arquivos</b> ou arraste e solte aqui.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((f) => (
                      <li
                        key={f.url}
                        className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-slate-50 transition"
                      >
                        <span className="truncate">
                          {f.name.replace(`${cat.id}__`, "").replace(/^(\d{10,})__/, "")}
                        </span>
                        <div className="flex items-center gap-2">
                          <a className="text-indigo-600 hover:underline" href={f.url} target="_blank" rel="noreferrer">
                            Abrir
                          </a>
                          <button
                            type="button"
                            className="text-rose-700 hover:bg-rose-50 border rounded px-2 py-1 transition"
                            onClick={() => onRemove(f)}
                            disabled={removing === f.url}
                            title="Remover arquivo"
                          >
                            {removing === f.url ? "Removendo..." : "Remover"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {/* Grupo "Outros" — arquivos antigos/sem prefixo */}
          {(filesByCat.get("outros") || []).length > 0 && (
            <div className="rounded-lg border px-3 py-3 hover:shadow transition">
              <div className="mb-2 font-medium">
                Outros ({filesByCat.get("outros")!.length})
              </div>
              <ul className="space-y-2">
                {filesByCat.get("outros")!.map((f) => (
                  <li
                    key={f.url}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-slate-50 transition"
                  >
                    <span className="truncate">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <a className="text-indigo-600 hover:underline" href={f.url} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                      <button
                        type="button"
                        className="text-rose-700 hover:bg-rose-50 border rounded px-2 py-1 transition"
                        onClick={() => onRemove(f)}
                        disabled={removing === f.url}
                      >
                        {removing === f.url ? "Removendo..." : "Remover"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
