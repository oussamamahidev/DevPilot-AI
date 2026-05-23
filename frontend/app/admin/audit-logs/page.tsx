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
import { EmptyState, LoadingSkeleton, StatusBadge } from "@/components/ui";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { listAdminAuditLogs } from "@/lib/admin";
import type { AdminAuditLogSummary } from "@/types";

const PAGE_SIZE = 10;

export default function AdminAuditLogsPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [logs, setLogs] = useState<AdminAuditLogSummary[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
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
        (log.reason ?? "").toLowerCase().includes(term) ||
        log.target_type.toLowerCase().includes(term);
      return (
        matchesSearch &&
        (!targetType || log.target_type === targetType) &&
        (!action || log.action === action)
      );
    });
  }, [action, logs, search, targetType]);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const actions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs],
  );

  useEffect(() => {
    setPage(0);
  }, [action, search, targetType]);

  if (isLoading) {
    return <AdminAccessMessage title="Audit Logs" label="Checking admin access." />;
  }
  if (!isAdmin) {
    return <AdminAccessMessage title="Audit Logs" label="Admin access required." />;
  }

  return (
    <AdminShell title="Audit Logs" description="Review administrative actions and reasons.">
      <ErrorBanner message={error} onRetry={() => void load()} />
      <Toolbar search={search} setSearch={setSearch}>
        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All actions</option>
          {actions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
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
        {isFetching ? <LoadingSkeleton label="Loading audit logs" rows={4} /> : null}
        {!isFetching && visible.length === 0 ? (
          <EmptyState
            title="No audit logs found"
            description="Try changing the action, target, or search filters."
          />
        ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Actor</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Target</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Reason</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Created</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {log.actor_email ?? "System"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge label={log.action} tone="neutral" />
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
                  <td className="px-3 py-3">
                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                      <details className="max-w-sm">
                        <summary className="cursor-pointer text-xs font-medium text-slate-700">
                          View metadata
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                          {JSON.stringify(sanitizeMetadata(log.metadata), null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
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

function sanitizeMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      const normalized = key.toLowerCase();
      if (
        normalized.includes("password") ||
        normalized.includes("secret") ||
        normalized.includes("token") ||
        normalized.includes("api_key") ||
        normalized.includes("key")
      ) {
        return [key, "Hidden"];
      }
      return [key, value];
    }),
  );
}
