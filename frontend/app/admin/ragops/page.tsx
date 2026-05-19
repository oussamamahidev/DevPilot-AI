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
  computeWorkspaceHealthScore,
  DonutChartCard,
  EmptyState,
  ErrorCard,
  formatPercent,
  LoadingSkeleton,
  PageHeader,
  ProgressBar,
  RefreshButton,
  StatCard,
  StatusBadge,
} from "@/components/admin/AnalyticsUI";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getRagOpsQdrantHealth, listRagOpsWorkspaces } from "@/lib/admin";
import type { RagOpsQdrantHealth, RagOpsWorkspaceSummary } from "@/types";

export default function RagOpsPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [workspaces, setWorkspaces] = useState<RagOpsWorkspaceSummary[]>([]);
  const [qdrant, setQdrant] = useState<RagOpsQdrantHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const [workspaceData, qdrantData] = await Promise.all([
        listRagOpsWorkspaces(),
        getRagOpsQdrantHealth(),
      ]);
      setWorkspaces(workspaceData);
      setQdrant(qdrantData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load RAGOps data.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarize(workspaces), [workspaces]);

  if (isLoading) {
    return <AdminAccessMessage title="RAGOps Dashboard" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="RAGOps Dashboard" label="Admin access required." />;
  }

  return (
    <AdminShell
      title="DevPilot AI Control Center"
      description="RAGOps readiness, document ingestion health, vector coverage, and Qdrant synchronization."
    >
      <PageHeader
        title="RAGOps Dashboard"
        subtitle="Operational health of document ingestion, chunking, embeddings, vector indexing, and RAG readiness."
        actions={<RefreshButton isFetching={isFetching} onClick={() => void load()} />}
      />
      <ErrorCard message={error} onRetry={() => void load()} />

      {isFetching && workspaces.length === 0 ? <LoadingSkeleton rows={4} /> : null}

      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Healthy Workspaces"
            value={formatNumber(summary.healthy)}
            description={`${formatPercent(percentOf(summary.healthy, workspaces.length))} of tracked workspaces`}
            badge="Healthy"
            tone="success"
          />
          <StatCard
            label="Warning Workspaces"
            value={formatNumber(summary.warning)}
            description={`${formatPercent(percentOf(summary.warning, workspaces.length))} need attention`}
            badge="Warning"
            tone="warning"
          />
          <StatCard
            label="Critical Workspaces"
            value={formatNumber(summary.critical)}
            description={`${formatPercent(percentOf(summary.critical, workspaces.length))} blocking RAG readiness`}
            badge="Critical"
            tone={summary.critical > 0 ? "critical" : "success"}
          />
          <StatCard
            label="Global Embedding Coverage"
            value={formatPercent(summary.embeddingCoverage)}
            description={`${formatNumber(summary.chunksWithVectors)} chunks have vectors`}
            progress={summary.embeddingCoverage * 100}
            badge={summary.embeddingCoverage >= 0.85 ? "Synced" : "Gap"}
            tone={summary.embeddingCoverage >= 0.85 ? "success" : "warning"}
          />
          <StatCard
            label="Failed Documents"
            value={formatNumber(summary.failedDocuments)}
            description="Documents with failed ingestion state"
            badge={summary.failedDocuments > 0 ? "Retry" : "Clear"}
            tone={summary.failedDocuments > 0 ? "critical" : "success"}
          />
          <StatCard
            label="Total Chunks"
            value={formatNumber(summary.totalChunks)}
            description="Chunk records available for retrieval"
            badge="Indexed"
            tone="info"
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={qdrant?.qdrant_reachable ? "Qdrant reachable" : "Qdrant unreachable"}
                tone={qdrant?.qdrant_reachable ? "success" : "critical"}
              />
              <span className="text-sm text-slate-600">
                Collection {qdrant?.collection_name ?? "unknown"}
              </span>
            </div>
            <span className="text-sm text-slate-500">
              Mismatch {qdrant?.mismatch_count === null || qdrant?.mismatch_count === undefined
                ? "unknown"
                : formatNumber(qdrant.mismatch_count)}
            </span>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <DonutChartCard
            title="Workspace Health Distribution"
            centerLabel="Workspaces"
            data={[
              { name: "healthy", value: summary.healthy, color: chartPalette.emerald },
              { name: "warning", value: summary.warning, color: chartPalette.amber },
              { name: "critical", value: summary.critical, color: chartPalette.red },
            ]}
          />
          <div className="xl:col-span-2">
            <BarChartCard
              title="Embedding Coverage By Workspace"
              data={workspaces.map((workspace) => ({
                coverage: workspace.embedding_coverage_percent,
                workspace: workspace.workspace_name,
              }))}
              xKey="workspace"
              bars={[{ key: "coverage", name: "Coverage %", color: chartPalette.emerald }]}
            />
          </div>
        </div>

        <BarChartCard
          title="Document Indexing State By Workspace"
          data={workspaces.map((workspace) => ({
            deleted: workspace.documents_deleted,
            failed: workspace.documents_failed,
            indexed: workspace.documents_indexed,
            processing: workspace.documents_processing,
            queued: workspace.documents_queued,
            workspace: workspace.workspace_name,
          }))}
          xKey="workspace"
          stacked
          bars={[
            { key: "indexed", name: "Indexed", color: chartPalette.emerald },
            { key: "queued", name: "Queued", color: chartPalette.amber },
            { key: "processing", name: "Processing", color: chartPalette.blue },
            { key: "failed", name: "Failed", color: chartPalette.red },
            { key: "deleted", name: "Deleted", color: chartPalette.slate },
          ]}
        />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-950">Workspace Readiness</h3>
            <span className="text-sm text-slate-500">
              {formatNumber(workspaces.length)} workspaces
            </span>
          </div>
          {workspaces.length === 0 && !isFetching ? (
            <EmptyState label="No workspaces found." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {workspaces.map((workspace) => {
                const score = computeWorkspaceHealthScore(workspace);
                return (
                  <article
                    key={workspace.workspace_id}
                    className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h4 className="break-words font-semibold text-slate-950">
                          {workspace.workspace_name}
                        </h4>
                        <p className="mt-1 break-all text-sm text-slate-600">
                          {workspace.owner_email}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <StatusBadge status={workspace.rag_health_status} />
                        <Link
                          href={`/admin/ragops/workspaces/${workspace.workspace_id}`}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-950 shadow-sm"
                        >
                          Open
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">RAG health score</span>
                          <span className="font-semibold text-slate-950">{score}/100</span>
                        </div>
                        <ProgressBar
                          value={score}
                          tone={score >= 85 ? "success" : score >= 60 ? "warning" : "critical"}
                        />
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">Embedding coverage</span>
                          <span className="font-semibold text-slate-950">
                            {formatDecimal(workspace.embedding_coverage_percent, 1)}%
                          </span>
                        </div>
                        <ProgressBar
                          value={workspace.embedding_coverage_percent}
                          tone={
                            workspace.embedding_coverage_percent >= 85
                              ? "success"
                              : workspace.embedding_coverage_percent >= 60
                                ? "warning"
                                : "critical"
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <WorkspaceMetric
                        label="Documents"
                        value={formatNumber(workspace.documents_total)}
                      />
                      <WorkspaceMetric
                        label="Indexed"
                        value={formatNumber(workspace.documents_indexed)}
                      />
                      <WorkspaceMetric
                        label="Failed"
                        value={formatNumber(workspace.documents_failed)}
                        tone={workspace.documents_failed > 0 ? "critical" : "success"}
                      />
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                      Last indexed: {formatDate(workspace.last_document_indexed_at)}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function summarize(workspaces: RagOpsWorkspaceSummary[]) {
  const healthy = workspaces.filter((item) => item.rag_health_status === "healthy").length;
  const warning = workspaces.filter((item) => item.rag_health_status === "warning").length;
  const critical = workspaces.filter((item) => item.rag_health_status === "critical").length;
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
    critical,
    embeddingCoverage: totalChunks > 0 ? chunksWithVectors / totalChunks : 1,
    failedDocuments,
    healthy,
    totalChunks,
    warning,
  };
}

function percentOf(value: number, total: number) {
  return total > 0 ? value / total : 0;
}

function WorkspaceMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "success" | "critical" | "neutral";
  value: string;
}) {
  const color =
    tone === "success" ? "text-emerald-700" : tone === "critical" ? "text-red-700" : "text-slate-950";

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
