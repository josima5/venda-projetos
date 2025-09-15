// src/components/NumberStepper.tsx
import { Minus, Plus } from "lucide-react";

type Props = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  "aria-label"?: string;
};

export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  className = "",
  ...rest
}: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div
      className={[
        "flex items-stretch overflow-hidden rounded-lg border",
        className,
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="grid place-items-center px-2 text-gray-600 hover:bg-gray-50"
        aria-label="Diminuir"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="w-20 border-x px-2 text-center outline-none"
        {...rest}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="grid place-items-center px-2 text-gray-600 hover:bg-gray-50"
        aria-label="Aumentar"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
