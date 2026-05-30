import type { ReactNode } from "react";
import { toneClasses, type StatusTone } from "@/components/ui/StatusBadge";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: StatusTone;
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
