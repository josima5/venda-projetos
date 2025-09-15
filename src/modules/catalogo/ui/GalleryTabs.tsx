import { useMemo, useState } from "react";

type Props = {
  mainImageUrl?: string;
  galleryUrls?: string[];
  labels?: string[]; // rótulos das abas; se não vier, geramos padrão
};

export default function GalleryTabs({ mainImageUrl, galleryUrls = [], labels }: Props) {
  const items = useMemo(() => {
    const all = [mainImageUrl, ...galleryUrls].filter(Boolean) as string[];
    if (!all.length) return [] as { url: string; label: string }[];

    const defaultLabels = ["Fachada", "Planta Humanizada", "Vista Lateral", "Interior"];
    const effectiveLabels = labels && labels.length ? labels : defaultLabels;

    return all.map((url, i) => ({
      url,
      label: effectiveLabels[i] ?? `Imagem ${i + 1}`,
    }));
  }, [mainImageUrl, galleryUrls, labels]);

  const [active, setActive] = useState(0);

  if (!items.length) {
    return (
      <div className="w-full aspect-[16/9] rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400">
        Sem imagens
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="w-full aspect-[16/9] overflow-hidden rounded-xl bg-zinc-100">
        {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
        <img
          src={items[active].url}
          alt={`Imagem ${active + 1}`}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((it, i) => (
          <button
            key={i}
            className={`shrink-0 rounded-lg border ${
              i === active ? "border-amber-600" : "border-zinc-200"
            }`}
            onClick={() => setActive(i)}
            title={it.label}
          >
            <img
              src={it.url}
              alt={it.label}
              className="h-16 w-24 object-cover rounded-lg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          </button>
        ))}
      </div>

      <div className="text-xs text-zinc-600">{items[active].label}</div>
    </div>
  );
}
