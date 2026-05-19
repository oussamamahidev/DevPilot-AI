"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  ErrorBanner,
  formatBytes,
  formatDate,
  formatNumber,
  PaginationControls,
  StatusBadge,
  Toolbar,
} from "@/components/admin/AdminUI";
import { LoadingState } from "@/components/LoadingState";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { listAdminDocuments } from "@/lib/admin";
import type { AdminDocumentSummary } from "@/types";

const PAGE_SIZE = 10;

export default function AdminDocumentsPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [documents, setDocuments] = useState<AdminDocumentSummary[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

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

  if (isLoading) {
    return <AdminAccessMessage title="Documents" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Documents" label="Admin access required." />;
  }

  return (
    <AdminShell title="Documents" description="Inspect uploaded documents and indexing state.">
      <ErrorBanner message={error} />
      <Toolbar search={search} setSearch={setSearch}>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
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

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">Document Directory</h2>
          <span className="text-sm text-slate-500">{formatNumber(filtered.length)} documents</span>
        </div>
        {isFetching ? <LoadingState label="Loading documents" /> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">File</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Workspace</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Chunks</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Uploaded</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((document) => (
                <tr key={document.id}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-950">{document.filename}</div>
                    <div className="text-xs text-slate-500">{formatBytes(document.file_size)}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {document.workspace_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge status={document.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {formatNumber(document.chunks_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                    {formatDate(document.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link
                      href={`/admin/documents/${document.id}`}
                      className="text-sm font-medium text-slate-950 underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
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
          canNext={(page + 1) * PAGE_SIZE < filtered.length}
        />
      </section>
    </AdminShell>
  );
}
