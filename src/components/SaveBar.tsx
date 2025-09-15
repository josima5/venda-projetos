// src/components/SaveBar.tsx
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function SaveBar({
  dirty,
  saving,
  onSave,
  onCancel,
  lastSavedAt,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  lastSavedAt?: Date | null;
}) {
  if (!dirty && !saving) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center">
      <div className="flex items-center gap-3 rounded-2xl border bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
        <span className="text-xs text-gray-600">
          {saving
            ? "Salvando…"
            : dirty
            ? "Você tem alterações não salvas"
            : lastSavedAt
            ? `Salvo às ${lastSavedAt.toLocaleTimeString("pt-BR")}`
            : ""}
        </span>
        <button
          onClick={onCancel}
          className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar
        </button>
      </div>
    </div>
  );
}

// Dica: capture Ctrl/Cmd+S no nível da página
export function useSaveShortcut(handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}
