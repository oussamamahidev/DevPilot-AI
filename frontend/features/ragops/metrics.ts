import type {
  AdminStats,
  RagHealthStatus,
  RagOpsQdrantHealth,
  RagOpsWorkspaceSummary,
  RagTraceQualitySummary,
} from "@/types";
import type { DerivedInsights, Insight, OverviewMetrics } from "./types";

const nf = new Intl.NumberFormat("en-US");
const fmt = (value: number) => nf.format(Math.round(value));
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/** Aggregate the real per-workspace summaries (+ platform stats/quality) into one overview. */
export function computeOverview(
  workspaces: RagOpsWorkspaceSummary[],
  stats: AdminStats | undefined,
  quality: RagTraceQualitySummary | undefined,
): OverviewMetrics {
  const sum = (selector: (workspace: RagOpsWorkspaceSummary) => number) =>
    workspaces.reduce((total, workspace) => total + selector(workspace), 0);

  const statusCounts: Record<RagHealthStatus, number> = { healthy: 0, warning: 0, critical: 0 };
  for (const workspace of workspaces) {
    statusCounts[workspace.rag_health_status] += 1;
  }

  const totalChunks = sum((w) => w.total_chunks);
  const chunksWithVectors = sum((w) => w.chunks_with_vector_id);
  const healthWeighted =
    totalChunks > 0
      ? sum((w) => w.rag_health_score * w.total_chunks) / totalChunks
      : workspaces.length > 0
        ? sum((w) => w.rag_health_score) / workspaces.length
        : 0;

  const worst =
    workspaces.length > 0
      ? [...workspaces].sort((a, b) => a.rag_health_score - b.rag_health_score)[0]
      : null;

  const totalQueries = quality?.total_rag_queries ?? stats?.total_rag_queries ?? 0;
  const retrievalSuccessRate =
    quality && quality.total_rag_queries > 0
      ? (quality.total_rag_queries - quality.no_context_count) / quality.total_rag_queries
      : null;

  return {
    workspaceCount: workspaces.length,
    statusCounts,
    ragHealthScore: Math.round(healthWeighted),
    faithfulness: quality?.average_faithfulness ?? stats?.average_faithfulness ?? null,
    relevance: quality?.average_relevance ?? stats?.average_relevance ?? null,
    contextPrecision: quality?.average_context_precision ?? null,
    hallucination: quality?.average_hallucination_score ?? null,
    retrievalSuccessRate,
    indexedDocuments: sum((w) => w.documents_indexed),
    totalDocuments: sum((w) => w.documents_total),
    queuedDocuments: sum((w) => w.documents_queued),
    processingDocuments: sum((w) => w.documents_processing),
    failedDocuments: sum((w) => w.documents_failed),
    deletedDocuments: sum((w) => w.documents_deleted),
    totalChunks,
    chunksWithVectors,
    chunksMissing: sum((w) => w.chunks_missing_vector_id),
    embeddingCoverage: totalChunks > 0 ? chunksWithVectors / totalChunks : 1,
    totalQueries,
    avgLatencyMs: stats?.average_latency_ms ?? null,
    worstWorkspace: worst
      ? { id: worst.workspace_id, name: worst.workspace_name, score: Math.round(worst.rag_health_score) }
      : null,
  };
}

/** Rules engine: turn real metrics into an executive insight (findings / risks / recommendations). */
export function deriveInsights(
  metrics: OverviewMetrics,
  qdrant: RagOpsQdrantHealth | undefined,
  quality: RagTraceQualitySummary | undefined,
): DerivedInsights {
  const findings: Insight[] = [];
  const risks: Insight[] = [];
  const recommendations: Insight[] = [];

  findings.push({
    id: "health",
    tone: metrics.ragHealthScore >= 85 ? "success" : metrics.ragHealthScore >= 60 ? "warning" : "critical",
    title: `Platform health ${metrics.ragHealthScore}/100`,
    detail: `${metrics.statusCounts.healthy} healthy · ${metrics.statusCounts.warning} warning · ${metrics.statusCounts.critical} critical workspaces.`,
  });
  findings.push({
    id: "coverage",
    tone: metrics.embeddingCoverage >= 0.85 ? "success" : "warning",
    title: `Embedding coverage ${pct(metrics.embeddingCoverage)}`,
    detail: `${fmt(metrics.chunksWithVectors)} of ${fmt(metrics.totalChunks)} chunks vectorized.`,
  });
  if (metrics.faithfulness != null) {
    findings.push({
      id: "faithfulness",
      tone: metrics.faithfulness >= 0.75 ? "success" : metrics.faithfulness >= 0.5 ? "warning" : "critical",
      title: `Faithfulness ${metrics.faithfulness.toFixed(2)}`,
      detail: `Averaged across ${fmt(metrics.totalQueries)} RAG queries.`,
    });
  }

  if (qdrant && !qdrant.reachable) {
    risks.push({
      id: "qdrant",
      tone: "critical",
      title: "Qdrant unreachable",
      detail: qdrant.error ?? "The vector store is not responding — retrieval will fail.",
    });
  }
  if ((qdrant?.mismatch_count ?? 0) > 0) {
    risks.push({
      id: "mismatch",
      tone: "warning",
      title: `${fmt(qdrant!.mismatch_count!)} vector mismatch`,
      detail: "Postgres and Qdrant vector counts have diverged.",
    });
  }
  if (metrics.failedDocuments > 0) {
    risks.push({
      id: "failed",
      tone: "critical",
      title: `${fmt(metrics.failedDocuments)} failed documents`,
      detail: "Ingestion failures are reducing retrievable context.",
    });
  }
  if (metrics.hallucination != null && metrics.hallucination > 0.6) {
    risks.push({
      id: "hallucination",
      tone: "critical",
      title: `Elevated hallucination ${metrics.hallucination.toFixed(2)}`,
      detail: "Answers are drifting away from their sources.",
    });
  }
  if (metrics.embeddingCoverage < 0.85) {
    risks.push({
      id: "embedding-gap",
      tone: "warning",
      title: `Embedding gap ${pct(1 - metrics.embeddingCoverage)}`,
      detail: `${fmt(metrics.chunksMissing)} chunks are missing vectors.`,
    });
  }
  if (metrics.statusCounts.critical > 0 && metrics.worstWorkspace) {
    risks.push({
      id: "critical-ws",
      tone: "critical",
      title: `${metrics.statusCounts.critical} critical workspace${metrics.statusCounts.critical > 1 ? "s" : ""}`,
      detail: `Lowest: ${metrics.worstWorkspace.name} at ${metrics.worstWorkspace.score}/100.`,
      href: `/admin/ragops/workspaces/${metrics.worstWorkspace.id}`,
    });
  }

  if (metrics.failedDocuments > 0) {
    recommendations.push({
      id: "r-retry",
      tone: "info",
      title: "Retry failed ingestions",
      detail: "Re-run extraction and embedding for failed documents to restore coverage.",
    });
  }
  if ((qdrant?.mismatch_count ?? 0) > 0) {
    recommendations.push({
      id: "r-reindex",
      tone: "info",
      title: "Reconcile the vector store",
      detail: "Reindex to close the Postgres ↔ Qdrant mismatch.",
    });
  }
  if (metrics.worstWorkspace && metrics.worstWorkspace.score < 60) {
    recommendations.push({
      id: "r-ws",
      tone: "info",
      title: `Investigate ${metrics.worstWorkspace.name}`,
      detail: "Open the workspace drilldown to inspect pipeline failures.",
      href: `/admin/ragops/workspaces/${metrics.worstWorkspace.id}`,
    });
  }
  if (quality && quality.hallucination_risk_count > 0) {
    recommendations.push({
      id: "r-eval",
      tone: "info",
      title: "Review the worst answers",
      detail: `${fmt(quality.hallucination_risk_count)} answers flagged for high hallucination risk.`,
      href: "/admin/rag-traces",
    });
  }

  if (risks.length === 0) {
    findings.push({
      id: "clear",
      tone: "success",
      title: "No active risks detected",
      detail: "All tracked subsystems are within healthy thresholds.",
    });
  }

  return { findings, risks, recommendations };
}
