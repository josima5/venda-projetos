// src/modules/admin/ui/ProjectForm.tsx
// Formulário de cadastro de projetos (admin)

import React, { useRef, useState } from "react";
import { createProject } from "../../catalogo/services/projectsService";
import type { ProjectBase } from "../../catalogo/types";

type AddonInput = { id: string; label: string; price: number };

export default function ProjectForm() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [area, setArea] = useState<number>(0);
  const [bedrooms, setBedrooms] = useState<number>(0);
  const [bathrooms, setBathrooms] = useState<number>(0);
  const [lotWidth, setLotWidth] = useState<number>(0);
  const [lotLength, setLotLength] = useState<number>(0);
  const [tagsText, setTagsText] = useState("Sobrado, Piscina, Área Gourmet");

  // novos campos
  const [description, setDescription] = useState<string>("");
  const [addons, setAddons] = useState<AddonInput[]>([
    // defaults próximos do protótipo (pode ajustar à vontade)
    { id: crypto.randomUUID(), label: "Projeto Elétrico", price: 450 },
    { id: crypto.randomUUID(), label: "Projeto Estrutural", price: 600 },
    { id: crypto.randomUUID(), label: "Projeto Hidrossanitário", price: 500 },
  ]);

  const coverRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[] | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  function addEmptyAddon() {
    setAddons((prev) => [...prev, { id: crypto.randomUUID(), label: "", price: 0 }]);
  }
  function updateAddon(id: string, patch: Partial<AddonInput>) {
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function removeAddon(id: string) {
    setAddons((prev) => prev.filter((a) => a.id !== id));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const data: ProjectBase = {
      title: title.trim(),
      price: Number(price) || 0,
      area: Number(area) || 0,
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      lotWidth: Number(lotWidth) || 0,
      lotLength: Number(lotLength) || 0,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      description: description.trim() || undefined,
      addons:
        addons
          .map((a) => ({ id: a.id, label: a.label.trim(), price: Number(a.price) || 0 }))
          .filter((a) => a.label) || [],
    };

    try {
      await createProject({
        data,
        coverFile,
        galleryFiles: galleryFiles ?? undefined,
      });

      // limpa o formulário
      setTitle("");
      setPrice(0);
      setArea(0);
      setBedrooms(0);
      setBathrooms(0);
      setLotWidth(0);
      setLotLength(0);
      setTagsText("");
      setDescription("");
      setAddons([]);

      setCoverFile(null);
      setGalleryFiles(null);

      // limpa os inputs file com segurança (sem mexer no DOM direto)
      if (coverRef.current) coverRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ??
          "Não foi possível salvar. Verifique sua conexão e as regras do Firebase Storage/Firestore."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold">Painel Administrativo</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Título</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Preço (R$)</span>
          <input
            type="number"
            className="w-full rounded-lg border px-3 py-2"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            min={0}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Área (m²)</span>
          <input
            type="number"
            className="w-full rounded-lg border px-3 py-2"
            value={area}
            onChange={(e) => setArea(Number(e.target.value))}
            min={0}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Quartos</span>
          <input
            type="number"
            className="w-full rounded-lg border px-3 py-2"
            value={bedrooms}
            onChange={(e) => setBedrooms(Number(e.target.value))}
            min={0}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Banheiros</span>
          <input
            type="number"
            className="w-full rounded-lg border px-3 py-2"
            value={bathrooms}
            onChange={(e) => setBathrooms(Number(e.target.value))}
            min={0}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Largura do terreno (m)</span>
          <input
            type="number"
            className="w-full rounded-lg border px-3 py-2"
            value={lotWidth}
            onChange={(e) => setLotWidth(Number(e.target.value))}
            min={0}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Comprimento do terreno (m)</span>
          <input
            type="number"
            className="w-full rounded-lg border px-3 py-2"
            value={lotLength}
            onChange={(e) => setLotLength(Number(e.target.value))}
            min={0}
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-zinc-600">Tags (separe por vírgula)</span>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="Sobrado, Piscina, Área Gourmet"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-zinc-600">Descrição</span>
          <textarea
            className="w-full rounded-lg border px-3 py-2 min-h-[90px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Um projeto moderno e funcional..."
          />
        </label>

        {/* Addons */}
        <div className="sm:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Serviços adicionais (opcional)</span>
            <button
              type="button"
              className="text-amber-700 text-sm hover:underline"
              onClick={addEmptyAddon}
            >
              + Adicionar item
            </button>
          </div>
          <div className="space-y-2">
            {addons.map((a) => (
              <div key={a.id} className="grid grid-cols-6 gap-2">
                <input
                  className="col-span-4 rounded-lg border px-3 py-2"
                  placeholder="Ex.: Projeto Elétrico"
                  value={a.label}
                  onChange={(e) => updateAddon(a.id, { label: e.target.value })}
                />
                <input
                  type="number"
                  className="col-span-1 rounded-lg border px-3 py-2"
                  placeholder="Preço"
                  min={0}
                  value={a.price}
                  onChange={(e) => updateAddon(a.id, { price: Number(e.target.value) })}
                />
                <button
                  type="button"
                  className="col-span-1 rounded-lg border px-3 py-2 hover:bg-zinc-50"
                  onClick={() => removeAddon(a.id)}
                >
                  Remover
                </button>
              </div>
            ))}
            {addons.length === 0 && (
              <p className="text-xs text-zinc-500">Nenhum addon. Clique em “Adicionar item”.</p>
            )}
          </div>
        </div>

        {/* Uploads */}
        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Imagem principal</span>
          <input
            ref={coverRef}
            id="cover-input"
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-zinc-600">Galeria (múltiplas)</span>
          <input
            ref={galleryRef}
            id="gallery-input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setGalleryFiles(Array.from(e.target.files ?? []))}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-amber-600 px-4 py-2 text-white font-medium hover:bg-amber-700 disabled:opacity-60"
      >
        {saving ? "Salvando…" : "Salvar Projeto"}
      </button>
    </form>
  );
}
