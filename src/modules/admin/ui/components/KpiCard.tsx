// src/modules/admin/ui/components/KpiCard.tsx
import type { ComponentType, ReactNode } from "react";

type IconProps = { className?: string };
type Props = {
  title: string;
  value: ReactNode;
  icon: ComponentType<IconProps>;
  hint?: ReactNode;
};

export default function KpiCard({ title, value, icon: Icon, hint }: Props) {
  return (
    <div className="p-5 bg-white border rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <h3 className="mt-2 text-2xl font-bold text-slate-800">{value}</h3>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
