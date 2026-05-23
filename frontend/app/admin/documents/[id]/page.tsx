"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AdminAccessMessage,
  AdminShell,
  ConfirmReasonModal,
  ErrorBanner,
  formatBytes,
  formatDate,
  formatNumber,
  StatusBadge,
} from "@/components/admin/AdminUI";
import { EmptyState, LoadingSkeleton } from "@/components/ui";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { deleteAdminDocument, getAdminDocument } from "@/lib/admin";
import type { AdminDocumentDetail } from "@/types";

export default function AdminDocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const { isAdmin, isLoading } = useAdminAccess();
  const [document, setDocument] = useState<AdminDocumentDetail | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const documentId = params.id;

  const load = useCallback(async () => {
    if (!isAdmin || !documentId) {
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      setDocument(await getAdminDocument(documentId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load document.");
    } finally {
      setIsFetching(false);
    }
  }, [documentId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteDocument(reason: string) {
    if (!document || reason.trim().length < 3) {
      setModalError("Enter a reason with at least 3 characters.");
      return;
    }
    setIsSubmitting(true);
    setModalError(null);
    try {
      setDocument(await deleteAdminDocument(document.id, reason));
      setIsConfirmingDelete(false);
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : "Delete failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <AdminAccessMessage title="Document Detail" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Document Detail" label="Admin access required." />;
  }

  return (
    <AdminShell title="Document Detail" description="Inspect document ingestion and indexing state.">
      <ErrorBanner message={error} onRetry={() => void load()} />
      {isFetching && !document ? (
        <LoadingSkeleton label="Loading document" rows={3} />
      ) : null}

      {document ? (
        <div className="grid gap-6">
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="break-words text-xl font-semibold text-slate-950">
                  {document.filename}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{document.workspace_name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={document.status} />
                <Link
                  href={`/admin/ragops/documents/${document.id}`}
                  className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Open Pipeline
                </Link>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  disabled={document.status === "deleted"}
                  className="h-10 rounded-md border border-red-300 bg-red-50 px-4 text-sm font-medium text-red-800 disabled:cursor-not-allowed disabled:text-red-300"
                >
                  Delete Document
                </button>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <Info label="Type" value={document.file_type.toUpperCase()} />
              <Info label="Size" value={formatBytes(document.file_size)} />
              <Info label="Chunks" value={formatNumber(document.chunks_count)} />
              <Info label="Uploader" value={document.uploader_email ?? "Unknown"} />
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Vector Coverage</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Info
                label="Chunks With Vector"
                value={formatNumber(document.chunks_with_vector_id)}
              />
              <Info
                label="Coverage"
                value={`${document.vector_coverage_percent.toFixed(2)}%`}
              />
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Lifecycle</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Info label="Created" value={formatDate(document.created_at)} />
              <Info label="Processed" value={formatDate(document.processed_at)} />
            </div>
          </section>
        </div>
      ) : !isFetching && !error ? (
        <EmptyState
          title="Document not found"
          description="This document may have been deleted or the identifier is invalid."
        />
      ) : null}

      <ConfirmReasonModal
        isOpen={isConfirmingDelete}
        actionLabel="Delete document"
        confirmLabel="Delete"
        error={modalError}
        isSubmitting={isSubmitting}
        requireConfirmText
        onClose={() => {
          setIsConfirmingDelete(false);
          setModalError(null);
        }}
        onConfirm={deleteDocument}
      />
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}
