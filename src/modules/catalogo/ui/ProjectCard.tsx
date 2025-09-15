import type { ProjectDoc } from "../types";

export default function ProjectCard({
  project,
  onView,
}: {
  project: ProjectDoc;
  onView: () => void;
}) {
  const { title, mainImageUrl, area, bedrooms, bathrooms } = project;

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="aspect-[16/10] w-full bg-zinc-100">
        {mainImageUrl ? (
          <img
            src={mainImageUrl}
            alt={title}
            className="h-full w-full object-cover"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        <div className="font-medium">{title}</div>
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z"/></svg>
            {Number(area || 0)} m²
          </span>
          <span className="inline-flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M4 8h16v10H4zM6 6h12v2H6z"/></svg>
            {Number(bedrooms || 0)} quartos
          </span>
          <span className="inline-flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M5 4h14v16H5z"/></svg>
            {Number(bathrooms || 0)} banheiros
          </span>
        </div>

        <button
          className="mt-1 w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          onClick={onView}
        >
          Ver Detalhes
        </button>
      </div>
    </div>
  );
}
