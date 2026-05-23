export type StatusTone = "success" | "warning" | "critical" | "info" | "neutral" | "ai";

const toneClasses: Record<StatusTone, string> = {
  ai: "border-violet-200 bg-violet-50 text-violet-700",
  critical: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
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
