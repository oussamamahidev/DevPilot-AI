import type { AdminStats, RagOpsWorkspaceSummary } from "@/types";
import type { OverviewMetrics } from "@/features/ragops/types";
import {
  AwaitingTelemetry,
  CountStat,
  fmtNumber,
  fmtPercent,
} from "@/features/ragops/components/primitives";

export function RetrievalIntelligence({
  overview,
  stats,
  workspaces,
}: {
  overview: OverviewMetrics;
  stats: AdminStats | undefined;
  workspaces: RagOpsWorkspaceSummary[];
}) {
  const ranked = [...workspaces]
    .sort((a, b) => a.embedding_coverage_percent - b.embedding_coverage_percent)
    .slice(0, 8);
  const retrievedChunks = stats?.rag.retrieved_chunks ?? null;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <CountStat
          label="Avg Retrieval Latency"
          value={overview.avgLatencyMs != null ? `${fmtNumber(overview.avgLatencyMs)} ms` : "—"}
          icon="activity"
          footer="end-to-end query latency"
        />
        <CountStat
          label="Retrieved Chunks"
          value={retrievedChunks != null ? fmtNumber(retrievedChunks) : "—"}
          icon="layers"
          footer="context chunks served"
        />
        <CountStat
          label="Retrieval Success Rate"
          value={overview.retrievalSuccessRate != null ? fmtPercent(overview.retrievalSuccessRate) : "—"}
          icon="check"
          footer="queries with usable context"
        />
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-fg">Retrieval readiness by workspace</p>
        {ranked.length === 0 ? (
          <p className="text-sm text-fg-subtle">No workspaces yet.</p>
        ) : (
          <div className="grid gap-2.5">
            {ranked.map((workspace) => {
              const coverage = Math.max(0, Math.min(100, workspace.embedding_coverage_percent));
              const cls = coverage >= 85 ? "bg-success" : coverage >= 60 ? "bg-warning" : "bg-danger";
              return (
                <div
                  key={workspace.workspace_id}
                  className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3"
                >
                  <span className="truncate text-sm text-fg-muted">{workspace.workspace_name}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-sunken">
                    <div className={`h-full rounded-full ${cls}`} style={{ width: `${coverage}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-fg">{coverage.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        )}
        {workspaces.length > 8 ? (
          <p className="mt-3 text-xs text-fg-subtle">
            Showing the 8 lowest-coverage of {fmtNumber(workspaces.length)} workspaces.
          </p>
        ) : null}
      </div>

      <AwaitingTelemetry
        label="Retrieval quality / latency / success trends (time-series) and top retrieved documents"
        endpoint="GET /admin/ragops/retrieval/timeseries"
      />
    </div>
  );
}
