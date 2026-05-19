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
import { LoadingState } from "@/components/LoadingState";
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
      <ErrorBanner message={error} />
      <Toolbar search={search} setSearch={setSearch} />
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">Workspace Directory</h2>
          <span className="text-sm text-slate-500">{formatNumber(filtered.length)} workspaces</span>
        </div>
        {isFetching ? <LoadingState label="Loading workspaces" /> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Workspace</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Owner</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Members</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Documents</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Updated</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((workspace) => (
                <tr key={workspace.id}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-950">{workspace.name}</div>
                    <div className="max-w-sm truncate text-xs text-slate-500">
                      {workspace.description ?? "No description"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {workspace.owner_email}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {formatNumber(workspace.member_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {formatNumber(workspace.document_count)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                    {formatDate(workspace.updated_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link
                      href={`/admin/workspaces/${workspace.id}`}
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
