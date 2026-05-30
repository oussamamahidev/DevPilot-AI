"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  ConfirmReasonModal,
  ErrorBanner,
  formatBytes,
  formatDate,
  formatDecimal,
  formatNumber,
  PaginationControls,
  StatusBadge,
  Toolbar,
} from "@/components/admin/AdminUI";
import { Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { deleteAdminDocument, listAdminDocuments } from "@/lib/admin";
import type { AdminDocumentSummary } from "@/types";

const PAGE_SIZE = 10;

export default function AdminDocumentsPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [documents, setDocuments] = useState<AdminDocumentSummary[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminDocumentSummary | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const response = await listAdminDocuments({ page: 1, page_size: 100 });
      setDocuments(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load documents.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesSearch =
        !term ||
        document.filename.toLowerCase().includes(term) ||
        document.workspace_name.toLowerCase().includes(term) ||
        (document.uploader_email ?? "").toLowerCase().includes(term);
      return matchesSearch && (!status || document.status === status);
    });
  }, [documents, search, status]);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, status]);

  async function deleteDocument(reason: string) {
    if (!pendingDelete) {
      return;
    }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const updatedDocument = await deleteAdminDocument(pendingDelete.id, reason);
      setDocuments((current) =>
        current.map((document) =>
          document.id === updatedDocument.id
            ? {
                ...document,
                processed_at: updatedDocument.processed_at,
                status: updatedDocument.status,
              }
            : document,
        ),
      );
      setPendingDelete(null);
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : "Delete failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <AdminAccessMessage title="Documents" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Documents" label="Admin access required." />;
  }

  return (
    <AdminShell title="Documents" description="Inspect uploaded documents and indexing state.">
      <ErrorBanner message={error} onRetry={() => void load()} />
      <Toolbar search={search} setSearch={setSearch}>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
        >
          <option value="">All statuses</option>
          <option value="uploaded">Uploaded</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="indexed">Indexed</option>
          <option value="failed">Failed</option>
          <option value="deleted">Deleted</option>
        </select>
      </Toolbar>

      <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-fg">Document Directory</h2>
          <span className="text-sm text-fg-subtle">{formatNumber(filtered.length)} documents</span>
        </div>
        {isFetching ? <LoadingSkeleton label="Loading documents" rows={4} /> : null}
        {!isFetching && visible.length === 0 ? (
          <EmptyState
            title="No documents found"
            description="Try changing the filename, workspace, uploader, or status filter."
          />
        ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead className="bg-sunken text-xs uppercase text-fg-subtle">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Filename</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Workspace</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Uploader</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Chunks</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Vector coverage</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {visible.map((document) => (
                <tr key={document.id}>
                  <td className="px-3 py-3">
                    <div className="break-words font-medium text-fg">{document.filename}</div>
                    <div className="text-xs text-fg-subtle">
                      {formatBytes(document.file_size)} · {formatDate(document.created_at)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge status={document.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-fg-muted">
                    {document.file_type || "unknown"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-fg-muted">
                    {document.workspace_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-fg-muted">
                    {document.uploader_email ?? "Unknown"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-fg-muted">
                    {formatNumber(document.chunks_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-fg-subtle">
                    {document.chunks_count > 0
                      ? `${formatDecimal((document.chunks_with_vector_id / document.chunks_count) * 100, 1)}%`
                      : "0.0%"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/documents/${document.id}`}
                        className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover"
                      >
                        View
                      </Link>
                      <Link
                        href={`/admin/ragops/documents/${document.id}`}
                        className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover"
                      >
                        Pipeline
                      </Link>
                      {document.status !== "deleted" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => setPendingDelete(document)}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        <PaginationControls
          page={page}
          setPage={setPage}
          canPrevious={page > 0}
          canNext={(page + 1) * PAGE_SIZE < filtered.length}
        />
      </section>
      <ConfirmReasonModal
        isOpen={Boolean(pendingDelete)}
        actionLabel={`Delete ${pendingDelete?.filename ?? "document"}`}
        confirmLabel="Delete"
        error={modalError}
        isSubmitting={isSubmitting}
        requireConfirmText
        onClose={() => {
          setPendingDelete(null);
          setModalError(null);
        }}
        onConfirm={deleteDocument}
      />
    </AdminShell>
  );
}
