// src/components/CurrencyInput.tsx
import { useEffect, useMemo, useState } from "react";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function parseBRL(s: string): number {
  // mantém dígitos; interpreta como centavos
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

export default function CurrencyInput({
  value,
  onChange,
  className = "",
  placeholder = "R$ 0,00",
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(fmt.format(value || 0));
  const display = useMemo(() => fmt.format(value || 0), [value]);

  useEffect(() => {
    setRaw(display);
  }, [display]);

  return (
    <input
      inputMode="numeric"
      className={["rounded-lg border px-3 py-2", className].join(" ")}
      value={raw}
      placeholder={placeholder}
      onChange={(e) => {
        const n = parseBRL(e.target.value);
        setRaw(fmt.format(n));
        onChange(n);
      }}
      onBlur={() => setRaw(fmt.format(value || 0))}
    />
  );
}
