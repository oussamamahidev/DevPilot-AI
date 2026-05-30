import { Icon, type IconName } from "@/components/ui/Icon";
import type { RagOpsQdrantHealth } from "@/types";
import { AwaitingTelemetry, fmtNumber } from "@/features/ragops/components/primitives";

type SubStatus = "healthy" | "degraded" | "down" | "unknown";
type Subsystem = { name: string; icon: IconName; status: SubStatus; detail: string };

function statusMeta(status: SubStatus) {
  switch (status) {
    case "healthy":
      return { dot: "bg-success", label: "Operational", cls: "text-success-fg", ring: "border-success-line" };
    case "degraded":
      return { dot: "bg-warning", label: "Degraded", cls: "text-warning-fg", ring: "border-warning-line" };
    case "down":
      return { dot: "bg-danger", label: "Down", cls: "text-danger-fg", ring: "border-danger-line" };
    default:
      return { dot: "bg-line-strong", label: "Not monitored", cls: "text-fg-subtle", ring: "border-line" };
  }
}

function SubsystemCard({ subsystem }: { subsystem: Subsystem }) {
  const meta = statusMeta(subsystem.status);
  return (
    <div className={`rounded-xl border bg-surface p-4 shadow-sm ${meta.ring}`}>
      <div className="flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-sunken text-fg-muted">
          <Icon name={subsystem.icon} size={16} />
        </span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.cls}`}>
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
      <p className="mt-3 font-semibold text-fg">{subsystem.name}</p>
      <p className="mt-1 truncate text-xs text-fg-subtle">{subsystem.detail}</p>
    </div>
  );
}

export function OperationsCenter({
  qdrant,
  hasStats,
}: {
  qdrant: RagOpsQdrantHealth | undefined;
  hasStats: boolean;
}) {
  const qdrantStatus: SubStatus =
    qdrant == null ? "unknown" : qdrant.reachable ? ((qdrant.mismatch_count ?? 0) > 0 ? "degraded" : "healthy") : "down";

  const subsystems: Subsystem[] = [
    {
      name: "Qdrant",
      icon: "box",
      status: qdrantStatus,
      detail:
        qdrant == null
          ? "Awaiting health check"
          : qdrant.reachable
            ? `${fmtNumber(qdrant.qdrant_vectors_count ?? 0)} vectors · ${qdrant.collection_name}`
            : qdrant.error ?? "Unreachable",
    },
    {
      name: "PostgreSQL",
      icon: "layers",
      status: hasStats ? "healthy" : "down",
      detail: hasStats ? "Serving admin + RAG metadata" : "Stats query failed",
    },
    {
      name: "Backend API",
      icon: "activity",
      status: hasStats ? "healthy" : "degraded",
      detail: hasStats ? "Responding to admin requests" : "Degraded responses",
    },
    { name: "Redis", icon: "box", status: "unknown", detail: "No health endpoint exposed" },
    { name: "Celery", icon: "activity", status: "unknown", detail: "No worker telemetry exposed" },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {subsystems.map((subsystem) => (
          <SubsystemCard key={subsystem.name} subsystem={subsystem} />
        ))}
      </div>
      <AwaitingTelemetry label="Redis & Celery worker health" endpoint="GET /admin/health/infra" />
    </div>
  );
}
