import type { ReactNode } from "react";
import { toneClasses, type StatusTone } from "@/components/ui/StatusBadge";

type BadgeSize = "sm" | "md";

type BadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: StatusTone;
  /** Leading icon node (e.g. <Icon name="…" size={12} />). */
  icon?: ReactNode;
  size?: BadgeSize;
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "gap-1 px-1.5 py-0.5 text-[11px]",
  md: "gap-1.5 px-2 py-1 text-xs",
};

/**
 * Tone pill — the single badge primitive. Domain badges (status, role,
 * quality, risk, health) are presets/wrappers over this + {@link StatusBadge}.
 */
export function Badge({ children, className = "", tone = "neutral", icon, size = "md" }: BadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md border font-medium ${sizeClasses[size]} ${toneClasses[tone]} ${className}`}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
