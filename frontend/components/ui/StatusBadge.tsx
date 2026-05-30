export type StatusTone = "success" | "warning" | "critical" | "info" | "neutral" | "ai";

/** Single source of truth for tone -> class mapping (Badge reuses this). */
export const toneClasses: Record<StatusTone, string> = {
  ai: "border-brand-subtle-line bg-brand-subtle text-brand-fg",
  critical: "border-danger-line bg-danger-subtle text-danger-surface-fg",
  info: "border-info-line bg-info-subtle text-info-surface-fg",
  neutral: "border-line bg-sunken text-fg-muted",
  success: "border-success-line bg-success-subtle text-success-surface-fg",
  warning: "border-warning-line bg-warning-subtle text-warning-surface-fg",
};

export function statusTone(status: string | null | undefined): StatusTone {
  const normalized = status?.toLowerCase() ?? "";
  if (["active", "completed", "healthy", "indexed", "success"].includes(normalized)) {
    return "success";
  }
  if (["processing", "running"].includes(normalized)) {
    return "info";
  }
  if (["pending", "queued", "uploaded", "warning"].includes(normalized)) {
    return "warning";
  }
  if (["critical", "deleted", "failed", "inactive", "error"].includes(normalized)) {
    return "critical";
  }
  return "neutral";
}

type StatusBadgeProps = {
  label?: string;
  status?: string | null;
  tone?: StatusTone;
};

export function StatusBadge({ label, status, tone }: StatusBadgeProps) {
  const resolvedTone = tone ?? statusTone(status);
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs font-medium capitalize ${toneClasses[resolvedTone]}`}
    >
      <span className="truncate">{label ?? status ?? "unknown"}</span>
    </span>
  );
}
