"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRagTrace,
  getRagTraceEvaluation,
  getRagTraceReranking,
  getRagTraceRetrieval,
} from "@/lib/admin";

const STALE = 30_000;

/**
 * Loads a full trace via 4 parallel React Query calls. The primary `trace`
 * query drives loading/error; the retrieval/reranking/evaluation queries are
 * secondary — if one fails, the page still renders with the rest.
 */
export function useTraceInspector(messageId: string, includeContent: boolean, enabled: boolean) {
  const queryClient = useQueryClient();
  const on = enabled && Boolean(messageId);

  const trace = useQuery({
    queryKey: ["trace", messageId, includeContent],
    queryFn: () => getRagTrace(messageId, includeContent),
    enabled: on,
    staleTime: STALE,
  });
  const retrieval = useQuery({
    queryKey: ["trace-retrieval", messageId, includeContent],
    queryFn: () => getRagTraceRetrieval(messageId, includeContent),
    enabled: on,
    staleTime: STALE,
  });
  const reranking = useQuery({
    queryKey: ["trace-reranking", messageId, includeContent],
    queryFn: () => getRagTraceReranking(messageId, includeContent),
    enabled: on,
    staleTime: STALE,
  });
  const evaluation = useQuery({
    queryKey: ["trace-evaluation", messageId],
    queryFn: () => getRagTraceEvaluation(messageId),
    enabled: on,
    staleTime: STALE,
  });

  const all = [trace, retrieval, reranking, evaluation];

  return {
    trace: trace.data,
    retrieval: retrieval.data,
    reranking: reranking.data,
    evaluation: evaluation.data,
    isLoading: trace.isLoading,
    isError: trace.isError,
    error: trace.error instanceof Error ? trace.error.message : null,
    isFetching: all.some((q) => q.isFetching),
    refetch: () =>
      queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("trace"),
      }),
  };
}

export type TraceInspectorData = ReturnType<typeof useTraceInspector>;
