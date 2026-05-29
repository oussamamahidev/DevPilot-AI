"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  formatDate,
  formatDecimal,
  formatNumber,
} from "@/components/admin/AdminUI";
import {
  BarChartCard,
  chartPalette,
  DonutChartCard,
  EmptyState,
  ErrorCard,
  EvaluationRadarChart,
  LoadingSkeleton,
  PageHeader,
  RefreshButton,
  RiskBadge,
  safePreview,
  StatCard,
  StatusBadge,
} from "@/components/admin/AnalyticsUI";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getRagTraceQualitySummary, listRagTraces } from "@/lib/admin";
import type {
  RagTraceListItem,
  RagTraceQualitySummary,
  RagTraceWorstMessage,
} from "@/types";

export default function AdminQualityPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [summary, setSummary] = useState<RagTraceQualitySummary | null>(null);
  const [traces, setTraces] = useState<RagTraceListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const [summaryData, traceData] = await Promise.all([
        getRagTraceQualitySummary(),
        listRagTraces({ page: 1, page_size: 200 }),
      ]);
      setSummary(summaryData);
      setTraces(traceData.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load quality data.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const distributions = useMemo(() => buildDistributions(traces), [traces]);

  if (isLoading) {
    return <AdminAccessMessage title="Quality Dashboard" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Quality Dashboard" label="Admin access required." />;
  }

  return (
    <AdminShell
      title="DevPilot AI Control Center"
      description="RAG answer quality, risk distribution, correction behavior, and agent latency."
    >
      <PageHeader
        title="Quality Dashboard"
        subtitle="RAG answer quality, hallucination risk, CorrectorAgent impact, refusal rate, and slow agent visibility."
        actions={<RefreshButton isFetching={isFetching} onClick={() => void load()} />}
      />
      <ErrorCard message={error} onRetry={() => void load()} />

      {isFetching && !summary ? <LoadingSkeleton rows={4} /> : null}

      {summary ? (
        <div className="grid gap-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total RAG Queries"
              value={formatNumber(summary.total_rag_queries)}
              description="Evaluated assistant answers"
              badge="Quality"
              tone="info"
            />
            <StatCard
              label="Average Faithfulness"
              value={formatDecimal(summary.average_faithfulness, 2)}
              description="Grounding in retrieved context"
              progress={summary.average_faithfulness * 100}
              badge="Faithfulness"
              tone={summary.average_faithfulness >= 0.75 ? "success" : "warning"}
            />
            <StatCard
              label="Average Relevance"
              value={formatDecimal(summary.average_relevance, 2)}
              description="Answer fit to user intent"
              progress={summary.average_relevance * 100}
              badge="Relevance"
              tone={summary.average_relevance >= 0.75 ? "success" : "warning"}
            />
            <StatCard
              label="Context Precision"
              value={formatDecimal(summary.average_context_precision, 2)}
              description="Retrieved context usefulness"
              progress={summary.average_context_precision * 100}
              badge="Retrieval"
              tone={summary.average_context_precision >= 0.75 ? "success" : "warning"}
            />
            <StatCard
              label="Hallucination Score"
              value={formatDecimal(summary.average_hallucination_score, 2)}
              description="Lower is safer"
              progress={summary.average_hallucination_score * 100}
              badge="Risk"
              tone={
                summary.average_hallucination_score <= 0.3
                  ? "success"
                  : summary.average_hallucination_score <= 0.6
                    ? "warning"
                    : "critical"
              }
            />
            <StatCard
              label="Corrected Answers"
              value={formatNumber(summary.corrected_answers_count)}
              description="CorrectorAgent changed final output"
              badge="Corrector"
              tone="ai"
            />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Low Quality Answers"
              value={formatNumber(summary.low_quality_count)}
              description="Answers below the quality threshold"
              badge="Review"
              tone={summary.low_quality_count > 0 ? "warning" : "success"}
            />
            <StatCard
              label="High Hallucination Risk"
              value={formatNumber(summary.hallucination_risk_count)}
              description="Answers with elevated unsupported-content risk"
              badge="Risk"
              tone={summary.hallucination_risk_count > 0 ? "critical" : "success"}
            />
            <StatCard
              label="No Context Answers"
              value={formatNumber(summary.no_context_count)}
              description="Answers where retrieval did not provide usable context"
              badge="Retrieval"
              tone={summary.no_context_count > 0 ? "warning" : "success"}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <EvaluationRadarChart
              faithfulness={summary.average_faithfulness}
              relevance={summary.average_relevance}
              contextPrecision={summary.average_context_precision}
              hallucinationScore={summary.average_hallucination_score}
              retrievalCoverage={summary.average_context_precision}
              title="Quality Radar"
            />
            <div className="xl:col-span-2">
              <BarChartCard
                title="Agent Latency Chart"
                data={Object.entries(summary.average_latency_by_agent).map(([agent, latency]) => ({
                  agent,
                  latency,
                }))}
                xKey="agent"
                bars={[{ key: "latency", name: "Latency ms", color: chartPalette.blue }]}
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <BarChartCard
              title="Faithfulness Distribution"
              data={distributions.faithfulness}
              xKey="range"
              bars={[{ key: "count", name: "Answers", color: chartPalette.emerald }]}
            />
            <BarChartCard
              title="Hallucination Distribution"
              data={distributions.hallucination}
              xKey="range"
              bars={[{ key: "count", name: "Answers", color: chartPalette.red }]}
            />
            <DonutChartCard
              title="Answered, Refused, Corrected"
              centerLabel="Answers"
              data={[
                {
                  color: chartPalette.emerald,
                  name: "answered",
                  value: Math.max(
                    0,
                    summary.total_rag_queries -
                      summary.no_context_count -
                      summary.corrected_answers_count,
                  ),
                },
                {
                  color: chartPalette.amber,
                  name: "refused/no context",
                  value: summary.no_context_count,
                },
                {
                  color: chartPalette.ai,
                  name: "corrected",
                  value: summary.corrected_answers_count,
                },
              ]}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <WorstTable
              title="Worst Answers By Hallucination"
              rows={summary.worst_messages_by_hallucination}
              metric="hallucination"
            />
            <WorstTable
              title="Worst Answers By Low Relevance"
              rows={summary.worst_messages_by_relevance}
              metric="relevance"
            />
          </div>
        </div>
      ) : !isFetching && !error ? (
        <EmptyState label="No traces available yet. Ask a question to generate traces." />
      ) : null}
    </AdminShell>
  );
}

function WorstTable({
  metric,
  rows,
  title,
}: {
  metric: "hallucination" | "relevance";
  rows: RagTraceWorstMessage[];
  title: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      {rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState label="No messages found." />
        </div>
      ) : (
        <div className="admin-table-scroll mt-5">
          <table className="admin-table">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Question</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Workspace</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Metric</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Created</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.message_id}>
                  <td className="max-w-md px-3 py-3">
                    <p className="font-medium text-slate-950">
                      {safePreview(row.question_preview, 90)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {safePreview(row.answer_preview, 120)}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {row.workspace_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {metric === "hallucination" ? (
                      <RiskBadge value={row.hallucination_score} />
                    ) : (
                      <StatusBadge
                        label={formatDecimal(row.relevance, 2)}
                        tone={row.relevance >= 0.75 ? "success" : row.relevance >= 0.5 ? "warning" : "critical"}
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link
                      href={`/admin/rag-traces/${row.message_id}`}
                      className="font-medium text-slate-950 underline-offset-4 hover:underline"
                    >
                      View trace
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function buildDistributions(traces: RagTraceListItem[]) {
  const ranges = [
    { label: "0.00-0.25", max: 0.25, min: 0 },
    { label: "0.25-0.50", max: 0.5, min: 0.25 },
    { label: "0.50-0.75", max: 0.75, min: 0.5 },
    { label: "0.75-1.00", max: 1.01, min: 0.75 },
  ];
  return {
    faithfulness: ranges.map((range) => ({
      count: traces.filter(
        (trace) => trace.faithfulness >= range.min && trace.faithfulness < range.max,
      ).length,
      range: range.label,
    })),
    hallucination: ranges.map((range) => ({
      count: traces.filter(
        (trace) =>
          trace.hallucination_score >= range.min && trace.hallucination_score < range.max,
      ).length,
      range: range.label,
    })),
  };
}
