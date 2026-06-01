"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pager } from "@/components/admin/DataView";
import type { RagOpsWorkspaceSummary } from "@/types";
import { fmtNumber, scoreTone, type Tone } from "@/features/ragops/components/primitives";

const PAGE_SIZE = 6;

const barClass: Record<Tone, string> = {
  ai: "bg-brand",
  critical: "bg-danger",
  info: "bg-info",
  neutral: "bg-line-strong",
  success: "bg-success",
  warning: "bg-warning",
};

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger";
}) {
  const color = tone === "danger" ? "text-danger-fg" : tone === "warning" ? "text-warning-fg" : "text-fg";
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className={`truncate text-sm font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

export function WorkspaceHealthCenter({ workspaces }: { workspaces: RagOpsWorkspaceSummary[] }) {
  const [page, setPage] = useState(0);

  // Keep the page in range as the workspace set changes (filters, refresh).
  useEffect(() => {
    setPage(0);
  }, [workspaces.length]);

  if (workspaces.length === 0) {
    return (
      <EmptyState
        title="No workspaces tracked"
        description="Workspaces appear here once documents are ingested and indexed."
      />
    );
  }

  const sorted = [...workspaces].sort((a, b) => a.rag_health_score - b.rag_health_score);
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((workspace) => {
          const tone = scoreTone(workspace.rag_health_score);
          const coverage = workspace.embedding_coverage_percent;
          return (
            <div
              key={workspace.workspace_id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-semibold text-fg">{workspace.workspace_name}</p>
                <StatusBadge status={workspace.rag_health_status} />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-fg-subtle">Health</span>
                  <span className="font-semibold tabular-nums text-fg">
                    {Math.round(workspace.rag_health_score)}/100
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sunken">
                  <div
                    className={`h-full rounded-full ${barClass[tone]}`}
                    style={{ width: `${Math.max(0, Math.min(100, workspace.rag_health_score))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Metric label="Coverage" value={`${coverage.toFixed(0)}%`} tone={coverage >= 85 ? "default" : "warning"} />
                <Metric
                  label="Docs"
                  value={`${fmtNumber(workspace.documents_indexed)}/${fmtNumber(workspace.documents_total)}`}
                />
                <Metric label="Chunks" value={fmtNumber(workspace.total_chunks)} />
                <Metric
                  label="Faithfulness"
                  value={workspace.average_faithfulness.toFixed(2)}
                  tone={workspace.average_faithfulness >= 0.5 ? "default" : "danger"}
                />
                <Metric
                  label="Hallucination"
                  value={workspace.average_hallucination_score.toFixed(2)}
                  tone={workspace.average_hallucination_score > 0.6 ? "danger" : "default"}
                />
                <Metric
                  label="Failed"
                  value={fmtNumber(workspace.documents_failed)}
                  tone={workspace.documents_failed > 0 ? "danger" : "default"}
                />
              </div>

              <Link
                href={`/admin/ragops/workspaces/${workspace.workspace_id}`}
                className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-line bg-surface text-sm font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Open workspace
              </Link>
            </div>
          );
        })}
      </div>

      {sorted.length > PAGE_SIZE ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <Pager page={page} pageSize={PAGE_SIZE} total={sorted.length} onPage={setPage} />
        </div>
      ) : null}
    </div>
  );
}
