// src/modules/catalogo/ui/AddonsPicker.tsx
import { useEffect, useMemo, useState } from "react";
import type { Addon } from "../types";

type Props = {
  addons?: Addon[];
  onChange?: (selected: Addon[], totalExtras: number) => void;
};

function formatBRL(v: number) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v || 0);
  } catch {
    return `R$ ${(Number(v) || 0).toFixed(2)}`;
  }
}

export default function AddonsPicker({ addons = [], onChange }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pré-seleciona apenas se existir a flag "checkedByDefault" em dados antigos.
  // Não faz parte do tipo Addon atual; leitura é opcional e segura.
  useEffect(() => {
    const preset = new Set<string>(
      addons
        .filter((a) => (a as any)?.checkedByDefault === true)
        .map((a) => a.id)
    );
    setSelectedIds(preset); // vazio caso não haja a flag
  }, [addons]);

  const selected = useMemo(
    () => addons.filter((a) => selectedIds.has(a.id)),
    [addons, selectedIds]
  );

  const extrasTotal = useMemo(
    () => selected.reduce((acc, a) => acc + (Number(a.price) || 0), 0),
    [selected]
  );

  useEffect(() => {
    onChange?.(selected, extrasTotal);
  }, [selected, extrasTotal, onChange]);

  if (!addons.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="font-medium">Personalize seu projeto</h4>

      <div className="space-y-2">
        {addons.map((a) => {
          const checked = selectedIds.has(a.id);
          return (
            <label
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(selectedIds);
                    if (e.target.checked) next.add(a.id);
                    else next.delete(a.id);
                    setSelectedIds(next);
                  }}
                />
                {/* usa 'label' (não existe 'name' em Addon) */}
                <span className="text-sm">{a.label}</span>
              </div>

              <span className="text-sm text-zinc-700">
                + {formatBRL(Number(a.price) || 0)}
              </span>
            </label>
          );
        })}
      </div>

      <div className="text-sm text-zinc-600">
        Adicionais: <span className="font-medium">{formatBRL(extrasTotal)}</span>
      </div>
    </div>
  );
}
