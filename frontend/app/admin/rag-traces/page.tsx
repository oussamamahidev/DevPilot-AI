"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAccessMessage, AdminShell, ErrorBanner } from "@/components/admin/AdminUI";
import { MetricStrip, Pager, DataSection, exportToCsv, BulkButton } from "@/components/admin/DataView";
import { EmptyState, LoadingSkeleton } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useTraceObservatory } from "@/features/trace-observatory/hooks";
import {
  EMPTY_FILTERS,
  type ObservatoryFilters,
  activeFilterCount,
  applyClientFilters,
  buildKpis,
  distinctStrategies,
  distinctUsers,
} from "@/features/trace-observatory/helpers";
import { ObservatoryFilterBar } from "@/features/trace-observatory/components/ObservatoryFilterBar";
import { Distributions } from "@/features/trace-observatory/components/Distributions";
import { TraceCard } from "@/features/trace-observatory/components/TraceCard";
import { AlertsRail } from "@/features/trace-observatory/components/AlertsRail";

const PAGE_SIZE = 12;

export default function RagTraceObservatoryPage() {
  const { isAdmin, isLoading: accessLoading } = useAdminAccess();
  const [filters, setFilters] = useState<ObservatoryFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);

  const obs = useTraceObservatory(filters, isAdmin);

  // Client-side narrowing the API can't express (user email, faithfulness upper
  // bound, hallucination lower bound) — applied to the loaded sample.
  const filteredItems = useMemo(() => applyClientFilters(obs.items, filters), [obs.items, filters]);

  const activeCount = activeFilterCount(filters);
  const hasFilters = activeCount > 0;
  const clientNarrowed = !!filters.userEmail || filters.maxFaithfulness != null || filters.minHallucination != null;
  const totalForKpi = clientNarrowed ? filteredItems.length : obs.total;

  const kpis = useMemo(
    () => buildKpis(filteredItems, totalForKpi, obs.summary, hasFilters),
    [filteredItems, totalForKpi, obs.summary, hasFilters],
  );

  const strategies = useMemo(() => distinctStrategies(obs.items), [obs.items]);
  const users = useMemo(() => distinctUsers(obs.items), [obs.items]);

  // reset pagination whenever the result set changes
  useEffect(() => {
    setPage(0);
  }, [filters]);

  const visible = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function patch(p: Partial<ObservatoryFilters>) {
    setFilters((f) => ({ ...f, ...p }));
  }
  function reset() {
    setFilters(EMPTY_FILTERS);
  }
  function exportCsv() {
    exportToCsv(
      "rag-traces.csv",
      filteredItems.map((t) => ({
        message_id: t.message_id,
        workspace: t.workspace_name,
        user: t.user_email ?? "",
        question: t.question_preview,
        retrieval_strategy: t.retrieval_strategy ?? "",
        faithfulness: t.faithfulness,
        relevance: t.relevance,
        hallucination: t.hallucination_score,
        latency_ms: t.total_latency_ms,
        citations: t.citation_count,
        corrected: t.corrected,
        created_at: t.created_at,
      })),
    );
  }

  if (accessLoading) return <AdminAccessMessage title="RAG Trace Observatory" label="Checking admin access." />;
  if (!isAdmin) return <AdminAccessMessage title="RAG Trace Observatory" label="Admin access required." />;

  const sampleTruncated = obs.total > obs.items.length;
  // Distributions/alerts only carry signal with a few traces; below that they
  // render as empty charts and "Nothing flagged" panels (the "empty on scroll"
  // dead zone). Show the trace list alone when the sample is too small.
  const showAnalytics = filteredItems.length >= 4;

  return (
    <AdminShell
      title="RAG Trace Observatory"
      description="Inspect every RAG query: success, failures, corrections, hallucination risk and retrieval quality."
    >
      <div className="grid gap-5">
        <ErrorBanner message={obs.error} onRetry={() => obs.refetch()} />

        {/* KPI strip */}
        <MetricStrip metrics={kpis} />

        {/* Filter bar */}
        <ObservatoryFilterBar
          filters={filters}
          onChange={patch}
          onReset={reset}
          workspaces={obs.workspaces}
          strategies={strategies}
          users={users}
          activeCount={activeCount}
        />

        {obs.isLoading ? (
          <div className="rounded-xl border border-line bg-surface p-4">
            <LoadingSkeleton label="Loading traces" rows={6} />
          </div>
        ) : obs.items.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-6">
            <EmptyState
              title="No traces yet"
              description="Once users ask questions in a workspace, their RAG traces will appear here for inspection."
            />
          </div>
        ) : (
          <>
            {showAnalytics ? (
              <>
                {/* Distributions */}
                <Distributions items={filteredItems} />

                {/* Alerts — full-width "needs investigation" band */}
                <section className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <Icon name="alertCircle" size={15} className="text-fg-muted" />
                    <h2 className="text-sm font-semibold text-fg">Needs investigation</h2>
                  </div>
                  <AlertsRail items={filteredItems} />
                </section>
              </>
            ) : null}

            {/* Trace list */}
            <div className="min-w-0">
              <DataSection
                title="Traces"
                count={filteredItems.length}
                countLabel="matching"
                actions={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => obs.refetch()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <Icon name="refreshCw" size={14} className={obs.isFetching ? "animate-spin" : ""} />
                      Refresh
                    </button>
                    <BulkButton icon="fileText" onClick={exportCsv}>
                      Export CSV
                    </BulkButton>
                  </div>
                }
              >
                {sampleTruncated ? (
                  <p className="border-b border-line bg-sunken px-4 py-2 text-xs text-fg-subtle">
                    Showing the {obs.items.length} most recent of {obs.total.toLocaleString()} matching traces. Narrow
                    with filters to focus the view.
                  </p>
                ) : null}

                {visible.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title="No traces match these filters"
                      description="Try widening the score ranges, clearing the workspace/user filter, or resetting."
                    />
                  </div>
                ) : (
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    {visible.map((trace) => (
                      <TraceCard key={trace.message_id} trace={trace} />
                    ))}
                  </div>
                )}

                <Pager page={page} pageSize={PAGE_SIZE} total={filteredItems.length} onPage={setPage} />
              </DataSection>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
