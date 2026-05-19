"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  ConfirmReasonModal,
  formatBytes,
  formatDate,
  formatDecimal,
  formatNumber,
  PaginationControls,
} from "@/components/admin/AdminUI";
import {
  BarChartCard,
  chartPalette,
  EmptyState,
  ErrorCard,
  LoadingSkeleton,
  PageHeader,
  PipelineStepper,
  ProgressRing,
  RefreshButton,
  safePreview,
  StatCard,
  StatusBadge,
} from "@/components/admin/AnalyticsUI";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  getRagOpsDocumentPipeline,
  listRagOpsDocumentChunks,
  retryRagOpsDocument,
} from "@/lib/admin";
import type { RagOpsChunksResponse, RagOpsDocumentPipeline } from "@/types";

const PAGE_SIZE = 25;

export default function RagOpsDocumentPage() {
  const params = useParams<{ id: string }>();
  const { isAdmin, isLoading } = useAdminAccess();
  const [pipeline, setPipeline] = useState<RagOpsDocumentPipeline | null>(null);
  const [chunks, setChunks] = useState<RagOpsChunksResponse | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const documentId = params.id;

  const load = useCallback(async () => {
    if (!isAdmin || !documentId) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const [pipelineData, chunksData] = await Promise.all([
        getRagOpsDocumentPipeline(documentId),
        listRagOpsDocumentChunks(documentId, {
          include_content: false,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
      ]);
      setPipeline(pipelineData);
      setChunks(chunksData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load document RAGOps state.");
    } finally {
      setIsFetching(false);
    }
  }, [documentId, isAdmin, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const chunkHistogram = useMemo(() => {
    return (
      chunks?.chunks.map((chunk) => ({
        chunk: `#${chunk.chunk_index}`,
        length: chunk.content_preview.length,
        tokens: chunk.token_count ?? 0,
      })) ?? []
    );
  }, [chunks]);

  async function retryDocument(reason: string) {
    if (!pipeline || reason.trim().length < 3) {
      setModalError("Enter a reason with at least 3 characters.");
      return;
    }
    setIsSubmitting(true);
    setModalError(null);
    try {
      await retryRagOpsDocument(pipeline.document_id, reason);
      setIsRetrying(false);
      await load();
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : "Retry failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <AdminAccessMessage title="Document Pipeline" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Document Pipeline" label="Admin access required." />;
  }

  return (
    <AdminShell
      title="DevPilot AI Control Center"
      description="Document ingestion lifecycle, chunking, embedding coverage, and vector indexing."
    >
      <PageHeader
        title={pipeline?.filename ?? "Document Pipeline"}
        subtitle={
          pipeline
            ? `${pipeline.workspace_name} - ${pipeline.file_type.toUpperCase()} - ${formatBytes(
                pipeline.file_size,
              )}`
            : "Visual document lifecycle from upload to Qdrant indexing."
        }
        actions={
          <>
            {pipeline?.retry_allowed ? (
              <button
                type="button"
                onClick={() => setIsRetrying(true)}
                className="h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white shadow-sm"
              >
                Retry
              </button>
            ) : null}
            <RefreshButton isFetching={isFetching} onClick={() => void load()} />
          </>
        }
      />
      <ErrorCard message={error} onRetry={() => void load()} />

      {isFetching && !pipeline ? <LoadingSkeleton rows={4} /> : null}

      {pipeline ? (
        <div className="grid gap-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard
              label="Status"
              value={pipeline.status}
              description={pipeline.retry_allowed ? "Retry is available" : "No retry needed"}
              badge={pipeline.status}
              tone={pipeline.status === "failed" ? "critical" : pipeline.status === "indexed" ? "success" : "info"}
            />
            <StatCard
              label="Uploaded"
              value={formatDate(pipeline.created_at)}
              description={`Uploader ${pipeline.uploader_email ?? "unknown"}`}
              badge="Upload"
              tone="info"
            />
            <StatCard
              label="Processed"
              value={formatDate(pipeline.processed_at)}
              description={`Duration ${formatDuration(pipeline.processing_duration_seconds)}`}
              badge="Processing"
              tone="ai"
            />
            <StatCard
              label="Chunks"
              value={formatNumber(pipeline.chunks_count)}
              description={`${formatDecimal(pipeline.average_chunk_length, 0)} chars average`}
              badge="Chunking"
              tone="info"
            />
            <StatCard
              label="Vector Coverage"
              value={`${formatDecimal(pipeline.embedding_coverage_percent, 1)}%`}
              description={`${formatNumber(pipeline.chunks_with_vector_id)} vectorized chunks`}
              progress={pipeline.embedding_coverage_percent}
              badge={pipeline.qdrant_indexed ? "Qdrant" : "Missing"}
              tone={pipeline.embedding_coverage_percent >= 85 ? "success" : "warning"}
            />
            <StatCard
              label="Workspace"
              value={pipeline.workspace_name}
              description="Owning project"
              badge="Scope"
              tone="neutral"
            />
          </section>

          <PipelineStepper steps={pipeline.pipeline_steps} />

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-950">Embedding Coverage Ring</h3>
              <div className="mt-6 grid place-items-center">
                <ProgressRing
                  label={`${formatNumber(pipeline.chunks_with_vector_id)} of ${formatNumber(
                    pipeline.chunks_count,
                  )} chunks`}
                  size={180}
                  value={pipeline.embedding_coverage_percent}
                  tone={pipeline.embedding_coverage_percent >= 85 ? "success" : "warning"}
                />
              </div>
              <div className="mt-6 grid gap-3">
                <InfoRow label="Missing vectors" value={formatNumber(pipeline.chunks_missing_vector_id)} />
                <InfoRow label="Minimum chunk" value={`${formatNumber(pipeline.min_chunk_length)} chars`} />
                <InfoRow label="Maximum chunk" value={`${formatNumber(pipeline.max_chunk_length)} chars`} />
              </div>
            </section>
            <BarChartCard
              title="Chunk Size Distribution"
              data={chunkHistogram}
              xKey="chunk"
              bars={[
                { key: "length", name: "Preview length", color: chartPalette.blue },
                { key: "tokens", name: "Tokens", color: chartPalette.ai },
              ]}
            />
          </div>

          {pipeline.errors.length > 0 ? (
            <section className="rounded-lg border border-red-200 bg-red-50 p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-red-950">Pipeline Errors</h3>
                <StatusBadge label={`${formatNumber(pipeline.errors.length)} errors`} tone="critical" />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-red-800">
                {pipeline.errors.map((item) => (
                  <p key={item}>{safePreview(item, 260)}</p>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-950">Chunk Preview Table</h3>
              <span className="text-sm text-slate-500">{formatNumber(chunks?.total ?? 0)} chunks</span>
            </div>
            {chunks && chunks.chunks.length === 0 ? (
              <EmptyState label="No chunks found for this document." />
            ) : chunks ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Index</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Preview</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Vector</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Tokens</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Metadata</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chunks.chunks.map((chunk) => (
                        <tr key={chunk.chunk_id}>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {formatNumber(chunk.chunk_index)}
                          </td>
                          <td className="max-w-xl px-3 py-3 text-slate-700">
                            {safePreview(chunk.content_preview, 180)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <StatusBadge
                              label={chunk.vector_id_exists ? "Vector" : "Missing"}
                              tone={chunk.vector_id_exists ? "success" : "critical"}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {chunk.token_count === null ? "Unknown" : formatNumber(chunk.token_count)}
                          </td>
                          <td className="max-w-sm px-3 py-3 text-xs text-slate-500">
                            {metadataPreview(chunk.metadata)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                            {formatDate(chunk.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={page}
                  setPage={setPage}
                  canPrevious={page > 0}
                  canNext={(page + 1) * PAGE_SIZE < chunks.total}
                />
              </>
            ) : (
              <LoadingSkeleton rows={2} />
            )}
          </section>
        </div>
      ) : null}

      <ConfirmReasonModal
        isOpen={isRetrying}
        actionLabel="Retry document processing"
        confirmLabel="Retry"
        error={modalError}
        isSubmitting={isSubmitting}
        onClose={() => {
          setIsRetrying(false);
          setModalError(null);
        }}
        onConfirm={retryDocument}
      />
    </AdminShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "In progress";
  }
  if (seconds < 60) {
    return `${formatDecimal(seconds, 1)} s`;
  }
  return `${formatDecimal(seconds / 60, 1)} min`;
}

function metadataPreview(metadata: Record<string, unknown>) {
  const value = JSON.stringify(metadata);
  if (value.length <= 120) {
    return value;
  }
  return `${value.slice(0, 117)}...`;
}
