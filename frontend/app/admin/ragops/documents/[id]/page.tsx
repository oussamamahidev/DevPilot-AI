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
import type { RagOpsChunksResponse, RagOpsDocumentPipeline, RagPipelineStepStatus } from "@/types";

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
          page: page + 1,
          page_size: PAGE_SIZE,
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
      chunks?.items.map((chunk) => ({
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
      await retryRagOpsDocument(pipeline.document.id, reason);
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
        title={pipeline?.document.filename ?? "Document Pipeline"}
        subtitle={
          pipeline
            ? `${pipeline.document.file_type.toUpperCase()} - ${formatBytes(
                pipeline.document.file_size,
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
              value={pipeline.document.status}
              description={pipeline.retry_allowed ? "Retry is available" : "No retry needed"}
              badge={pipeline.document.status}
              tone={pipeline.document.status === "failed" ? "critical" : pipeline.document.status === "indexed" ? "success" : "info"}
            />
            <StatCard
              label="Uploaded"
              value={formatDate(pipeline.document.created_at)}
              description="Document row exists"
              badge="Upload"
              tone="info"
            />
            <StatCard
              label="Processed"
              value={formatDate(pipeline.document.processed_at)}
              description={`Qdrant ${pipeline.qdrant.qdrant_reachable ? "reachable" : "unreachable"}`}
              badge="Processing"
              tone="ai"
            />
            <StatCard
              label="Chunks"
              value={formatNumber(pipeline.stats.chunks_count)}
              description={`${formatDecimal(pipeline.stats.average_chunk_length, 0)} chars average`}
              badge="Chunking"
              tone="info"
            />
            <StatCard
              label="Vector Coverage"
              value={`${formatDecimal(pipeline.stats.embedding_coverage_percent, 1)}%`}
              description={`${formatNumber(pipeline.stats.chunks_with_vector_id)} vectorized chunks`}
              progress={pipeline.stats.embedding_coverage_percent}
              badge={pipeline.pipeline.qdrant_indexing === "completed" ? "Qdrant" : "Missing"}
              tone={pipeline.stats.embedding_coverage_percent >= 85 ? "success" : "warning"}
            />
            <StatCard
              label="Collection"
              value={pipeline.qdrant.collection}
              description="Vector collection"
              badge="Scope"
              tone="neutral"
            />
          </section>

          <PipelineStepper steps={pipelineSteps(pipeline)} />

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-950">Embedding Coverage Ring</h3>
              <div className="mt-6 grid place-items-center">
                <ProgressRing
                  label={`${formatNumber(pipeline.stats.chunks_with_vector_id)} of ${formatNumber(
                    pipeline.stats.chunks_count,
                  )} chunks`}
                  size={180}
                  value={pipeline.stats.embedding_coverage_percent}
                  tone={pipeline.stats.embedding_coverage_percent >= 85 ? "success" : "warning"}
                />
              </div>
              <div className="mt-6 grid gap-3">
                <InfoRow label="Missing vectors" value={formatNumber(pipeline.stats.chunks_missing_vector_id)} />
                <InfoRow label="Minimum chunk" value={`${formatNumber(pipeline.stats.min_chunk_length)} chars`} />
                <InfoRow label="Maximum chunk" value={`${formatNumber(pipeline.stats.max_chunk_length)} chars`} />
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
            {chunks && chunks.items.length === 0 ? (
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
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Metadata keys</th>
                        <th className="whitespace-nowrap px-3 py-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chunks.items.map((chunk) => (
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
      ) : !isFetching && !error ? (
        <EmptyState label="Document not found. Check the document ID or return to RAGOps." />
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

function pipelineSteps(pipeline: RagOpsDocumentPipeline) {
  const indexedStatus: RagPipelineStepStatus =
    pipeline.document.status === "failed"
      ? "failed"
      : pipeline.document.status === "indexed"
        ? "completed"
        : "pending";

  return [
    { name: "Upload", status: pipeline.pipeline.upload, timestamp: pipeline.document.created_at, detail: "Document row exists." },
    { name: "Extraction", status: pipeline.pipeline.extraction, timestamp: null, detail: "Chunks indicate extraction completed." },
    { name: "Chunking", status: pipeline.pipeline.chunking, timestamp: null, detail: `${formatNumber(pipeline.stats.chunks_count)} chunks.` },
    { name: "Embedding", status: pipeline.pipeline.embedding, timestamp: null, detail: `${formatDecimal(pipeline.stats.embedding_coverage_percent, 1)}% coverage.` },
    { name: "Qdrant Indexing", status: pipeline.pipeline.qdrant_indexing, timestamp: null, detail: pipeline.qdrant.collection },
    {
      name: "Indexed",
      status: indexedStatus,
      timestamp: pipeline.document.processed_at,
      detail:
        indexedStatus === "completed"
          ? "Ready for RAG chat."
          : indexedStatus === "failed"
            ? "Pipeline failed before the document became query-ready."
            : "Waiting for the final indexed status.",
    },
  ];
}

function metadataPreview(metadata: Record<string, unknown>) {
  const safeKeys = Object.keys(metadata).filter(
    (key) => !/token|secret|password|api[_-]?key|authorization|jwt|credential/i.test(key),
  );
  if (safeKeys.length === 0) {
    return "No metadata keys";
  }
  const visibleKeys = safeKeys.slice(0, 6).join(", ");
  return safeKeys.length > 6 ? `${visibleKeys}, +${safeKeys.length - 6} more` : visibleKeys;
}
