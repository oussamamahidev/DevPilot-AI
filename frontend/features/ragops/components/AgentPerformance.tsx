import { EmptyState } from "@/components/ui/EmptyState";
import type { AdminStats, RagTraceQualitySummary } from "@/types";
import { AwaitingTelemetry, fmtNumber } from "@/features/ragops/components/primitives";

const ORDER = ["retrieval", "retriever", "reranker", "generator", "evaluator", "corrector"];

function prettify(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function latencyClass(ms: number) {
  return ms <= 1000 ? "bg-success" : ms <= 3000 ? "bg-warning" : "bg-danger";
}

export function AgentPerformance({
  stats,
  quality,
}: {
  stats: AdminStats | undefined;
  quality: RagTraceQualitySummary | undefined;
}) {
  const source =
    quality?.average_latency_by_agent && Object.keys(quality.average_latency_by_agent).length > 0
      ? quality.average_latency_by_agent
      : stats?.agents.avg_latency_ms_by_agent ?? {};
  const entries = Object.entries(source);
  entries.sort((a, b) => {
    const ia = ORDER.indexOf(a[0].toLowerCase());
    const ib = ORDER.indexOf(b[0].toLowerCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <div className="grid gap-4">
      {entries.length === 0 ? (
        <EmptyState
          title="No agent runs recorded"
          description="Agent latency appears once RAG queries have executed."
        />
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-fg">Average latency by agent</p>
            {stats?.agents.runs != null ? (
              <span className="text-xs text-fg-subtle">{fmtNumber(stats.agents.runs)} total runs</span>
            ) : null}
          </div>
          <div className="grid gap-2.5">
            {entries.map(([name, ms]) => (
              <div key={name} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3">
                <span className="truncate text-sm text-fg-muted">{prettify(name)}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
                  <div
                    className={`h-full rounded-full ${latencyClass(ms)}`}
                    style={{ width: `${(ms / max) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums text-fg">{fmtNumber(ms)} ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AwaitingTelemetry
        label="Per-agent success rate, error rate, and execution distribution"
        endpoint="GET /admin/ragops/agents/performance"
      />
    </div>
  );
}
