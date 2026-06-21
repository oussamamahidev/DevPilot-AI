"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAccessMessage, AdminShell, ErrorBanner, formatDate, formatNumber } from "@/components/admin/AdminUI";
import { MetricStrip, type Metric, type Tone } from "@/components/admin/DataView";
import {
  ScoreMeter,
  HBarChart,
  Histogram,
  StackedBar,
  agentLatencyRows,
  scoreBuckets,
  barBg,
} from "@/components/admin/AdminCharts";
import { Badge, DataCard, EmptyState, LoadingState } from "@/components/ui";
import type { StatusTone } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getRagTraceQualitySummary, listRagTraces } from "@/lib/admin";
import type { RagTraceListItem, RagTraceQualitySummary, RagTraceWorstMessage } from "@/types";

function kpiTone(value: number, invert = false): Tone {
  if (invert) return value <= 0.3 ? "success" : value <= 0.6 ? "warning" : "danger";
  return value >= 0.75 ? "success" : value >= 0.5 ? "warning" : "danger";
}

export default function AdminQualityPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [summary, setSummary] = useState<RagTraceQualitySummary | null>(null);
  const [traces, setTraces] = useState<RagTraceListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const [summaryData, traceData] = await Promise.all([
        getRagTraceQualitySummary(),
        listRagTraces({ page: 1, page_size: 200 }),
      ]);
      setSummary(summaryData);
      setTraces(traceData.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load quality data.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const faithfulnessBuckets = useMemo(() => scoreBuckets(traces.map((t) => t.faithfulness)), [traces]);
  const hallucinationBuckets = useMemo(() => scoreBuckets(traces.map((t) => t.hallucination_score), true), [traces]);

  if (isLoading) return <AdminAccessMessage title="Quality Dashboard" label="Checking admin access." />;
  if (!isAdmin) return <AdminAccessMessage title="Quality Dashboard" label="Admin access required." />;

  const kpis: Metric[] = summary
    ? [
        { label: "RAG queries", value: formatNumber(summary.total_rag_queries), icon: "message", tone: "info" },
        { label: "Faithfulness", value: `${Math.round(summary.average_faithfulness * 100)}%`, icon: "shield", tone: kpiTone(summary.average_faithfulness) },
        { label: "Relevance", value: `${Math.round(summary.average_relevance * 100)}%`, icon: "checkCircle", tone: kpiTone(summary.average_relevance) },
        { label: "Context precision", value: `${Math.round(summary.average_context_precision * 100)}%`, icon: "layers", tone: kpiTone(summary.average_context_precision) },
        { label: "Hallucination", value: `${Math.round(summary.average_hallucination_score * 100)}%`, icon: "alertCircle", tone: kpiTone(summary.average_hallucination_score, true) },
        { label: "Corrected", value: formatNumber(summary.corrected_answers_count), icon: "refreshCw", tone: "brand" },
      ]
    : [];

  const answered = summary
    ? Math.max(0, summary.total_rag_queries - summary.no_context_count - summary.corrected_answers_count)
    : 0;

  return (
    <AdminShell
      title="Quality Dashboard"
      description="RAG answer quality, hallucination risk, corrector impact, retrieval coverage and agent latency."
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">How grounded, relevant and safe the generated answers are.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Icon name="refreshCw" size={15} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {isFetching && !summary ? (
        <LoadingState variant="skeleton" rows={4} skeletonVariant="card" />
      ) : summary ? (
        <div className="grid gap-5">
          <MetricStrip metrics={kpis} />

          {/* Scorecard + outcomes + risk counters */}
          <div className="grid min-w-0 gap-5 xl:grid-cols-3">
            <DataCard title="Quality scorecard" icon={<Icon name="shield" size={15} />} tone="ai">
              <div className="grid gap-3">
                <ScoreMeter label="Faithfulness" value={summary.average_faithfulness} hint="Grounding in retrieved context" />
                <ScoreMeter label="Relevance" value={summary.average_relevance} hint="Answer fit to user intent" />
                <ScoreMeter label="Context precision" value={summary.average_context_precision} hint="Usefulness of retrieved context" />
                <ScoreMeter label="Hallucination risk" value={summary.average_hallucination_score} invert hint="Lower is safer" />
              </div>
            </DataCard>

            <DataCard title="Answer outcomes" icon={<Icon name="workflow" size={15} />}>
              <StackedBar
                segments={[
                  { label: "answered", value: answered, tone: "success" },
                  { label: "no context", value: summary.no_context_count, tone: "warning" },
                  { label: "corrected", value: summary.corrected_answers_count, tone: "ai" },
                ]}
              />
              <p className="mt-4 text-xs text-fg-subtle">
                Of {formatNumber(summary.total_rag_queries)} evaluated answers, the CorrectorAgent repaired{" "}
                {formatNumber(summary.corrected_answers_count)}.
              </p>
            </DataCard>

            <DataCard title="Risk counters" icon={<Icon name="alertCircle" size={15} />}>
              <div className="grid gap-3">
                <RiskCounter label="Low-quality answers" value={summary.low_quality_count} tone={summary.low_quality_count > 0 ? "warning" : "success"} />
                <RiskCounter label="High hallucination risk" value={summary.hallucination_risk_count} tone={summary.hallucination_risk_count > 0 ? "critical" : "success"} />
                <RiskCounter label="No-context answers" value={summary.no_context_count} tone={summary.no_context_count > 0 ? "warning" : "success"} />
              </div>
            </DataCard>
          </div>

          {/* Distributions + latency */}
          <div className="grid min-w-0 gap-5 xl:grid-cols-3">
            <DataCard title="Faithfulness distribution" subtitle={`${traces.length} recent traces`} icon={<Icon name="shield" size={15} />}>
              {traces.length === 0 ? <EmptyState title="No data" description="Distributions appear once traces exist." /> : <Histogram buckets={faithfulnessBuckets} />}
            </DataCard>
            <DataCard title="Hallucination distribution" subtitle={`${traces.length} recent traces`} icon={<Icon name="alertCircle" size={15} />}>
              {traces.length === 0 ? <EmptyState title="No data" description="Distributions appear once traces exist." /> : <Histogram buckets={hallucinationBuckets} />}
            </DataCard>
            <DataCard title="Agent latency" subtitle="Average per stage" icon={<Icon name="workflow" size={15} />}>
              {Object.keys(summary.average_latency_by_agent).length === 0 ? (
                <EmptyState title="No telemetry" description="Latency appears once RAG queries run." />
              ) : (
                <HBarChart rows={agentLatencyRows(summary.average_latency_by_agent)} />
              )}
            </DataCard>
          </div>

          {/* Worst answers */}
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <WorstList title="Worst by hallucination" icon="alertCircle" rows={summary.worst_messages_by_hallucination} metric="hallucination" />
            <WorstList title="Worst by relevance" icon="trendingUp" rows={summary.worst_messages_by_relevance} metric="relevance" />
          </div>
        </div>
      ) : !isFetching && !error ? (
        <EmptyState title="No traces yet" description="Ask a question in a workspace to generate evaluated answers." />
      ) : null}
    </AdminShell>
  );
}

/* ─── presentational bits ────────────────────────────────────── */
function RiskCounter({ label, value, tone }: { label: string; value: number; tone: StatusTone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-sunken px-3 py-2.5">
      <span className="min-w-0 truncate text-sm text-fg-muted">{label}</span>
      <span className="inline-flex items-center gap-2 shrink-0">
        <span className={`h-2 w-2 rounded-full ${barBg[tone]}`} />
        <span className="text-lg font-semibold tabular-nums text-fg">{formatNumber(value)}</span>
      </span>
    </div>
  );
}

function WorstList({
  title,
  icon,
  rows,
  metric,
}: {
  title: string;
  icon: "alertCircle" | "trendingUp";
  rows: RagTraceWorstMessage[];
  metric: "hallucination" | "relevance";
}) {
  return (
    <DataCard title={title} icon={<Icon name={icon} size={15} />} tone={metric === "hallucination" ? "critical" : "warning"} padded={false}>
      {rows.length === 0 ? (
        <div className="p-4"><EmptyState title="Nothing flagged" description="No problematic answers found." /></div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const value = metric === "hallucination" ? row.hallucination_score : row.relevance;
            const tone: StatusTone = metric === "hallucination"
              ? value > 0.6 ? "critical" : value > 0.3 ? "warning" : "success"
              : value >= 0.75 ? "success" : value >= 0.5 ? "warning" : "critical";
            return (
              <li key={row.message_id} className="min-w-0">
                <Link href={`/admin/rag-traces/${row.message_id}`} className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-fg">{row.question_preview || "—"}</p>
                    <p className="truncate text-[11px] text-fg-subtle">{row.workspace_name} · {formatDate(row.created_at)}</p>
                  </div>
                  <Badge tone={tone} size="sm">{Math.round(value * 100)}%</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DataCard>
  );
}
