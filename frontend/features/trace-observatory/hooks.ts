"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRagTraceQualitySummary, listRagOpsWorkspaces, listRagTraces } from "@/lib/admin";
import type { ObservatoryFilters } from "./helpers";

/** Server pulls a generous sample; cards paginate it client-side and the
 *  charts/alerts summarise it. Exact match counts come from `total`. */
export const SAMPLE_SIZE = 100;

export function buildServerParams(f: ObservatoryFilters) {
  const p: Record<string, string | number | boolean> = { page: 1, page_size: SAMPLE_SIZE };
  if (f.search.trim()) p.search = f.search.trim();
  if (f.workspaceId) p.workspace_id = f.workspaceId;
  if (f.retrievalStrategy) p.retrieval_strategy = f.retrievalStrategy;
  if (f.minFaithfulness != null) p.min_faithfulness = f.minFaithfulness;
  if (f.maxHallucination != null) p.max_hallucination_score = f.maxHallucination;
  if (f.corrected === "yes") p.corrected = true;
  else if (f.corrected === "no") p.corrected = false;
  if (f.hasCitations === "yes") p.has_citations = true;
  else if (f.hasCitations === "no") p.has_citations = false;
  if (f.dateFrom) p.date_from = f.dateFrom;
  if (f.dateTo) p.date_to = f.dateTo;
  return p;
}

export function useTraceObservatory(filters: ObservatoryFilters, enabled: boolean) {
  const queryClient = useQueryClient();
  const params = buildServerParams(filters);

  const traces = useQuery({
    queryKey: ["observatory-traces", params],
    queryFn: () => listRagTraces(params),
    enabled,
    staleTime: 30_000,
  });

  // Global, filter-independent platform summary (drives the unfiltered KPI strip).
  const summary = useQuery({
    queryKey: ["observatory-summary"],
    queryFn: () => getRagTraceQualitySummary(),
    enabled,
    staleTime: 60_000,
  });

  // Workspace options for the filter bar.
  const workspaces = useQuery({
    queryKey: ["observatory-workspaces"],
    queryFn: () => listRagOpsWorkspaces(),
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    items: traces.data?.items ?? [],
    total: traces.data?.total ?? 0,
    summary: summary.data,
    workspaces: workspaces.data ?? [],
    isLoading: traces.isLoading,
    isError: traces.isError,
    error: traces.error instanceof Error ? traces.error.message : traces.isError ? "Failed to load traces." : null,
    isFetching: traces.isFetching || summary.isFetching,
    refetch: () =>
      queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("observatory"),
      }),
  };
}
