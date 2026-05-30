import { Icon, type IconName } from "@/components/ui/Icon";
import type { RagOpsQdrantHealth } from "@/types";
import type { OverviewMetrics } from "@/features/ragops/types";
import { fmtNumber, fmtPercent, type Tone } from "@/features/ragops/components/primitives";

type Step = { name: string; icon: IconName; value: string; sub: string; tone: Tone };

const ringText: Record<Tone, string> = {
  ai: "text-brand-fg",
  critical: "text-danger-fg",
  info: "text-info-fg",
  neutral: "text-fg-subtle",
  success: "text-success-fg",
  warning: "text-warning-fg",
};

function StepNode({ step, last }: { step: Step; last: boolean }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-md bg-sunken ${ringText[step.tone]}`}>
          <Icon name={step.icon} size={16} />
        </span>
        <Icon
          name={last ? "check" : "chevronRight"}
          size={16}
          className={last ? "text-success-fg" : "text-fg-subtle"}
        />
      </div>
      <p className="mt-2 truncate text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
        {step.name}
      </p>
      <p className="truncate text-lg font-semibold tabular-nums text-fg">{step.value}</p>
      <p className="truncate text-xs text-fg-muted">{step.sub}</p>
    </div>
  );
}

export function PipelineObservatory({
  overview,
  qdrant,
}: {
  overview: OverviewMetrics;
  qdrant: RagOpsQdrantHealth | undefined;
}) {
  const inFlight = overview.queuedDocuments + overview.processingDocuments;
  const qdrantVectors = qdrant?.qdrant_vectors_count ?? overview.chunksWithVectors;

  const steps: Step[] = [
    { name: "Upload", icon: "file", value: fmtNumber(overview.totalDocuments), sub: "documents", tone: "info" },
    { name: "Extraction", icon: "activity", value: fmtNumber(inFlight), sub: "in-flight", tone: inFlight > 0 ? "warning" : "success" },
    { name: "Chunking", icon: "layers", value: fmtNumber(overview.totalChunks), sub: "chunks", tone: "info" },
    {
      name: "Embedding",
      icon: "sparkles",
      value: fmtPercent(overview.embeddingCoverage),
      sub: `${fmtNumber(overview.chunksWithVectors)} vectors`,
      tone: overview.embeddingCoverage >= 0.85 ? "success" : "warning",
    },
    {
      name: "Qdrant Indexing",
      icon: "box",
      value: fmtNumber(qdrantVectors),
      sub: "synced",
      tone: qdrant && !qdrant.reachable ? "critical" : "info",
    },
    { name: "Ready", icon: "check", value: fmtNumber(overview.indexedDocuments), sub: "indexed", tone: overview.indexedDocuments > 0 ? "success" : "warning" },
  ];

  const segments = [
    { label: "Indexed", value: overview.indexedDocuments, cls: "bg-success" },
    { label: "Processing", value: overview.processingDocuments, cls: "bg-info" },
    { label: "Queued", value: overview.queuedDocuments, cls: "bg-warning" },
    { label: "Failed", value: overview.failedDocuments, cls: "bg-danger" },
    { label: "Deleted", value: overview.deletedDocuments, cls: "bg-line-strong" },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((step, index) => (
          <StepNode key={step.name} step={step} last={index === steps.length - 1} />
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-fg">Document flow distribution</p>
          {overview.failedDocuments > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-fg">
              <Icon name="alertCircle" size={13} />
              {fmtNumber(overview.failedDocuments)} failed
            </span>
          ) : null}
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-sunken">
          {segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <div
                key={segment.label}
                className={segment.cls}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((segment) => (
            <span key={segment.label} className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <span className={`h-2 w-2 rounded-full ${segment.cls}`} />
              {segment.label} {fmtNumber(segment.value)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
