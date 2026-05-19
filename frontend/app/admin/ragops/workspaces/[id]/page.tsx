"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  computeWorkspaceHealthScore,
  EmptyState,
  ErrorCard,
  EvaluationRadarChart,
  formatLatency,
  HealthScoreGauge,
  LineChartCard,
  LoadingSkeleton,
  PageHeader,
  ProgressBar,
  ProgressRing,
  RefreshButton,
  safePreview,
  StackedStatusBar,
  StatCard,
  StatusBadge,
} from "@/components/admin/AnalyticsUI";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getRagOpsWorkspace } from "@/lib/admin";
import type { RagOpsWorkspaceDetail } from "@/types";

export default function RagOpsWorkspacePage() {
  const params = useParams<{ id: string }>();
  const { isAdmin, isLoading } = useAdminAccess();
  const [detail, setDetail] = useState<RagOpsWorkspaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const workspaceId = params.id;

  const load = useCallback(async () => {
    if (!isAdmin || !workspaceId) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      setDetail(await getRagOpsWorkspace(workspaceId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load workspace RAGOps state.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const score = detail ? computeWorkspaceHealthScore(detail.summary) : 0;
  const qualitySeries = useMemo(() => buildQualitySeries(detail), [detail]);

  if (isLoading) {
    return <AdminAccessMessage title="Workspace RAGOps" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Workspace RAGOps" label="Admin access required." />;
  }

  return (
    <AdminShell
      title="DevPilot AI Control Center"
      description="Workspace-level RAG readiness, vector synchronization, quality, and failed ingestion state."
    >
      <PageHeader
        title={detail?.workspace.name ?? "Workspace RAGOps"}
        subtitle={
          detail
            ? `${detail.owner.email} - created ${formatDate(detail.workspace.created_at)}`
            : "Visual health of one workspace."
        }
        actions={<RefreshButton isFetching={isFetching} onClick={() => void load()} />}
      />
      <ErrorCard message={error} onRetry={() => void load()} />

      {isFetching && !detail ? <LoadingSkeleton rows={4} /> : null}

      {detail ? (
        <div className="grid gap-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Workspace Status"
              value={detail.summary.rag_health_status}
              description={detail.workspace.description ?? "No workspace description"}
              badge={detail.summary.rag_health_status}
              tone={
                detail.summary.rag_health_status === "healthy"
                  ? "success"
                  : detail.summary.rag_health_status === "warning"
                    ? "warning"
                    : "critical"
              }
            />
            <StatCard
              label="Indexed Documents"
              value={`${formatNumber(detail.summary.documents_indexed)} / ${formatNumber(
                detail.summary.documents_total,
              )}`}
              description={`${formatNumber(detail.summary.documents_failed)} failed documents`}
              progress={percentOf(detail.summary.documents_indexed, detail.summary.documents_total)}
              badge="Pipeline"
              tone={detail.summary.documents_failed > 0 ? "warning" : "success"}
            />
            <StatCard
              label="Embedding Coverage"
              value={`${formatDecimal(detail.summary.embedding_coverage_percent, 1)}%`}
              description={`${formatNumber(
                detail.summary.chunks_with_vector_id,
              )} chunks have vector ids`}
              progress={detail.summary.embedding_coverage_percent}
              badge={detail.summary.embedding_coverage_percent >= 85 ? "Ready" : "Gap"}
              tone={detail.summary.embedding_coverage_percent >= 85 ? "success" : "warning"}
            />
            <StatCard
              label="Total Chunks"
              value={formatNumber(detail.summary.total_chunks)}
              description={`${formatDecimal(
                detail.summary.average_chunk_length,
                0,
              )} chars average length`}
              badge="Chunking"
              tone="info"
            />
            <StatCard
              label="Last Indexed"
              value={formatDate(detail.summary.last_document_indexed_at)}
              description={`Last upload ${formatDate(detail.summary.last_document_uploaded_at)}`}
              badge="Freshness"
              tone="ai"
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <HealthScoreGauge
              score={score}
              description={`This workspace is ${
                score >= 85 ? "healthy" : score >= 60 ? "in warning state" : "critical"
              } because ${formatDecimal(
                detail.embedding_summary.embedding_coverage_percent,
                1,
              )}% of chunks have embeddings and average faithfulness is ${formatDecimal(
                detail.average_evaluation_scores.faithfulness,
                2,
              )}.`}
            />
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-950">Document Pipeline Status</h3>
              <div className="mt-5">
                <StackedStatusBar
                  segments={[
                    { label: "indexed", value: detail.summary.documents_indexed },
                    { label: "queued", value: detail.summary.documents_queued },
                    { label: "processing", value: detail.summary.documents_processing },
                    { label: "failed", value: detail.summary.documents_failed },
                    { label: "deleted", value: detail.summary.documents_deleted },
                  ]}
                />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <ProgressRing
                  label="Chunks created"
                  value={percentOf(
                    detail.chunking_summary.documents_with_chunks,
                    detail.chunking_summary.documents_with_chunks +
                      detail.chunking_summary.documents_without_chunks,
                  )}
                  tone="info"
                />
                <ProgressRing
                  label="Vectors present"
                  value={detail.embedding_summary.embedding_coverage_percent}
                  tone={detail.embedding_summary.embedding_coverage_percent >= 85 ? "success" : "warning"}
                />
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Qdrant Sync Panel</h3>
                <p className="mt-1 text-sm text-slate-600">
                  PostgreSQL vector references compared with Qdrant indexed vector counts.
                </p>
              </div>
              <StatusBadge
                label={
                  detail.qdrant_summary.mismatch_count === 0 &&
                  detail.qdrant_summary.qdrant_reachable
                    ? "Synchronized"
                    : "Mismatch"
                }
                tone={
                  detail.qdrant_summary.mismatch_count === 0 &&
                  detail.qdrant_summary.qdrant_reachable
                    ? "success"
                    : "critical"
                }
              />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <InfoTile
                label="Expected vectors"
                value={formatNumber(detail.qdrant_summary.expected_chunks_count)}
              />
              <InfoTile
                label="PostgreSQL vector ids"
                value={formatNumber(detail.qdrant_summary.postgres_vector_id_count)}
              />
              <InfoTile
                label="Qdrant workspace vectors"
                value={
                  detail.qdrant_summary.workspace_vector_count === null
                    ? "Unknown"
                    : formatNumber(detail.qdrant_summary.workspace_vector_count)
                }
              />
              <InfoTile
                label="Mismatch count"
                value={
                  detail.qdrant_summary.mismatch_count === null
                    ? "Unknown"
                    : formatNumber(detail.qdrant_summary.mismatch_count)
                }
                tone={
                  detail.qdrant_summary.mismatch_count === 0 ? "success" : "critical"
                }
              />
            </div>
            {detail.qdrant_summary.error ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {detail.qdrant_summary.error}
              </p>
            ) : null}
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <EvaluationRadarChart
              faithfulness={detail.average_evaluation_scores.faithfulness}
              relevance={detail.average_evaluation_scores.relevance}
              contextPrecision={detail.average_evaluation_scores.context_precision}
              hallucinationScore={detail.average_evaluation_scores.hallucination_score}
              retrievalCoverage={detail.average_evaluation_scores.context_recall}
              title="Workspace Quality Radar"
            />
            <div className="xl:col-span-2">
              <LineChartCard
                title="Faithfulness And Hallucination Over Time"
                data={qualitySeries}
                xKey="name"
                lines={[
                  { key: "faithfulness", name: "Faithfulness", color: chartPalette.emerald },
                  { key: "relevance", name: "Relevance", color: chartPalette.blue },
                  {
                    key: "hallucination",
                    name: "Hallucination",
                    color: chartPalette.red,
                  },
                ]}
              />
            </div>
          </div>

          <BarChartCard
            title="Average Agent Latency By Agent Type"
            data={detail.average_agent_latency_by_agent_type.map((agent) => ({
              agent: agent.agent_type,
              latency: agent.average_latency_ms,
            }))}
            xKey="agent"
            bars={[{ key: "latency", name: "Latency ms", color: chartPalette.blue }]}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-950">Recent RAG Queries</h3>
            {detail.recent_rag_queries.length === 0 ? (
              <div className="mt-5">
                <EmptyState label="No RAG queries found for this workspace." />
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Question</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Retrieved</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Faithfulness</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Relevance</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Latency</th>
                      <th className="whitespace-nowrap px-3 py-2 font-medium">Trace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.recent_rag_queries.map((query) => (
                      <tr key={query.message_id}>
                        <td className="max-w-lg px-3 py-3">
                          <p className="font-medium text-slate-950">
                            {safePreview(query.query_preview, 100)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(query.created_at)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                          {formatNumber(query.retrieved_chunks_count)}
                        </td>
                        <td className="min-w-36 px-3 py-3">
                          <ProgressBar
                            value={query.faithfulness * 100}
                            tone={query.faithfulness >= 0.75 ? "success" : "warning"}
                          />
                          <span className="mt-1 block text-xs text-slate-500">
                            {formatDecimal(query.faithfulness, 2)}
                          </span>
                        </td>
                        <td className="min-w-36 px-3 py-3">
                          <ProgressBar
                            value={query.relevance * 100}
                            tone={query.relevance >= 0.75 ? "success" : "warning"}
                          />
                          <span className="mt-1 block text-xs text-slate-500">
                            {formatDecimal(query.relevance, 2)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                          {formatLatency(query.latency_ms)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <Link
                            href={`/admin/rag-traces/${query.message_id}`}
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

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-950">Failed Documents</h3>
            {detail.recent_failed_documents.length === 0 ? (
              <div className="mt-5">
                <EmptyState label="No failed documents in this workspace." />
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {detail.recent_failed_documents.map((document) => (
                  <article
                    key={document.document_id}
                    className="rounded-lg border border-red-200 bg-red-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-red-950">{document.filename}</p>
                        <p className="mt-2 text-sm leading-5 text-red-700">
                          {document.error ?? document.status}
                        </p>
                      </div>
                      <Link
                        href={`/admin/ragops/documents/${document.document_id}`}
                        className="text-sm font-medium text-red-900 underline-offset-4 hover:underline"
                      >
                        Pipeline
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}

function percentOf(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 100;
}

function buildQualitySeries(detail: RagOpsWorkspaceDetail | null) {
  if (!detail) {
    return [];
  }
  const rows = [...detail.recent_rag_queries]
    .reverse()
    .map((query, index) => ({
      faithfulness: query.faithfulness,
      hallucination: detail.average_evaluation_scores.hallucination_score,
      name: `Q${index + 1}`,
      relevance: query.relevance,
    }));
  if (rows.length > 0) {
    return rows;
  }
  return [
    {
      faithfulness: detail.average_evaluation_scores.faithfulness,
      hallucination: detail.average_evaluation_scores.hallucination_score,
      name: "Average",
      relevance: detail.average_evaluation_scores.relevance,
    },
  ];
}

function InfoTile({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "success" | "warning" | "critical" | "info" | "ai" | "neutral";
  value: string;
}) {
  const dotClass =
    tone === "success"
      ? "bg-emerald-600"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "critical"
          ? "bg-red-600"
          : tone === "ai"
            ? "bg-violet-600"
            : tone === "info"
              ? "bg-blue-600"
              : "bg-slate-400";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      </div>
      <p className="mt-3 break-words text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
