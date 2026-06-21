import { Icon } from "@/components/ui/Icon";
import type { DerivedInsights, Insight, OverviewMetrics } from "@/features/ragops/types";
import { fmtNumber, fmtPercent, InsightRow } from "@/features/ragops/components/primitives";

function buildHeadline(overview: OverviewMetrics): string {
  const status =
    overview.statusCounts.critical > 0
      ? "needs attention"
      : overview.statusCounts.warning > 0
        ? "stable with warnings"
        : "healthy";
  const failed =
    overview.failedDocuments > 0 ? `, ${fmtNumber(overview.failedDocuments)} failed documents` : "";
  return `Platform is ${status} — health ${overview.ragHealthScore}/100, ${fmtPercent(
    overview.embeddingCoverage,
  )} embedding coverage${failed}.`;
}

function Column({
  label,
  items,
  emptyTone,
  emptyText,
}: {
  label: string;
  items: Insight[];
  emptyTone: string;
  emptyText: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      {items.length === 0 ? (
        <p className={`px-2 py-1.5 text-sm ${emptyTone}`}>{emptyText}</p>
      ) : (
        <div className="grid gap-0.5">
          {items.map((item) => (
            <InsightRow key={item.id} tone={item.tone} title={item.title} detail={item.detail} href={item.href} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AiInsight({
  insights,
  overview,
}: {
  insights: DerivedInsights;
  overview: OverviewMetrics;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line bg-gradient-to-br from-brand-subtle to-transparent p-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-subtle-line bg-brand-subtle px-2 py-1 text-xs font-semibold text-brand-fg">
            <Icon name="sparkles" size={13} />
            AI · Executive Insight
          </span>
        </div>
        <p className="mt-3 text-lg font-semibold tracking-tight text-fg">{buildHeadline(overview)}</p>
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-3">
        <Column label="Key Findings" items={insights.findings} emptyTone="text-fg-subtle" emptyText="No findings." />
        <Column
          label="Risks"
          items={insights.risks}
          emptyTone="text-success-fg"
          emptyText="No active risks."
        />
        <Column
          label="Recommendations"
          items={insights.recommendations}
          emptyTone="text-fg-subtle"
          emptyText="Nothing to action."
        />
      </div>
    </div>
  );
}
