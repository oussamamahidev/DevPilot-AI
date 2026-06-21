"use client";

import Link from "next/link";
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
  type Metric,
} from "@/components/admin/DataView";
import { EmptyState, LoadingSkeleton } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { listAdminWorkspaces } from "@/lib/admin";
import type { AdminWorkspaceSummary } from "@/types";

const PAGE_SIZE = 10;

export default function AdminWorkspacesPage() {
  const { isAdmin, isLoading } = useAdminAccess();
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceSummary[]>([]);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const response = await listAdminWorkspaces({ page: 1, page_size: 100 });
      setWorkspaces(response.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load workspaces.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const metrics: Metric[] = useMemo(() => {
    const total = workspaces.length;
    const docs = workspaces.reduce((s, w) => s + w.document_count, 0);
    const members = workspaces.reduce((s, w) => s + w.member_count, 0);
    const avg = total > 0 ? (docs / total).toFixed(1) : "0";
    return [
      { label: "Workspaces", value: formatNumber(total), icon: "grid", tone: "brand" },
      { label: "Documents", value: formatNumber(docs), icon: "fileText", tone: "info" },
      { label: "Members", value: formatNumber(members), icon: "user", tone: "success" },
      { label: "Avg docs / workspace", value: avg, icon: "activity", tone: "neutral" },
    ];
  }, [workspaces]);

  const emptyCount = workspaces.filter(w => w.document_count === 0).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspaces.filter((w) => {
      const matchesSearch = !q || w.name.toLowerCase().includes(q) || w.owner_email.toLowerCase().includes(q);
      const matchesScope = !scope || (scope === "active" ? w.document_count > 0 : w.document_count === 0);
      return matchesSearch && matchesScope;
    });
  }, [search, scope, workspaces]);

  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [search, scope]);

  const allVisibleSelected = visible.length > 0 && visible.every(w => selectedIds.has(w.id));
  const someVisibleSelected = visible.some(w => selectedIds.has(w.id));
  const selected = workspaces.filter(w => selectedIds.has(w.id));

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((cur) => { const next = new Set(cur); if (checked) next.add(id); else next.delete(id); return next; });
  }
  function toggleAllVisible(checked: boolean) {
    setSelectedIds((cur) => { const next = new Set(cur); visible.forEach(w => { if (checked) next.add(w.id); else next.delete(w.id); }); return next; });
  }
  function exportSelected() {
    exportToCsv("workspaces.csv", selected.map(w => ({
      name: w.name, owner: w.owner_email, documents: w.document_count, members: w.member_count, created_at: w.created_at,
    })));
  }

  if (isLoading) return <AdminAccessMessage title="Workspaces" label="Checking admin access." />;
  if (!isAdmin) return <AdminAccessMessage title="Workspaces" label="Admin access required." />;

  return (
    <AdminShell title="Workspaces" description="Inspect tenant workspaces, ownership, and activity.">
      <div className="grid gap-5">
        <ErrorBanner message={error} onRetry={() => void load()} />

        <MetricStrip metrics={metrics} />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBox value={search} onChange={setSearch} placeholder="Search workspace or owner…" />
          <FilterPills ariaLabel="Filter by activity" value={scope} onChange={setScope}
            options={[
              { value: "", label: "All" },
              { value: "active", label: "Has documents", count: workspaces.length - emptyCount },
              { value: "empty", label: "Empty", count: emptyCount },
            ]} />
        </div>

        <BulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
          <BulkButton icon="fileText" onClick={exportSelected}>Export CSV</BulkButton>
        </BulkBar>

        <DataSection title="Workspace directory" count={filtered.length} countLabel="workspaces">
          {isFetching ? (
            <div className="p-4"><LoadingSkeleton label="Loading workspaces" rows={4} /></div>
          ) : visible.length === 0 ? (
            <div className="p-4"><EmptyState title="No workspaces found" description="Try changing the search or filter." /></div>
          ) : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col" className="w-10 px-3 py-2.5">
                        <Check ariaLabel="Select all visible workspaces" checked={allVisibleSelected} indeterminate={someVisibleSelected} onChange={toggleAllVisible} />
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Workspace</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Documents</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Members</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Created</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((w) => {
                      const sel = selectedIds.has(w.id);
                      return (
                        <tr key={w.id} className={`group transition hover:bg-hover ${sel ? "bg-brand-subtle/40" : ""}`}>
                          <td className="px-3 py-3"><Check ariaLabel={`Select ${w.name}`} checked={sel} onChange={(c) => toggleOne(w.id, c)} /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-subtle text-brand-fg">
                                <Icon name="grid" size={15} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-fg">{w.name}</p>
                                <p className="truncate text-xs text-fg-subtle">{w.description ?? "No description"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-fg-muted">{w.owner_email}</td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-fg-muted">{formatNumber(w.document_count)}</td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-fg-muted">{formatNumber(w.member_count)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-fg-subtle">{formatDate(w.created_at)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right">
                            <Link href={`/admin/workspaces/${w.id}`}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                              <Icon name="eye" size={13} /> View
                            </Link>
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
