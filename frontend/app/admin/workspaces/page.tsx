"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  ErrorBanner,
  formatDate,
  formatNumber,
  PaginationControls,
  Toolbar,
} from "@/components/admin/AdminUI";
import { EmptyState, LoadingSkeleton } from "@/components/ui";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { listAdminWorkspaces } from "@/lib/admin";
import type { AdminWorkspaceSummary } from "@/types";

const PAGE_SIZE = 10;

export default function AdminWorkspacesPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceSummary[]>([]);
  const [search, setSearch] = useState("");
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
      const response = await listAdminWorkspaces({ page: 1, page_size: 100 });
      setWorkspaces(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load workspaces.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workspaces.filter(
      (workspace) =>
        !term ||
        workspace.name.toLowerCase().includes(term) ||
        workspace.owner_email.toLowerCase().includes(term),
    );
  }, [search, workspaces]);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search]);

  if (isLoading) {
    return <AdminAccessMessage title="Workspaces" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Workspaces" label="Admin access required." />;
  }

  return (
    <AdminShell title="Workspaces" description="Inspect tenant workspaces and ownership.">
      <ErrorBanner message={error} onRetry={() => void load()} />
      <Toolbar search={search} setSearch={setSearch} />
      <section className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-950">Workspace Directory</h2>
          <span className="text-sm text-slate-500">{formatNumber(filtered.length)} workspaces</span>
        </div>
        {isFetching ? <LoadingSkeleton label="Loading workspaces" rows={4} /> : null}
        {!isFetching && visible.length === 0 ? (
          <EmptyState
            title="No workspaces found"
            description="Try changing the workspace or owner search term."
          />
        ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Workspace</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Owner email</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Documents</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Members</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Created</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((workspace) => (
                <tr key={workspace.id}>
                  <td className="px-3 py-3">
                    <div className="break-words font-medium text-slate-950">{workspace.name}</div>
                    <div className="break-words text-xs text-slate-500">
                      {workspace.description ?? "No description"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {workspace.owner_email}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {formatNumber(workspace.document_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {formatNumber(workspace.member_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                    {formatDate(workspace.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <Link
                      href={`/admin/workspaces/${workspace.id}`}
                      className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      View
                    </Link>
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
    </AdminShell>
  );
}
