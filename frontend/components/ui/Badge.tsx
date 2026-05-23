import type { ReactNode } from "react";
import type { StatusTone } from "@/components/ui/StatusBadge";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: StatusTone;
};

const toneClasses: Record<StatusTone, string> = {
  ai: "border-violet-200 bg-violet-50 text-violet-700",
  critical: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function Badge({ children, className = "", tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs font-medium ${toneClasses[tone]} ${className}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
