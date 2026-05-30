import type { OverviewMetrics } from "@/features/ragops/types";
import {
  CountStat,
  fmtNumber,
  fmtPercent,
  GaugeStat,
  HealthDot,
  qualityTone,
  riskTone,
  scoreTone,
  TargetDelta,
} from "@/features/ragops/components/primitives";

function ratioTone(rate: number) {
  return rate >= 0.9 ? "success" : rate >= 0.7 ? "warning" : "critical";
}

function MiniBar({ value, tone = "success" }: { value: number; tone?: "success" | "warning" | "critical" }) {
  const color = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-danger";
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ExecutiveOverview({ overview }: { overview: OverviewMetrics }) {
  const indexedRatio =
    overview.totalDocuments > 0 ? (overview.indexedDocuments / overview.totalDocuments) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      <GaugeStat
        label="RAG Health Score"
        percent={overview.ragHealthScore}
        centerText={`${overview.ragHealthScore}`}
        tone={scoreTone(overview.ragHealthScore)}
        footer={`${overview.statusCounts.healthy} healthy · ${overview.statusCounts.critical} critical`}
      />

      {overview.retrievalSuccessRate == null ? (
        <GaugeStat label="Retrieval Success Rate" percent={0} centerText="—" tone="neutral" footer="No queries yet" />
      ) : (
        <GaugeStat
          label="Retrieval Success Rate"
          percent={overview.retrievalSuccessRate * 100}
          centerText={fmtPercent(overview.retrievalSuccessRate)}
          tone={ratioTone(overview.retrievalSuccessRate)}
          footer="Queries with usable context"
        />
      )}

      {overview.faithfulness == null ? (
        <GaugeStat label="Faithfulness" percent={0} centerText="—" tone="neutral" footer="No evaluations yet" />
      ) : (
        <GaugeStat
          label="Faithfulness"
          percent={overview.faithfulness * 100}
          centerText={overview.faithfulness.toFixed(2)}
          tone={qualityTone(overview.faithfulness)}
          footer={<TargetDelta value={overview.faithfulness} target={0.75} />}
        />
      )}

      {overview.hallucination == null ? (
        <GaugeStat label="Hallucination Risk" percent={0} centerText="—" tone="neutral" footer="No evaluations yet" />
      ) : (
        <GaugeStat
          label="Hallucination Risk"
          percent={overview.hallucination * 100}
          centerText={overview.hallucination.toFixed(2)}
          tone={riskTone(overview.hallucination)}
          footer={<TargetDelta value={overview.hallucination} target={0.3} invert />}
        />
      )}

      <CountStat
        label="Indexed Documents"
        value={fmtNumber(overview.indexedDocuments)}
        icon="file"
        sub={<MiniBar value={indexedRatio} tone={indexedRatio >= 85 ? "success" : "warning"} />}
        footer={`${fmtNumber(overview.indexedDocuments)} of ${fmtNumber(overview.totalDocuments)} documents`}
      />

      <CountStat
        label="Failed Documents"
        value={fmtNumber(overview.failedDocuments)}
        icon="alertCircle"
        footer={
          overview.failedDocuments > 0 ? (
            <span className="font-medium text-danger-fg">Needs retry</span>
          ) : (
            <span className="text-success-fg">All clear</span>
          )
        }
      />

      <CountStat
        label="Active Workspaces"
        value={fmtNumber(overview.workspaceCount)}
        icon="layers"
        sub={
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <HealthDot tone="success" label={`${overview.statusCounts.healthy} healthy`} />
            <HealthDot tone="warning" label={`${overview.statusCounts.warning} warning`} />
            <HealthDot tone="critical" label={`${overview.statusCounts.critical} critical`} />
          </div>
        }
      />

      <CountStat
        label="Total Queries"
        value={fmtNumber(overview.totalQueries)}
        icon="message"
        footer={
          overview.avgLatencyMs != null
            ? `${fmtNumber(overview.avgLatencyMs)} ms avg latency`
            : "RAG queries served"
        }
      />
    </div>
  );
}
