"use client";

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
import { listAdminAuditLogs } from "@/lib/admin";
import type { AdminAuditLogSummary } from "@/types";

const PAGE_SIZE = 10;

export default function AdminAuditLogsPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [logs, setLogs] = useState<AdminAuditLogSummary[]>([]);
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("");
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
      const response = await listAdminAuditLogs({ page: 1, page_size: 100 });
      setLogs(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load audit logs.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSearch =
        !term ||
        log.action.toLowerCase().includes(term) ||
        (log.actor_email ?? "system").toLowerCase().includes(term) ||
        (log.reason ?? "").toLowerCase().includes(term);
      return matchesSearch && (!targetType || log.target_type === targetType);
    });
  }, [logs, search, targetType]);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, targetType]);

  if (isLoading) {
    return <AdminAccessMessage title="Audit Logs" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Audit Logs" label="Admin access required." />;
  }

  return (
    <AdminShell title="Audit Logs" description="Review administrative actions and reasons.">
      <ErrorBanner message={error} />
      <Toolbar search={search} setSearch={setSearch}>
        <select
          value={targetType}
          onChange={(event) => setTargetType(event.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All targets</option>
          <option value="user">User</option>
          <option value="workspace">Workspace</option>
          <option value="document">Document</option>
        </select>
      </Toolbar>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">Audit Trail</h2>
          <span className="text-sm text-slate-500">{formatNumber(filtered.length)} logs</span>
        </div>
        {isFetching ? <LoadingState label="Loading audit logs" /> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Actor</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Target</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Reason</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-950">
                    {log.action}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {log.actor_email ?? "System"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-700">{log.target_type}</div>
                    <div className="max-w-xs truncate text-xs text-slate-500">
                      {log.target_id ?? "No target"}
                    </div>
                  </td>
                  <td className="max-w-sm px-3 py-3 text-slate-600">
                    {log.reason ?? "No reason"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                    {formatDate(log.created_at)}
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
