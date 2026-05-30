import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { RagTraceQualitySummary } from "@/types";
import type { OverviewMetrics } from "@/features/ragops/types";
import {
  AwaitingTelemetry,
  GaugeStat,
  qualityTone,
  riskTone,
} from "@/features/ragops/components/primitives";

function MetricGauge({ label, value, invert = false }: { label: string; value: number | null; invert?: boolean }) {
  if (value == null) {
    return <GaugeStat label={label} percent={0} centerText="—" tone="neutral" footer="No evaluations" />;
  }
  return (
    <GaugeStat
      label={label}
      percent={value * 100}
      centerText={value.toFixed(2)}
      tone={invert ? riskTone(value) : qualityTone(value)}
    />
  );
}

export function EvaluationIntelligence({
  overview,
  quality,
}: {
  overview: OverviewMetrics;
  quality: RagTraceQualitySummary | undefined;
}) {
  const worst = quality?.worst_messages_by_hallucination ?? [];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricGauge label="Faithfulness" value={overview.faithfulness} />
        <MetricGauge label="Relevance" value={overview.relevance} />
        <MetricGauge label="Context Precision" value={overview.contextPrecision} />
        <MetricGauge label="Hallucination" value={overview.hallucination} invert />
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-fg">Worst answers by hallucination</p>
        {worst.length === 0 ? (
          <p className="text-sm text-fg-subtle">No flagged answers.</p>
        ) : (
          <div className="grid gap-2">
            {worst.slice(0, 5).map((message) => (
              <Link
                key={message.message_id}
                href={`/admin/rag-traces/${message.message_id}`}
                className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Badge tone={riskTone(message.hallucination_score)}>
                  {message.hallucination_score.toFixed(2)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {message.question_preview || "Untitled query"}
                  </p>
                  <p className="truncate text-xs text-fg-subtle">
                    {message.workspace_name} · faithfulness {message.faithfulness.toFixed(2)} · relevance{" "}
                    {message.relevance.toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AwaitingTelemetry
        label="Faithfulness / relevance / context-precision / hallucination trends (time-series)"
        endpoint="GET /admin/ragops/evaluation/timeseries"
      />
    </div>
  );
}
