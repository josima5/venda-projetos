// src/modules/admin/pages/Catalogo.tsx
import { useEffect, useMemo, useState } from "react";
import type { ProjectDoc } from "../services/catalogService";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useNavigate } from "react-router-dom";
// ✅ importa o remover do serviço
import { deleteProject } from "../services/catalogService";

function brl(n: number) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
  } catch {
    return `R$ ${Number(n || 0).toFixed(2)}`;
  }
}

export default function CatalogoPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProjectDoc[]>([]);
  const [q, setQ] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Busca TODOS os docs e ordena no cliente (order asc, depois title)
  useEffect(() => {
    const off = onSnapshot(collection(db, "projects"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ProjectDoc));
      list.sort((a, b) => {
        const ao = typeof a.order === "number" ? a.order : Number.POSITIVE_INFINITY;
        const bo = typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return (a.title || "").localeCompare(b.title || "", "pt-BR", { sensitivity: "base" });
      });
      setRows(list);
    });
    return () => off();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((p) => {
      const hay = `${p.code || ""} ${p.title} ${p.description || ""} ${(p.tags || []).join(" ")} ${(p.features || []).join(" ")}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  async function handleDelete(id: string, title?: string) {
    const ok = window.confirm(`Remover o projeto${title ? ` “${title}”` : ""}? Esta ação não pode ser desfeita.`);
    if (!ok) return;
    try {
      setDeletingId(id);
      await deleteProject(id); // 🔥 apaga no Firestore
      // Obs.: arquivos do Storage não são removidos aqui. Se quiser, podemos adicionar essa limpeza depois.
    } catch (err) {
      console.error(err);
      alert("Não foi possível remover o projeto. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Catálogo</h1>
        <button
          className="rounded-md bg-green-600 px-3 py-2 font-semibold text-white hover:bg-green-700"
          onClick={() => navigate("/admin/catalogo/novo")}
        >
          Novo Projeto
        </button>
      </div>

      <div>
        <input
          placeholder="Buscar por código, título, tag…"
          className="w-full rounded-md border px-3 py-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Projeto</th>
              <th className="p-3 text-right">Preço</th>
              <th className="p-3">Métricas</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ordem</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {p.mainImageUrl ? (
                      <img
                        src={p.mainImageUrl}
                        alt=""
                        className="h-12 w-16 rounded object-cover"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                      />
                    ) : (
                      <div className="h-12 w-16 rounded bg-zinc-100" />
                    )}
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-[11px] text-zinc-500">
                        {p.code ? <span className="mr-2 font-mono">{p.code}</span> : null}
                        {p.tags?.length ? <span>{p.tags.join(", ")}</span> : null}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="p-3 text-right">{brl(Number(p.price || 0))}</td>

                <td className="p-3">
                  <div className="text-xs text-zinc-700">
                    <span className="mr-3">{Number(p.area || 0)} m²</span>
                    <span className="mr-3">{Number(p.bedrooms || 0)} qtos</span>
                    <span className="mr-3">{Number(p.bathrooms || 0)} banh</span>
                    {!!p.lotWidth && !!p.lotLength && (
                      <span>Terreno &ge; {p.lotWidth}×{p.lotLength} m</span>
                    )}
                  </div>
                </td>

                <td className="p-3">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      p.active !== false ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-zinc-50 text-zinc-600 ring-zinc-500/20"
                    }`}
                  >
                    {p.active !== false ? "Ativo" : "Inativo"}
                  </span>
                </td>

                <td className="p-3">{typeof p.order === "number" ? p.order : "—"}</td>

                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border px-2 py-1"
                      onClick={() => navigate(`/admin/catalogo/${p.id}`)}
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-60"
                      onClick={() => handleDelete(p.id, p.title)}
                      disabled={deletingId === p.id}
                    >
                      {deletingId === p.id ? "Removendo…" : "Remover"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={6}>
                  Nenhum projeto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
