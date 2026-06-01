"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminAccessMessage,
  AdminShell,
  ErrorBanner,
  formatDate,
  formatNumber,
} from "@/components/admin/AdminUI";
import {
  BulkBar,
  BulkButton,
  Check,
  DataSection,
  exportToCsv,
  FilterPills,
  MetricStrip,
  Pager,
  SearchBox,
  StatusDot,
  type Metric,
  type Tone,
} from "@/components/admin/DataView";
import { EmptyState, LoadingSkeleton } from "@/components/ui";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { listAdminAuditLogs } from "@/lib/admin";
import type { AdminAuditLogSummary } from "@/types";

const PAGE_SIZE = 12;
const DESTRUCTIVE = ["DELETE", "DEACTIVATE", "REMOVE", "DROP", "PURGE"];

function isDestructive(action: string) {
  const a = action.toUpperCase();
  return DESTRUCTIVE.some((d) => a.includes(d));
}

function actionTone(action: string): Tone {
  const a = action.toUpperCase();
  if (isDestructive(action)) return "danger";
  if (a.includes("REACTIVATE") || a.includes("CREATE") || a.includes("RETRY")) return "success";
  if (a.includes("ROLE") || a.includes("UPDATE")) return "info";
  return "neutral";
}

function relTime(value: string): string {
  try {
    const diff = (Date.now() - new Date(value).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch { return "—"; }
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      const n = key.toLowerCase();
      if (n.includes("password") || n.includes("secret") || n.includes("token") || n.includes("api_key") || n.includes("key")) {
        return [key, "Hidden"];
      }
      return [key, value];
    }),
  );
}

export default function AdminAuditLogsPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [logs, setLogs] = useState<AdminAuditLogSummary[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [destructiveOnly, setDestructiveOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const response = await listAdminAuditLogs({ page: 1, page_size: 100 });
      setLogs(response.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load audit logs.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const metrics: Metric[] = useMemo(() => {
    const total = logs.length;
    const actors = new Set(logs.map(l => l.actor_email ?? "system")).size;
    const destructive = logs.filter(l => isDestructive(l.action)).length;
    const latest = logs.reduce<string | null>((acc, l) => (!acc || l.created_at > acc ? l.created_at : acc), null);
    return [
      { label: "Events", value: formatNumber(total), icon: "activity", tone: "brand" },
      { label: "Unique actors", value: formatNumber(actors), icon: "user", tone: "info" },
      { label: "Destructive", value: formatNumber(destructive), icon: "alertCircle", tone: destructive > 0 ? "danger" : "neutral" },
      { label: "Last event", value: latest ? relTime(latest) : "—", icon: "clock", tone: "neutral" },
    ];
  }, [logs]);

  const actions = useMemo(() => Array.from(new Set(logs.map(l => l.action))).sort(), [logs]);
  const targetCounts = useMemo(() => {
    const c: Record<string, number> = {};
    logs.forEach(l => { c[l.target_type] = (c[l.target_type] ?? 0) + 1; });
    return c;
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      const matchesSearch = !q || l.action.toLowerCase().includes(q) || (l.actor_email ?? "system").toLowerCase().includes(q) || (l.reason ?? "").toLowerCase().includes(q) || l.target_type.toLowerCase().includes(q);
      return matchesSearch && (!targetType || l.target_type === targetType) && (!action || l.action === action) && (!destructiveOnly || isDestructive(l.action));
    });
  }, [action, destructiveOnly, logs, search, targetType]);

  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [action, destructiveOnly, search, targetType]);

  const allVisibleSelected = visible.length > 0 && visible.every(l => selectedIds.has(l.id));
  const someVisibleSelected = visible.some(l => selectedIds.has(l.id));
  const selected = logs.filter(l => selectedIds.has(l.id));

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((cur) => { const next = new Set(cur); if (checked) next.add(id); else next.delete(id); return next; });
  }
  function toggleAllVisible(checked: boolean) {
    setSelectedIds((cur) => { const next = new Set(cur); visible.forEach(l => { if (checked) next.add(l.id); else next.delete(l.id); }); return next; });
  }
  function exportSelected() {
    exportToCsv("audit-logs.csv", selected.map(l => ({
      actor: l.actor_email ?? "system", action: l.action, target_type: l.target_type, target_id: l.target_id ?? "",
      reason: l.reason ?? "", ip: l.ip_address ?? "", created_at: l.created_at,
    })));
  }

  if (isLoading) return <AdminAccessMessage title="Audit Logs" label="Checking admin access." />;
  if (!isAdmin) return <AdminAccessMessage title="Audit Logs" label="Admin access required." />;

  return (
    <AdminShell title="Audit Logs" description="Review administrative actions, actors, and reasons.">
      <div className="grid gap-5">
        <ErrorBanner message={error} onRetry={() => void load()} />

        <MetricStrip metrics={metrics} />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchBox value={search} onChange={setSearch} placeholder="Search action, actor, reason…" />
            <FilterPills ariaLabel="Filter by target" value={targetType} onChange={setTargetType}
              options={[
                { value: "", label: "All targets" },
                { value: "user", label: "Users", count: targetCounts.user },
                { value: "workspace", label: "Workspaces", count: targetCounts.workspace },
                { value: "document", label: "Documents", count: targetCounts.document },
              ]} />
            <button type="button" onClick={() => setDestructiveOnly(v => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${destructiveOnly ? "border-danger-line bg-danger-subtle text-danger-fg" : "border-line bg-surface text-fg-muted hover:bg-hover"}`}>
              <StatusDot tone="danger" /> Destructive only
            </button>
          </div>
          {actions.length > 1 ? (
            <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action"
              className="h-9 w-full max-w-xs rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas">
              <option value="">All actions ({actions.length})</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          ) : null}
        </div>

        <BulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
          <BulkButton icon="fileText" onClick={exportSelected}>Export CSV</BulkButton>
        </BulkBar>

        <DataSection title="Audit trail" count={filtered.length} countLabel="events">
          {isFetching ? (
            <div className="p-4"><LoadingSkeleton label="Loading audit logs" rows={5} /></div>
          ) : visible.length === 0 ? (
            <div className="p-4"><EmptyState title="No audit logs found" description="Try changing the action, target, or search filters." /></div>
          ) : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col" className="w-10 px-3 py-2.5">
                        <Check ariaLabel="Select all visible logs" checked={allVisibleSelected} indeterminate={someVisibleSelected} onChange={toggleAllVisible} />
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Actor</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Action</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Target</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Reason</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">When</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((l) => {
                      const sel = selectedIds.has(l.id);
                      const tone = actionTone(l.action);
                      return (
                        <tr key={l.id} className={`group transition hover:bg-hover ${sel ? "bg-brand-subtle/40" : ""}`}>
                          <td className="px-3 py-3"><Check ariaLabel={`Select log ${l.id}`} checked={sel} onChange={(c) => toggleOne(l.id, c)} /></td>
                          <td className="whitespace-nowrap px-3 py-3 text-fg-muted">{l.actor_email ?? "System"}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-sunken px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                              <StatusDot tone={tone} /> {l.action}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium capitalize text-fg-muted">{l.target_type}</div>
                            <div className="break-all font-mono text-[10px] text-fg-subtle">{l.target_id ?? "—"}</div>
                          </td>
                          <td className="max-w-sm px-3 py-3 text-fg-muted">{l.reason ?? "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-fg-subtle" title={formatDate(l.created_at)}>{relTime(l.created_at)}</td>
                          <td className="px-3 py-3">
                            {l.metadata && Object.keys(l.metadata).length > 0 ? (
                              <details className="min-w-0">
                                <summary className="cursor-pointer text-xs font-medium text-fg-muted">View</summary>
                                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                                  {JSON.stringify(sanitizeMetadata(l.metadata), null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <span className="text-xs text-fg-subtle">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
            </>
          )}
        </DataSection>
      </div>
    </AdminShell>
  );
}
