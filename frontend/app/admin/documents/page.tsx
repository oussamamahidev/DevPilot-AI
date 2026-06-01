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
  MiniBar,
  Pager,
  SearchBox,
  type Metric,
} from "@/components/admin/DataView";
import { Button, EmptyState, LoadingSkeleton, StatusBadge } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { deleteAdminDocument, listAdminDocuments } from "@/lib/admin";
import type { AdminDocumentSummary } from "@/types";

const PAGE_SIZE = 10;

type Pending = { kind: "single"; doc: AdminDocumentSummary } | { kind: "bulk"; docs: AdminDocumentSummary[] } | null;

function fileIcon(filename: string, type: string): IconName {
  const t = `${filename} ${type}`.toLowerCase();
  if (t.includes(".pdf") || t.includes("pdf")) return "filePdf";
  return "fileText";
}

function coverage(d: AdminDocumentSummary) {
  return d.chunks_count > 0 ? (d.chunks_with_vector_id / d.chunks_count) * 100 : 0;
}

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
  const [pending, setPending] = useState<Pending>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setIsFetching(true);
    setError(null);
    try {
      const response = await listAdminDocuments({ page: 1, page_size: 100 });
      setDocuments(response.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load documents.");
    } finally {
      setIsFetching(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  /* ── metrics ── */
  const metrics: Metric[] = useMemo(() => {
    const active = documents.filter(d => d.status !== "deleted");
    const total = active.length;
    const indexed = active.filter(d => d.status === "indexed").length;
    const processing = active.filter(d => ["uploaded", "queued", "processing"].includes(d.status)).length;
    const failed = active.filter(d => d.status === "failed").length;
    const totalChunks = active.reduce((s, d) => s + d.chunks_count, 0);
    const withVec = active.reduce((s, d) => s + d.chunks_with_vector_id, 0);
    const cov = totalChunks > 0 ? Math.round((withVec / totalChunks) * 100) : 0;
    return [
      { label: "Indexed", value: formatNumber(indexed), icon: "checkCircle", tone: "success", hint: total ? `${Math.round((indexed / total) * 100)}% of ${total}` : undefined },
      { label: "Processing", value: formatNumber(processing), icon: "refreshCw", tone: processing > 0 ? "info" : "neutral" },
      { label: "Failed", value: formatNumber(failed), icon: "alertCircle", tone: failed > 0 ? "danger" : "neutral" },
      { label: "Vector coverage", value: `${cov}%`, icon: "sparkles", tone: cov >= 85 ? "success" : cov >= 60 ? "warning" : "danger" },
    ];
  }, [documents]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    documents.forEach(d => { c[d.status] = (c[d.status] ?? 0) + 1; });
    return c;
  }, [documents]);

  /* ── filtering ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      const matchesSearch = !q || d.filename.toLowerCase().includes(q) || d.workspace_name.toLowerCase().includes(q) || (d.uploader_email ?? "").toLowerCase().includes(q);
      return matchesSearch && (!status || d.status === status);
    });
  }, [documents, search, status]);

  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [search, status]);

  /* ── selection ── */
  const selectableVisible = visible.filter(d => d.status !== "deleted");
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(d => selectedIds.has(d.id));
  const someVisibleSelected = selectableVisible.some(d => selectedIds.has(d.id));
  const selectedDocs = documents.filter(d => selectedIds.has(d.id) && d.status !== "deleted");

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((cur) => { const next = new Set(cur); if (checked) next.add(id); else next.delete(id); return next; });
  }
  function toggleAllVisible(checked: boolean) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      selectableVisible.forEach(d => { if (checked) next.add(d.id); else next.delete(d.id); });
      return next;
    });
  }

  function applyDeleted(updated: AdminDocumentSummary) {
    setDocuments((cur) => cur.map((d) => d.id === updated.id ? { ...d, processed_at: updated.processed_at, status: updated.status } : d));
  }

  async function submit(reason: string) {
    if (!pending) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      if (pending.kind === "bulk") {
        const results = await Promise.allSettled(pending.docs.map(d => deleteAdminDocument(d.id, reason)));
        let failures = 0;
        results.forEach(r => { if (r.status === "fulfilled") applyDeleted(r.value); else failures += 1; });
        if (failures > 0) setModalError(`${failures} of ${results.length} deletions failed.`);
        else { setPending(null); setSelectedIds(new Set()); }
      } else {
        applyDeleted(await deleteAdminDocument(pending.doc.id, reason));
        setPending(null);
      }
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function exportSelected() {
    exportToCsv("documents.csv", selectedDocs.map(d => ({
      filename: d.filename, status: d.status, type: d.file_type, workspace: d.workspace_name,
      uploader: d.uploader_email ?? "", chunks: d.chunks_count, coverage_pct: Math.round(coverage(d)), created_at: d.created_at,
    })));
  }

  if (isLoading) return <AdminAccessMessage title="Documents" label="Checking admin access." />;
  if (!isAdmin) return <AdminAccessMessage title="Documents" label="Admin access required." />;

  return (
    <AdminShell title="Documents" description="Inspect uploaded documents and indexing state.">
      <div className="grid gap-5">
        <ErrorBanner message={error} onRetry={() => void load()} />

        <MetricStrip metrics={metrics} />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBox value={search} onChange={setSearch} placeholder="Search filename, workspace, uploader…" />
          <FilterPills ariaLabel="Filter by status" value={status} onChange={setStatus}
            options={[
              { value: "", label: "All" },
              { value: "indexed", label: "Indexed", count: statusCounts.indexed },
              { value: "processing", label: "Processing", count: statusCounts.processing },
              { value: "queued", label: "Queued", count: statusCounts.queued },
              { value: "failed", label: "Failed", count: statusCounts.failed },
              { value: "deleted", label: "Deleted", count: statusCounts.deleted },
            ]} />
        </div>

        <BulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
          <BulkButton icon="fileText" onClick={exportSelected}>Export CSV</BulkButton>
          {selectedDocs.length > 0 ? (
            <BulkButton icon="trash" tone="danger" onClick={() => setPending({ kind: "bulk", docs: selectedDocs })}>
              Delete ({selectedDocs.length})
            </BulkButton>
          ) : null}
        </BulkBar>

        <DataSection title="Document directory" count={filtered.length} countLabel="documents">
          {isFetching ? (
            <div className="p-4"><LoadingSkeleton label="Loading documents" rows={4} /></div>
          ) : visible.length === 0 ? (
            <div className="p-4"><EmptyState title="No documents found" description="Try changing the search or status filter." /></div>
          ) : (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col" className="w-10 px-3 py-2.5">
                        <Check ariaLabel="Select all visible documents" checked={allVisibleSelected} indeterminate={someVisibleSelected}
                          disabled={selectableVisible.length === 0} onChange={toggleAllVisible} />
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Document</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Workspace</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Chunks</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Coverage</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((d) => {
                      const cov = coverage(d);
                      const selected = selectedIds.has(d.id);
                      const canSelect = d.status !== "deleted";
                      return (
                        <tr key={d.id} className={`group transition hover:bg-hover ${selected ? "bg-brand-subtle/40" : ""}`}>
                          <td className="px-3 py-3">
                            <Check ariaLabel={`Select ${d.filename}`} checked={selected} disabled={!canSelect} onChange={(c) => toggleOne(d.id, c)} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sunken text-fg-subtle">
                                <Icon name={fileIcon(d.filename, d.file_type)} size={16} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-fg">{d.filename}</p>
                                <p className="truncate text-xs text-fg-subtle">
                                  {formatBytes(d.file_size)} · {d.file_type || "file"} · {formatDate(d.created_at)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3"><StatusBadge status={d.status} /></td>
                          <td className="whitespace-nowrap px-3 py-3 text-fg-muted">{d.workspace_name}</td>
                          <td className="whitespace-nowrap px-3 py-3 tabular-nums text-fg-muted">{formatNumber(d.chunks_count)}</td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <div className="flex items-center gap-2">
                              <MiniBar value={cov} tone={cov >= 85 ? "success" : cov >= 60 ? "warning" : "danger"} />
                              <span className="tabular-nums text-xs text-fg-subtle">{cov.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                              <Link href={`/admin/documents/${d.id}`}
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg">
                                <Icon name="eye" size={13} /> View
                              </Link>
                              <Link href={`/admin/ragops/documents/${d.id}`}
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg">
                                <Icon name="activity" size={13} /> Pipeline
                              </Link>
                              {d.status !== "deleted" ? (
                                <Button type="button" size="sm" variant="danger" onClick={() => setPending({ kind: "single", doc: d })}>Delete</Button>
                              ) : null}
                            </div>
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

      <ConfirmReasonModal
        isOpen={Boolean(pending)}
        actionLabel={pending?.kind === "bulk" ? `Delete ${pending.docs.length} documents` : `Delete ${pending?.kind === "single" ? pending.doc.filename : "document"}`}
        confirmLabel="Delete"
        error={modalError}
        isSubmitting={isSubmitting}
        requireConfirmText
        onClose={() => { setPending(null); setModalError(null); }}
        onConfirm={submit}
      />
    </AdminShell>
  );
}
