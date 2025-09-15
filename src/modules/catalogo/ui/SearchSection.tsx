import { useEffect, useRef, useState } from "react";
import AdvancedSearch from "./AdvancedSearch";

type Props = {
  onSearch: (q: string) => void;
  filters: Record<string, any>;
  onFilterChange: (next: Record<string, any>) => void;
  onClearFilters: () => void;
};

export default function SearchSection({ onSearch, filters, onFilterChange, onClearFilters }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onSearch(q);
  }, [q, onSearch]);

  return (
    <div className="relative -mt-12">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5">
          <div className="flex items-center rounded-xl border px-3">
            <svg width="18" height="18" viewBox="0 0 24 24" className="text-zinc-500">
              <path
                fill="currentColor"
                d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 0 0 1.57-4.23A6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5ZM5 9.5C5 7.01 7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14S5 11.99 5 9.5Z"
              />
            </svg>
            <input
              className="h-12 flex-1 px-3 outline-none"
              placeholder="Busque pelo nome ou características do projeto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="px-2">
            <button
              className="mx-auto mt-2 block text-sm font-medium text-amber-700 hover:underline"
              type="button"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Fechar Busca Avançada" : "Busca Avançada"}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="mx-auto mt-3 max-w-5xl">
          <AdvancedSearch
            filters={filters}
            onFilterChange={onFilterChange}
            onClear={onClearFilters}
          />
        </div>
      )}
    </div>
  );
}
