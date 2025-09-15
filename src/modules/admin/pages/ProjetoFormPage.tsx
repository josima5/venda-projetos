import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  upsertProjectWithUploads,
  generateProjectCode,
  randomId,
  type UpsertProject,
  type ProjectDoc,
  type AddonSpec,
} from "../services/catalogService";
import { db } from "../../../firebase/config";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Check, ImagePlus, Plus, Trash2, Wand2 } from "lucide-react";

/* ---------- helpers ---------- */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FEATURE_SUGGESTIONS = ["Piscina", "Área Gourmet", "Escritório", "Home Theater"];

type EditState = UpsertProject & {
  id?: string;
  /** string[] (chips) ou string "a,b,c" enquanto digita */
  tags?: string[] | string;
};

function NumberField({
  label,
  value,
  onChange,
  min,
  step = 1,
  hint,
}: {
  label: string;
  value: number | undefined | null;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  hint?: string;
}) {
  const v = Number(value ?? 0);
  const dec = () => onChange(Math.max(min ?? Number.MIN_SAFE_INTEGER, v - step));
  const inc = () => onChange(v + step);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <div className="flex rounded-lg border bg-white">
        <button type="button" className="px-2 text-zinc-600 hover:bg-zinc-50" onClick={dec}>
          –
        </button>
        <input
          type="number"
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm outline-none"
        />
        <button type="button" className="px-2 text-zinc-600 hover:bg-zinc-50" onClick={inc}>
          +
        </button>
      </div>
      {hint ? <span className="text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function Chip({ children, onRemove }: { children: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs">
      {children}
      {onRemove && (
        <button
          type="button"
          className="text-zinc-500 hover:text-zinc-700"
          onClick={onRemove}
          title="Remover"
        >
          ×
        </button>
      )}
    </span>
  );
}

/* ---------- página ---------- */
export default function ProjetoFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<EditState>({
    active: true,
    order: 0,
    price: 0,
    area: 0,
    bedrooms: 0,
    bathrooms: 0,
  });

  // uploads
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  // util patch
  const patch = <K extends keyof EditState,>(k: K, v: EditState[K]) => {
    setDirty(true);
    setForm((s) => ({ ...s, [k]: v }));
  };

  // adicionais
  function addAddon() {
    const next: AddonSpec[] = Array.isArray(form.addons) ? [...form.addons] : [];
    next.push({ id: randomId(), label: "", price: 0, active: true });
    patch("addons", next);
  }
  function patchAddon(i: number, p: Partial<AddonSpec>) {
    const next = [...(form.addons || [])];
    next[i] = { ...next[i], ...p };
    patch("addons", next);
  }
  function removeAddon(i: number) {
    const next = [...(form.addons || [])];
    next.splice(i, 1);
    patch("addons", next);
  }

  // carregar doc (edição)
  useEffect(() => {
    if (!id) {
      // gerar código default ao criar
      patch("code", generateProjectCode());
      return;
    }
    const off = onSnapshot(doc(db, "projects", id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as ProjectDoc;
      setForm({
        ...data,
        id: snap.id,
      });
      setDirty(false);
      setCoverFile(null);
      setGalleryFiles([]);
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // salvar
  async function handleSave() {
    if (!form.title || form.title.trim().length === 0) {
      window.alert("Informe o título do projeto.");
      return;
    }
    setSaving(true);
    try {
      const newId = await upsertProjectWithUploads({
        ...form,
        galleryFiles,
        coverFile,
      });
      setDirty(false);
      navigate(`/admin/catalogo/${newId}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  // atalho Ctrl/Cmd + S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSave) {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, coverFile, galleryFiles]);

  // preview calculada (★ corrige TS p/ tags)
  const preview: ProjectDoc = useMemo(
    () => ({
      id: form.id || "__preview__",
      title: form.title || "Projeto sem título",
      price: Number(form.price || 0),
      area: Number(form.area || 0),
      bedrooms: Number(form.bedrooms || 0),
      bathrooms: Number(form.bathrooms || 0),
      lotWidth: form.lotWidth ?? undefined,
      lotLength: form.lotLength ?? undefined,
      active: form.active !== false,
      mainImageUrl: coverFile ? URL.createObjectURL(coverFile) : (form.mainImageUrl || undefined),
      tags: Array.isArray(form.tags)
        ? form.tags
        : typeof form.tags === "string"
        ? String(form.tags)
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
      features: form.features || [],
    }),
    [form, coverFile]
  );

  const lotHint =
    (form.lotWidth ?? 0) > 0 && (form.lotLength ?? 0) > 0
      ? `Terreno ≥ ${form.lotWidth}×${form.lotLength} m (${(form.lotWidth || 0) * (form.lotLength || 0)} m²)`
      : undefined;

  return (
    <div className="space-y-4">
      {/* topo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/catalogo" className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <h1 className="text-lg font-semibold">{isNew ? "Novo Projeto" : "Editar Projeto"}</h1>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/catalogo")}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {/* barra fixa de ações (mobile / dirty) */}
      {dirty && (
        <div className="sticky top-14 z-30 flex items-center justify-between rounded-lg border bg-amber-50 px-3 py-2 text-sm">
          <span className="text-amber-800">Você tem alterações não salvas.</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              Salvar agora
            </button>
          </div>
        </div>
      )}

      {/* grid principal */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* form */}
        <section className="lg:col-span-8 space-y-6">
          {/* bloco: dados gerais */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Dados</h2>
              <div className="text-xs text-zinc-500">{new Date().toLocaleString("pt-BR")}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Código do projeto</span>
                <div className="flex rounded-lg border bg-white">
                  <input
                    className="w-full px-3 py-2 text-sm outline-none"
                    value={form.code || ""}
                    onChange={(e) => patch("code", e.target.value)}
                    placeholder="PRJ-2025-XXXXX"
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2 text-zinc-600 hover:bg-zinc-50"
                    title="Gerar automaticamente"
                    onClick={() => patch("code", generateProjectCode())}
                  >
                    <Wand2 className="h-4 w-4" /> Gerar
                  </button>
                </div>
              </label>

              <div className="hidden md:block" />

              <label className="md:col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Título *</span>
                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={form.title || ""}
                  onChange={(e) => patch("title", e.target.value)}
                  placeholder="Ex.: Projeto Minha Casa"
                />
                {!form.title ? (
                  <span className="text-[11px] text-rose-600">Obrigatório</span>
                ) : (
                  <span className="text-[11px] text-zinc-500">Um nome claro ajuda na busca.</span>
                )}
              </label>

              <NumberField
                label="Preço base"
                value={form.price ?? 0}
                onChange={(v) => patch("price", v)}
                min={0}
                step={50}
                hint={BRL.format(Number(form.price || 0))}
              />
              <NumberField label="Quartos" value={form.bedrooms ?? 0} onChange={(v) => patch("bedrooms", v)} min={0} />
              <NumberField label="Banheiros" value={form.bathrooms ?? 0} onChange={(v) => patch("bathrooms", v)} min={0} />
              <NumberField label="Ordem" value={form.order ?? 0} onChange={(v) => patch("order", v)} min={0} />

              <NumberField label="Área (m²)" value={form.area ?? 0} onChange={(v) => patch("area", v)} min={0} />
              <NumberField
                label="Comprimento do terreno (m)"
                value={form.lotLength ?? 0}
                onChange={(v) => patch("lotLength", v)}
                min={0}
              />
              <NumberField
                label="Largura do terreno (m)"
                value={form.lotWidth ?? 0}
                onChange={(v) => patch("lotWidth", v)}
                min={0}
                hint={lotHint}
              />
              <div className="hidden md:block" />

              <NumberField
                label="Comprimento da casa (m)"
                value={form.houseLength ?? 0}
                onChange={(v) => patch("houseLength", v)}
                min={0}
              />
              <NumberField
                label="Largura da casa (m)"
                value={form.houseWidth ?? 0}
                onChange={(v) => patch("houseWidth", v)}
                min={0}
              />

              <div className="md:col-span-2 grid grid-cols-4 gap-3">
                <NumberField
                  label="Afast. frontal (m)"
                  value={form.setbacks?.front ?? 0}
                  onChange={(v) => patch("setbacks", { ...(form.setbacks || {}), front: v })}
                  min={0}
                />
                <NumberField
                  label="Fundos (m)"
                  value={form.setbacks?.back ?? 0}
                  onChange={(v) => patch("setbacks", { ...(form.setbacks || {}), back: v })}
                  min={0}
                />
                <NumberField
                  label="Lado dir. (m)"
                  value={form.setbacks?.right ?? 0}
                  onChange={(v) => patch("setbacks", { ...(form.setbacks || {}), right: v })}
                  min={0}
                />
                <NumberField
                  label="Lado esq. (m)"
                  value={form.setbacks?.left ?? 0}
                  onChange={(v) => patch("setbacks", { ...(form.setbacks || {}), left: v })}
                  min={0}
                />
              </div>

              <label className="md:col-span-2 flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={(e) => patch("active", e.target.checked)}
                />
                <span className="text-sm">Projeto ativo</span>
              </label>

              <label className="md:col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Descrição</span>
                <textarea
                  className="min-h-[90px] rounded-lg border px-3 py-2 text-sm"
                  value={form.description || ""}
                  onChange={(e) => patch("description", e.target.value)}
                />
              </label>

              {/* tags */}
              <label className="md:col-span-2 flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-600">Tags (separe por vírgula)</span>
                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={
                    Array.isArray(form.tags)
                      ? form.tags.join(", ")
                      : typeof form.tags === "string"
                      ? form.tags
                      : ""
                  }
                  onChange={(e) => patch("tags", e.target.value as unknown as EditState["tags"])}
                />
              </label>

              {/* features */}
              <div className="md:col-span-2 space-y-2">
                <div className="text-xs font-medium text-zinc-600">Equipamentos / Características</div>
                <div className="flex flex-wrap gap-2">
                  {(form.features || []).map((f) => (
                    <Chip key={f} onRemove={() => patch("features", (form.features || []).filter((x) => x !== f))}>
                      {f}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {FEATURE_SUGGESTIONS.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
                      onClick={() =>
                        !form.features?.includes(s) && patch("features", [...(form.features || []), s])
                      }
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* bloco: adicionais */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Adicionais</h2>
              <button
                type="button"
                onClick={addAddon}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90"
              >
                <Plus className="h-4 w-4" /> Adicional
              </button>
            </div>

            <div className="space-y-2">
              {(form.addons || []).map((a, i) => (
                <div key={a.id || i} className="grid grid-cols-1 gap-2 rounded-lg border p-2 md:grid-cols-12">
                  <input
                    className="md:col-span-7 rounded border px-3 py-2 text-sm"
                    placeholder="Rótulo (ex.: Projeto Elétrico)"
                    value={a.label}
                    onChange={(e) => patchAddon(i, { label: e.target.value })}
                  />
                  <input
                    type="number"
                    className="md:col-span-3 rounded border px-3 py-2 text-sm"
                    placeholder="Preço"
                    value={a.price}
                    onChange={(e) => patchAddon(i, { price: Number(e.target.value) })}
                  />
                  <label className="md:col-span-1 flex items-center justify-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={a.active !== false}
                      onChange={(e) => patchAddon(i, { active: e.target.checked })}
                    />
                    Ativo
                  </label>
                  <div className="md:col-span-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeAddon(i)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </button>
                  </div>
                </div>
              ))}
              {(form.addons || []).length === 0 && (
                <p className="text-sm text-zinc-500">Nenhum adicional cadastrado.</p>
              )}
            </div>
          </div>

          {/* bloco: imagens */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Imagens</h2>

            {/* capa */}
            <div className="mb-4">
              <p className="mb-1 text-xs font-medium text-zinc-600">Capa</p>
              <DropArea
                onFiles={(files) => setCoverFile(files[0] || null)}
                multiple={false}
                currentPreview={coverFile ? URL.createObjectURL(coverFile) : form.mainImageUrl || undefined}
              />
            </div>

            {/* galeria */}
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">Galeria</p>
              <DropArea
                onFiles={(files) => setGalleryFiles(files)}
                multiple
                currentPreviewList={galleryFiles.map((f) => URL.createObjectURL(f))}
              />
              {!!galleryFiles.length && (
                <p className="mt-2 text-[11px] text-zinc-500">
                  {galleryFiles.length} arquivo(s) novo(s) pronto(s) para upload.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* preview */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">Pré-visualização</h3>
            <div className="overflow-hidden rounded-xl border">
              {preview.mainImageUrl ? (
                <img src={preview.mainImageUrl} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-zinc-100 text-sm text-zinc-500">
                  Sem imagem
                </div>
              )}
              <div className="space-y-1 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{preview.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${
                      preview.active
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                        : "bg-zinc-50 text-zinc-600 ring-zinc-500/20"
                    }`}
                  >
                    {preview.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="text-sm">{BRL.format(preview.price || 0)}</p>
                <p className="text-xs text-zinc-600">
                  {preview.area} m² • {preview.bedrooms} qtos • {preview.bathrooms} banh
                  {preview.lotWidth && preview.lotLength ? ` • Terreno ≥ ${preview.lotWidth}×${preview.lotLength} m` : ""}
                </p>
                {!!preview.tags?.length && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {preview.tags!.map((t) => (
                      <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 text-xs text-zinc-600 shadow-sm">
            <p className="font-medium">Dicas</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Use nomes claros (ex.: “Residencial A – 60 m²”).</li>
              <li>Defina “Ordem” para organizar a listagem.</li>
              <li>
                Atalho: <kbd>Ctrl/Cmd + S</kbd> salva rapidamente.
              </li>
            </ul>
          </div>

          <div className="md:hidden sticky bottom-3 z-30 rounded-xl border bg-white p-3 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => navigate("/admin/catalogo")} className="rounded-lg border px-3 py-2 text-sm">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- drop area ---------- */
function DropArea({
  onFiles,
  multiple,
  currentPreview,
  currentPreviewList,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  currentPreview?: string;
  currentPreviewList?: string[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function handleFiles(fs: FileList | null) {
    if (!fs) return;
    onFiles(Array.from(fs));
  }

  function prevent(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      ref={ref}
      onDragEnter={prevent}
      onDragOver={prevent}
      onDrop={(e) => {
        prevent(e);
        handleFiles(e.dataTransfer.files);
      }}
      className="rounded-xl border border-dashed p-3 text-center"
    >
      <label className="mx-auto flex cursor-pointer flex-col items-center gap-2">
        <ImagePlus className="h-6 w-6 text-zinc-500" />
        <span className="text-xs text-zinc-600">Arraste e solte aqui ou clique para selecionar</span>
        <input
          type="file"
          accept="image/*"
          multiple={!!multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {currentPreview && (
        <img src={currentPreview} alt="" className="mx-auto mt-3 h-32 w-auto rounded object-cover" />
      )}
      {!!currentPreviewList?.length && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {currentPreviewList.map((src, i) => (
            <img key={i} src={src} alt="" className="h-20 w-full rounded object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
