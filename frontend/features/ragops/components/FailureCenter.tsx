import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AdminErrorSummary, RagOpsWorkspaceSummary, RagTraceQualitySummary } from "@/types";
import type { OverviewMetrics } from "@/features/ragops/types";
import { CountStat, fmtNumber } from "@/features/ragops/components/primitives";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
function formatTime(value: string) {
  try {
    return dateFormat.format(new Date(value));
  } catch {
    return value;
  }
}

export function FailureCenter({
  overview,
  quality,
  errors,
  workspaces,
}: {
  overview: OverviewMetrics;
  quality: RagTraceQualitySummary | undefined;
  errors: AdminErrorSummary[];
  workspaces: RagOpsWorkspaceSummary[];
}) {
  const failedWorkspaces = workspaces
    .filter((workspace) => workspace.documents_failed > 0)
    .sort((a, b) => b.documents_failed - a.documents_failed);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <CountStat
          label="Failed Documents"
          value={fmtNumber(overview.failedDocuments)}
          icon="file"
          footer={
            overview.failedDocuments > 0 ? (
              <span className="text-danger-fg">ingestion failures</span>
            ) : (
              "none"
            )
          }
        />
        <CountStat
          label="No-context Retrievals"
          value={quality ? fmtNumber(quality.no_context_count) : "—"}
          icon="search"
          footer="queries with no context"
        />
        <CountStat
          label="Low-quality Answers"
          value={quality ? fmtNumber(quality.low_quality_count) : "—"}
          icon="alertCircle"
          footer="below quality threshold"
        />
        <CountStat
          label="Corrections Applied"
          value={quality ? fmtNumber(quality.corrected_answers_count) : "—"}
          icon="shield"
          footer="auto-corrected answers"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-fg">Recent platform incidents</p>
          {errors.length === 0 ? (
            <p className="text-sm text-fg-subtle">No incidents recorded.</p>
          ) : (
            <div className="grid gap-2">
              {errors.slice(0, 6).map((incident) => (
                <div key={incident.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                      {incident.source}
                    </span>
                    <StatusBadge status={incident.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-fg">{incident.message}</p>
                  <p className="mt-1 text-xs text-fg-subtle">{formatTime(incident.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-fg">Failed documents by workspace</p>
          {failedWorkspaces.length === 0 ? (
            <p className="text-sm text-success-fg">No failed documents — all clear.</p>
          ) : (
            <div className="grid gap-2">
              {failedWorkspaces.slice(0, 6).map((workspace) => (
                <div
                  key={workspace.workspace_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{workspace.workspace_name}</p>
                    <p className="text-xs text-fg-subtle">{fmtNumber(workspace.documents_failed)} failed</p>
                  </div>
                  <Link
                    href={`/admin/ragops/workspaces/${workspace.workspace_id}`}
                    className="inline-flex h-8 shrink-0 items-center rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    Retry in workspace
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
