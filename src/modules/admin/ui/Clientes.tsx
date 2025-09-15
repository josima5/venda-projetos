// src/modules/admin/pages/Clientes.tsx

import { useEffect, useMemo, useState } from "react";
import type { CustomerDoc } from "../services/customersService";
import {
  upsertCustomer,
  watchCustomers,
  deleteCustomer,
  waLinkFromPhone,
} from "../services/customersService";

/* ------------------- Helpers de formatação ------------------- */
const formatBRL = (v?: number) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

const formatPhone = (raw?: string | null) => {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "—";
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length >= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  return d;
};

const formatTaxId = (raw?: string | null) => {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "—";
  if (d.length <= 11) {
    // CPF 000.000.000-00
    return d
      .padStart(11, "0")
      .replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  // CNPJ 00.000.000/0000-00
  return d
    .padStart(14, "0")
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

const formatCEP = (raw?: string | null) => {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "—";
  return d.replace(/^(\d{5})(\d{3}).*$/, "$1-$2");
};

const formatDate = (x: any) => {
  try {
    const d =
      x?.toDate?.() ??
      (typeof x?.seconds === "number" ? new Date(x.seconds * 1000) : x);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
};

/* ------------------- CSV util ------------------- */
function exportCSV(rows: CustomerDoc[]) {
  const header = [
    "id",
    "name",
    "email",
    "phone",
    "taxId",
    "zip",
    "street",
    "number",
    "complement",
    "district",
    "city",
    "state",
    "tags",
    "note",
    "ordersCount",
    "totalSpent",
    "lastOrderAt",
  ];

  const lines = rows.map((c) => {
    const a = c.address || {};
    return [
      c.id,
      c.name ?? "",
      c.email ?? "",
      c.phone ?? "",
      c.taxId ?? "",
      a.zip ?? "",
      a.street ?? "",
      a.number ?? "",
      a.complement ?? "",
      a.district ?? "",
      a.city ?? "",
      a.state ?? "",
      (c.tags || []).join("|"),
      (c.note || "").replace(/\n/g, " "),
      String(c.ordersCount ?? 0),
      String(c.totalSpent ?? 0),
      formatDate(c.lastOrderAt),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------- Modal de edição ------------------- */
type EditState = Partial<CustomerDoc> & { id?: string };

function EditCustomerModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: EditState | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditState>(() => initial || { address: {} });

  useEffect(() => {
    setForm(initial || { address: {} });
  }, [initial]);

  if (!open) return null;

  const a = form.address || {};

  async function handleSave() {
    const payload: EditState = {
      id: form.id,
      name: String(form.name || "").trim(),
      email: form.email ?? null,
      phone: form.phone ?? null,
      taxId: form.taxId ?? null,
      tags:
        typeof form.tags === "string"
          ? String(form.tags)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : (form.tags as string[]) || [],
      note: form.note ?? null,
      address: {
        zip: a.zip ?? null,
        street: a.street ?? null,
        number: a.number ?? null,
        complement: a.complement ?? null,
        district: a.district ?? null,
        city: a.city ?? null,
        state: a.state ?? null,
      },
    };
    await upsertCustomer(payload as any);
    onSaved();
    onClose();
  }

  const set = <K extends keyof EditState>(k: K, v: any) =>
    setForm((s) => ({ ...s, [k]: v }));

  const setAddr = <K extends keyof NonNullable<EditState["address"]>>(
    k: K,
    v: any
  ) => setForm((s) => ({ ...s, address: { ...(s.address || {}), [k]: v } }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold">
          {form.id ? "Editar Cliente" : "Novo Cliente"}
        </h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Nome</span>
            <input
              className="rounded border p-2"
              value={form.name || ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Telefone (só dígitos)</span>
            <input
              className="rounded border p-2"
              value={form.phone || ""}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">E-mail</span>
            <input
              className="rounded border p-2"
              value={form.email || ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">CPF/CNPJ (só dígitos)</span>
            <input
              className="rounded border p-2"
              value={form.taxId || ""}
              onChange={(e) => set("taxId", e.target.value.replace(/\D/g, ""))}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">CEP</span>
            <input
              className="rounded border p-2"
              value={a.zip || ""}
              onChange={(e) => setAddr("zip", e.target.value.replace(/\D/g, ""))}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Rua</span>
            <input
              className="rounded border p-2"
              value={a.street || ""}
              onChange={(e) => setAddr("street", e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Número</span>
            <input
              className="rounded border p-2"
              value={a.number || ""}
              onChange={(e) => setAddr("number", e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Complemento</span>
            <input
              className="rounded border p-2"
              value={a.complement || ""}
              onChange={(e) => setAddr("complement", e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Bairro</span>
            <input
              className="rounded border p-2"
              value={a.district || ""}
              onChange={(e) => setAddr("district", e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">Cidade</span>
            <input
              className="rounded border p-2"
              value={a.city || ""}
              onChange={(e) => setAddr("city", e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm text-gray-600">UF</span>
            <input
              className="rounded border p-2 uppercase"
              maxLength={2}
              value={a.state || ""}
              onChange={(e) => setAddr("state", e.target.value.toUpperCase())}
            />
          </label>

          <label className="col-span-1 md:col-span-2 flex flex-col">
            <span className="text-sm text-gray-600">
              Tags (separe por vírgula)
            </span>
            <input
              className="rounded border p-2"
              value={
                Array.isArray(form.tags) ? form.tags.join(", ") : (form.tags as any) || ""
              }
              onChange={(e) => set("tags", e.target.value)}
            />
          </label>

          <label className="col-span-1 md:col-span-2 flex flex-col">
            <span className="text-sm text-gray-600">Anotações</span>
            <textarea
              className="min-h-[100px] rounded border p-2"
              value={form.note || ""}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            className="rounded-md border px-4 py-2"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
            onClick={handleSave}
            type="button"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------- Página ------------------- */
export default function ClientesPage() {
  const [rows, setRows] = useState<CustomerDoc[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);

  useEffect(() => {
    const unsub = watchCustomers(setRows);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((c) => {
      const address = [
        c.address?.street,
        c.address?.number,
        c.address?.district,
        c.address?.city,
        c.address?.state,
        c.address?.zip,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const hay =
        `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.taxId ?? ""} ${(c.tags || []).join(
          " "
        )} ${address}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  function openNew() {
    setEdit({ address: {} });
    setOpen(true);
  }

  function openEdit(c: CustomerDoc) {
    setEdit({
      ...c,
      address: { ...(c.address || {}) },
    });
    setOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este cliente?")) return;
    await deleteCustomer(id);
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border px-3 py-2"
            onClick={() => exportCSV(filtered)}
          >
            Exportar CSV
          </button>
          <button
            className="rounded-md bg-green-600 px-3 py-2 font-semibold text-white hover:bg-green-700"
            onClick={openNew}
          >
            Novo Cliente
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input
          placeholder="Buscar por nome, e-mail, telefone, CPF/CNPJ, tag ou endereço..."
          className="w-full rounded-md border px-3 py-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3">Contato</th>
              <th className="p-3">Documento</th>
              <th className="p-3">Endereço</th>
              <th className="p-3 text-center">Pedidos</th>
              <th className="p-3 text-right">Gasto total</th>
              <th className="p-3">Último pedido</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const w = waLinkFromPhone(
                c.phone,
                `Olá ${c.name?.split(" ")[0] || ""}!`
              );
              const a = c.address || {};
              const addr = [
                [a.street, a.number].filter(Boolean).join(", "),
                a.district,
                a.city && a.state ? `${a.city} - ${a.state}` : a.city || a.state,
                a.zip ? `CEP ${formatCEP(a.zip)}` : "",
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <tr key={c.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{c.name}</div>
                    {Array.isArray(c.tags) && c.tags.length > 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        {c.tags.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div>{c.email || "—"}</div>
                    <div className="text-gray-500">{formatPhone(c.phone)}</div>
                  </td>
                  <td className="p-3">{formatTaxId(c.taxId)}</td>
                  <td className="p-3">{addr || "—"}</td>
                  <td className="p-3 text-center">{c.ordersCount ?? 0}</td>
                  <td className="p-3 text-right">{formatBRL(c.totalSpent)}</td>
                  <td className="p-3">{formatDate(c.lastOrderAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {w && (
                        <a
                          href={w}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border px-2 py-1"
                        >
                          WhatsApp
                        </a>
                      )}
                      <button
                        className="rounded-md border px-2 py-1"
                        onClick={() => openEdit(c)}
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-md border border-red-300 px-2 py-1 text-red-600"
                        onClick={() => handleDelete(c.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EditCustomerModal
        open={open}
        onClose={() => setOpen(false)}
        initial={edit}
        onSaved={() => {}}
      />
    </div>
  );
}
