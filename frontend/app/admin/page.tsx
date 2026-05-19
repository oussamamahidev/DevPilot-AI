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
  formatLatency,
  formatPercent,
  getHallucinationRisk,
  HealthScoreGauge,
  LoadingSkeleton,
  PageHeader,
  ProgressBar,
  QualityBadge,
  RefreshButton,
  RiskBadge,
  safePreview,
  StatCard,
  StatusBadge,
} from "@/components/admin/AnalyticsUI";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  getAdminDocumentsStats,
  getAdminStats,
  getRagTraceQualitySummary,
  listAdminErrors,
  listRagOpsWorkspaces,
} from "@/lib/admin";
import type {
  AdminDocumentSummary,
  AdminErrorSummary,
  AdminStats,
  RagOpsWorkspaceSummary,
  RagTraceQualitySummary,
} from "@/types";

export default function AdminPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [documents, setDocuments] = useState<AdminDocumentSummary[]>([]);
  const [errors, setErrors] = useState<AdminErrorSummary[]>([]);
  const [ragOpsWorkspaces, setRagOpsWorkspaces] = useState<RagOpsWorkspaceSummary[]>([]);
  const [qualitySummary, setQualitySummary] = useState<RagTraceQualitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setIsFetching(true);
    setError(null);
    try {
      const [statsData, documentsData, errorsData, ragOpsData, qualityData] =
        await Promise.all([
          getAdminStats(),
          getAdminDocumentsStats(),
          listAdminErrors(),
          listRagOpsWorkspaces(),
          getRagTraceQualitySummary(),
        ]);
      setStats(statsData);
      setDocuments(documentsData.recent_documents);
      setErrors(errorsData.errors);
      setRagOpsWorkspaces(ragOpsData);
      setQualitySummary(qualityData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load admin data.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const aggregate = useMemo(() => aggregateRagOps(ragOpsWorkspaces), [ragOpsWorkspaces]);
  const overview = useMemo(() => buildOverview(stats, qualitySummary, aggregate, errors), [
    aggregate,
    errors,
    qualitySummary,
    stats,
  ]);
  const failedDocuments = documents.filter((document) => document.status === "failed").slice(0, 6);
  const riskyAnswers = qualitySummary?.worst_messages_by_hallucination.slice(0, 6) ?? [];

  if (isLoading) {
    return <AdminAccessMessage title="DevPilot AI Control Center" label="Checking admin access." />;
  }

  if (!isAdmin) {
    return <AdminAccessMessage title="DevPilot AI Control Center" label="Admin access required." />;
  }

  return (
    <AdminShell
      title="DevPilot AI Control Center"
      description="Executive AI operations, RAG health, quality risk, indexing state, and agent performance."
    >
      <PageHeader
        title="Operations Overview"
        subtitle="A visual command center for platform health, document readiness, retrieval quality, hallucination risk, and agent latency."
        actions={<RefreshButton isFetching={isFetching} onClick={() => void load()} />}
      />
      <ErrorCard message={error} onRetry={() => void load()} />

      {isFetching && !stats ? <LoadingSkeleton rows={4} /> : null}

      {stats && overview ? (
        <div className="grid gap-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard
              label="Total Users"
              value={formatNumber(stats.total_users)}
              description={`${formatNumber(stats.active_users)} active accounts`}
              badge="Live"
              tone="info"
            />
            <StatCard
              label="Active Workspaces"
              value={formatNumber(stats.total_workspaces)}
              description={`${formatNumber(ragOpsWorkspaces.length)} with RAGOps telemetry`}
              badge="Tracked"
              tone="ai"
            />
            <StatCard
              label="Indexed Documents"
              value={formatNumber(overview.indexedDocuments)}
              description={`${formatPercent(overview.indexedRatio)} of uploaded documents`}
              badge={overview.indexedRatio >= 0.85 ? "Healthy" : "Review"}
              progress={overview.indexedRatio * 100}
              tone={overview.indexedRatio >= 0.85 ? "success" : "warning"}
            />
            <StatCard
              label="RAG Queries"
              value={formatNumber(stats.total_rag_queries)}
              description={`Average latency ${formatLatency(stats.average_latency_ms)}`}
              badge="Observed"
              tone="info"
            />
            <StatCard
              label="Average Faithfulness"
              value={formatDecimal(overview.faithfulness, 2)}
              description="How grounded the answers are in retrieved context"
              badge={overview.faithfulness >= 0.75 ? "Strong" : "Watch"}
              progress={overview.faithfulness * 100}
              tone={overview.faithfulness >= 0.75 ? "success" : "warning"}
            />
            <StatCard
              label="Hallucination Risk"
              value={formatDecimal(overview.hallucinationScore, 2)}
              description={getHallucinationRisk(overview.hallucinationScore).label}
              badge={getHallucinationRisk(overview.hallucinationScore).label}
              progress={overview.hallucinationScore * 100}
              tone={getHallucinationRisk(overview.hallucinationScore).tone}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr_1fr]">
            <HealthScoreGauge
              score={overview.healthScore}
              description={`Computed from indexed document ratio (${formatPercent(
                overview.indexedRatio,
              )}), embedding coverage (${formatPercent(
                overview.embeddingCoverage,
              )}), faithfulness (${formatDecimal(
                overview.faithfulness,
                2,
              )}), low hallucination risk, and recent agent reliability.`}
            />
            <DonutChartCard
              title="Document Status"
              centerLabel="Documents"
              data={documentStatusData(stats.documents_by_status)}
            />
            <EvaluationRadarChart
              title="RAG Quality Radar"
              faithfulness={overview.faithfulness}
              relevance={overview.relevance}
              contextPrecision={overview.contextPrecision}
              hallucinationScore={overview.hallucinationScore}
              retrievalCoverage={overview.indexedRatio}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <BarChartCard
              title="Agent Latency By Step"
              data={agentLatencyData(qualitySummary)}
              xKey="agent"
              bars={[{ key: "latency", name: "Latency ms", color: chartPalette.blue }]}
            />
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-950">Embedding Coverage</h3>
              <div className="mt-5 grid gap-5">
                <ProgressBar
                  label={`${formatNumber(aggregate.chunksWithVectors)} of ${formatNumber(
                    aggregate.totalChunks,
                  )} chunks embedded`}
                  value={aggregate.embeddingCoverage * 100}
                  tone={aggregate.embeddingCoverage >= 0.85 ? "success" : "warning"}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniMetric label="Total chunks" value={formatNumber(aggregate.totalChunks)} />
                  <MiniMetric
                    label="Missing vectors"
                    value={formatNumber(aggregate.totalChunks - aggregate.chunksWithVectors)}
                  />
                  <MiniMetric
                    label="Failed docs"
                    value={formatNumber(aggregate.failedDocuments)}
                    tone={aggregate.failedDocuments > 0 ? "critical" : "success"}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-950">Recent Risky Answers</h3>
                <Link href="/admin/rag-traces" className="text-sm font-medium text-slate-700">
                  Explore traces
                </Link>
              </div>
              {riskyAnswers.length === 0 ? (
                <div className="mt-5">
                  <EmptyState label="No high-risk answers found." />
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Question</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Risk</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Relevance</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Workspace</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {riskyAnswers.map((answer) => (
                        <tr key={answer.message_id}>
                          <td className="max-w-sm px-3 py-3 font-medium text-slate-950">
                            {safePreview(answer.question_preview, 90)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <RiskBadge value={answer.hallucination_score} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <QualityBadge label="R" value={answer.relevance} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {answer.workspace_name}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <Link
                              href={`/admin/rag-traces/${answer.message_id}`}
                              className="font-medium text-slate-950 underline-offset-4 hover:underline"
                            >
                              View Trace
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-950">Recent Failed Documents</h3>
                <StatusBadge
                  label={`${formatNumber(failedDocuments.length)} failed`}
                  tone={failedDocuments.length > 0 ? "critical" : "success"}
                />
              </div>
              {failedDocuments.length === 0 ? (
                <div className="mt-5">
                  <EmptyState label="No failed documents in the recent admin sample." />
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {failedDocuments.map((document) => (
                    <article
                      key={document.id}
                      className="rounded-lg border border-red-200 bg-red-50 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-red-950">{document.filename}</p>
                          <p className="mt-1 text-sm text-red-700">
                            {document.workspace_name} - uploaded {formatDate(document.created_at)}
                          </p>
                        </div>
                        <Link
                          href={`/admin/ragops/documents/${document.id}`}
                          className="text-sm font-medium text-red-900 underline-offset-4 hover:underline"
                        >
                          Open pipeline
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

function aggregateRagOps(workspaces: RagOpsWorkspaceSummary[]) {
  const totalChunks = workspaces.reduce((total, item) => total + item.total_chunks, 0);
  const chunksWithVectors = workspaces.reduce(
    (total, item) => total + item.chunks_with_vector_id,
    0,
  );
  const failedDocuments = workspaces.reduce(
    (total, item) => total + item.documents_failed,
    0,
  );
  return {
    chunksWithVectors,
    embeddingCoverage: totalChunks > 0 ? chunksWithVectors / totalChunks : 1,
    failedDocuments,
    totalChunks,
  };
}

function buildOverview(
  stats: AdminStats | null,
  quality: RagTraceQualitySummary | null,
  aggregate: ReturnType<typeof aggregateRagOps>,
  errors: AdminErrorSummary[],
) {
  if (!stats) {
    return null;
  }
  const indexedDocuments = stats.documents_by_status.indexed ?? 0;
  const indexedRatio = stats.total_documents > 0 ? indexedDocuments / stats.total_documents : 1;
  const faithfulness = quality?.average_faithfulness ?? stats.average_faithfulness ?? 0;
  const relevance = quality?.average_relevance ?? stats.average_relevance ?? 0;
  const contextPrecision = quality?.average_context_precision ?? relevance;
  const hallucinationScore = quality?.average_hallucination_score ?? 0;
  const agentSuccess = Math.max(0, 1 - errors.length / 10);
  const healthScore = Math.round(
    100 *
      (indexedRatio * 0.3 +
        aggregate.embeddingCoverage * 0.25 +
        faithfulness * 0.2 +
        (1 - hallucinationScore) * 0.15 +
        agentSuccess * 0.1),
  );
  return {
    agentSuccess,
    contextPrecision,
    embeddingCoverage: aggregate.embeddingCoverage,
    faithfulness,
    hallucinationScore,
    healthScore,
    indexedDocuments,
    indexedRatio,
    relevance,
  };
}

function documentStatusData(statuses: Record<string, number>) {
  const ordered = ["indexed", "queued", "processing", "failed", "deleted", "uploaded"];
  const known = new Set(ordered);
  const rows = ordered
    .map((status) => ({ name: status, value: statuses[status] ?? 0 }))
    .filter((item) => item.value > 0);
  const extras = Object.entries(statuses)
    .filter(([status]) => !known.has(status))
    .map(([name, value]) => ({ name, value }));
  return [...rows, ...extras];
}

function agentLatencyData(summary: RagTraceQualitySummary | null) {
  const fallbackAgents = [
    "router",
    "query_rewriter",
    "retrieval",
    "reranker",
    "generator",
    "evaluator",
    "corrector",
  ];
  const rows = summary?.average_latency_by_agent ?? {};
  if (Object.keys(rows).length === 0) {
    return fallbackAgents.map((agent) => ({ agent, latency: 0 }));
  }
  return fallbackAgents.map((agent) => ({ agent, latency: rows[agent] ?? 0 }));
}

function MiniMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "success" | "warning" | "critical" | "info" | "ai" | "neutral";
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-950">{value}</p>
        <span
          className={
            tone === "success"
              ? "h-2.5 w-2.5 rounded-full bg-emerald-600"
              : tone === "warning"
                ? "h-2.5 w-2.5 rounded-full bg-amber-500"
                : tone === "critical"
                  ? "h-2.5 w-2.5 rounded-full bg-red-600"
                  : tone === "ai"
                    ? "h-2.5 w-2.5 rounded-full bg-violet-600"
                    : tone === "info"
                      ? "h-2.5 w-2.5 rounded-full bg-blue-600"
                      : "h-2.5 w-2.5 rounded-full bg-slate-400"
          }
        />
      </div>
    </div>
  );
}
