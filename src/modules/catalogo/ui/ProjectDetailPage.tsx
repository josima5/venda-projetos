import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProjectDoc, Addon } from "../types";
import AddonsPicker from "./AddonsPicker";

type Props = {
  project: ProjectDoc;
  onBack?: () => void;
};

function reais(n: number) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(n || 0);
  } catch {
    return `R$ ${Number(n || 0).toFixed(2)}`;
  }
}

export default function ProjectDetailPage({ project, onBack }: Props) {
  const navigate = useNavigate();

  const {
    title,
    description = "",
    area,
    bedrooms,
    bathrooms,
    price,
    tags = [],
    mainImageUrl = "",
    galleryUrls = [],
    images = [],
    addons = [],
  } = project;

  const imageSet: { label?: string; url?: string }[] = useMemo(() => {
    if (images?.length) return images;
    const base: { label?: string; url?: string }[] = [];
    if (mainImageUrl) base.push({ label: "Fachada", url: mainImageUrl });
    const labels = ["Planta Humanizada", "Vista Lateral", "Interior"];
    const rest = galleryUrls.map((u, i) => ({
      label: labels[i] || `Imagem ${i + 1}`,
      url: u,
    }));
    return [...base, ...rest];
  }, [images, mainImageUrl, galleryUrls]);

  const [current, setCurrent] = useState(0);

  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [extrasTotal, setExtrasTotal] = useState(0);

  const base = Number(price || 0);
  const total = base + extrasTotal;

  function handleBuy() {
    navigate(`/checkout/${project.id}`, {
      state: { selectedAddons },
    });
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        className="text-sm text-zinc-600 hover:text-zinc-800 inline-flex items-center gap-2"
        onClick={onBack}
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="currentColor" d="m10 19l-7-7l7-7l1.4 1.4L6.8 11H21v2H6.8l4.6 4.6z" />
        </svg>
        Voltar aos projetos
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="aspect-[16/10] w-full bg-zinc-100 flex items-center justify-center">
              {imageSet[current]?.url ? (
                <img
                  src={imageSet[current].url!}
                  alt={imageSet[current]?.label || title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-zinc-400 text-3xl sm:text-4xl font-semibold">
                  {imageSet[current]?.label || "Imagem"}
                </span>
              )}
            </div>

            {imageSet.length > 1 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white">
                {imageSet.map((it, i) => {
                  const active = i === current;
                  return (
                    <button
                      key={`${it.label}-${i}`}
                      className={`group relative h-20 sm:h-24 rounded-xl overflow-hidden border text-sm font-medium ${
                        active
                          ? "border-amber-500 ring-2 ring-amber-300/60"
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                      onClick={() => setCurrent(i)}
                      title={it.label}
                    >
                      {it.url ? (
                        <img
                          src={it.url}
                          alt={it.label}
                          className="h-full w-full object-cover"
                          onError={(e) =>
                            ((e.currentTarget as HTMLImageElement).style.display = "none")
                          }
                        />
                      ) : (
                        <div className="h-full w-full grid place-items-center bg-zinc-100 text-zinc-500">
                          {it.label || "Imagem"}
                        </div>
                      )}
                      {it.label && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-xs px-2 py-1">
                          {it.label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <h1 className="text-2xl font-semibold leading-snug">{title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600">
            <span className="inline-flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z" />
              </svg>
              {Number(area || 0)} m²
            </span>
            <span className="inline-flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M4 8h16v10H4zM6 6h12v2H6z" />
              </svg>
              {Number(bedrooms || 0)} quartos
            </span>
            <span className="inline-flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M5 4h14v16H5z" />
              </svg>
              {Number(bathrooms || 0)} banheiros
            </span>
          </div>

          {description && (
            <p className="text-sm leading-relaxed text-zinc-700">{description}</p>
          )}

          <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
            {addons.length > 0 && (
              <AddonsPicker
                addons={addons}
                onChange={(selected, totalExtras) => {
                  setSelectedAddons(selected);
                  setExtrasTotal(totalExtras);
                }}
              />
            )}

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-xs text-zinc-600">Valor total</div>
              <div className="text-2xl font-bold mt-1">{reais(total)}</div>
              <div className="text-[11px] text-zinc-500 mt-1">
                Em até 12x de {reais(total / 12)}
              </div>
            </div>

            <button
              type="button"
              className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-white font-medium hover:bg-emerald-700"
              onClick={handleBuy}
            >
              Comprar Pacote
            </button>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
        <h3 className="font-medium mb-3">O que você irá receber</h3>
        <ul className="text-sm text-zinc-700 space-y-2">
          <li className="flex items-start gap-2">
            <Check /> <span>Projeto Arquitetônico Completo: plantas baixas, cortes, fachadas e planta de cobertura.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check /> <span>Imagens 3D da Fachada: visualizações realistas para entender o resultado final.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check /> <span>Planta Baixa Humanizada: com sugestões de layout e mobiliário.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check /> <span>Quadro de Esquadrias: dimensões de portas e janelas.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check /> <span>Acesso Vitalício aos Arquivos: PDF e DWG (AutoCAD).</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        className="text-emerald-600"
        d="m9 16.2l-3.5-3.5L7 11.2l2 2l5-5l1.5 1.5z"
      />
    </svg>
  );
}
