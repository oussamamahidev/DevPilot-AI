"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminStats,
  getRagOpsQdrantHealth,
  getRagTraceQualitySummary,
  listAdminErrors,
  listRagOpsWorkspaces,
} from "@/lib/admin";
import { computeOverview, deriveInsights } from "./metrics";

const STALE = 30_000;
const REFRESH = 60_000;

export function useControlTower(enabled: boolean) {
  const queryClient = useQueryClient();

  const workspaces = useQuery({
    queryKey: ["ragops", "workspaces"],
    queryFn: listRagOpsWorkspaces,
    enabled,
    staleTime: STALE,
    refetchInterval: REFRESH,
  });
  const qdrant = useQuery({
    queryKey: ["ragops", "qdrant"],
    queryFn: getRagOpsQdrantHealth,
    enabled,
    staleTime: STALE,
    refetchInterval: REFRESH,
  });
  const stats = useQuery({
    queryKey: ["ragops", "stats"],
    queryFn: getAdminStats,
    enabled,
    staleTime: STALE,
    refetchInterval: REFRESH,
  });
  const quality = useQuery({
    queryKey: ["ragops", "quality"],
    queryFn: getRagTraceQualitySummary,
    enabled,
    staleTime: STALE,
    refetchInterval: REFRESH,
  });
  const errors = useQuery({
    queryKey: ["ragops", "errors"],
    queryFn: listAdminErrors,
    enabled,
    staleTime: STALE,
    refetchInterval: REFRESH,
  });

  const list = [workspaces, qdrant, stats, quality, errors];

  const overview = useMemo(
    () => computeOverview(workspaces.data ?? [], stats.data, quality.data),
    [workspaces.data, stats.data, quality.data],
  );
  const insights = useMemo(
    () => deriveInsights(overview, qdrant.data, quality.data),
    [overview, qdrant.data, quality.data],
  );

  const firstError = list.find((query) => query.isError)?.error;

  return {
    workspaces: workspaces.data ?? [],
    qdrant: qdrant.data,
    stats: stats.data,
    quality: quality.data,
    errors: errors.data?.errors ?? [],
    overview,
    insights,
    isLoading: workspaces.isLoading || stats.isLoading || quality.isLoading,
    isError: list.some((query) => query.isError),
    error: firstError instanceof Error ? firstError.message : null,
    isFetching: list.some((query) => query.isFetching),
    refetch: () => queryClient.invalidateQueries({ queryKey: ["ragops"] }),
  };
}

export type ControlTowerData = ReturnType<typeof useControlTower>;
