// src/components/ChipsInput.tsx
import { X } from "lucide-react";
import { useRef, useState } from "react";

export default function ChipsInput({
  values,
  onChange,
  placeholder = "Digite e pressione Enter",
  suggestions = [],
}: {
  values: string[];
  onChange: (list: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);

  function add(v: string) {
    const clean = v.trim();
    if (!clean) return;
    if (!values.includes(clean)) onChange([...values, clean]);
    setText("");
  }
  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  return (
    <div className="rounded-xl border p-2">
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs"
          >
            {v}
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-700"
              onClick={() => remove(v)}
              aria-label={`Remover ${v}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text) {
              // apaga o último chip
              const last = values[values.length - 1];
              if (last) remove(last);
            }
          }}
          className="min-w-[10ch] flex-1 px-2 py-1 text-sm outline-none"
          placeholder={placeholder}
        />
      </div>

      {!!suggestions.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200"
              onClick={() => add(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
