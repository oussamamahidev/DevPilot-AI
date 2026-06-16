"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useAuthUser } from "@/hooks/useAuthUser";
import { C } from "@/features/ai-execution-studio/constants";
import { Composer } from "@/features/ai-execution-studio/components/Composer";
import { useExecutionRun } from "@/features/ai-execution-studio/useExecutionRun";
import { GROUP_COLOR, GROUP_LABEL, archNode, type ArchGroup } from "@/features/architecture-explorer/architecture";
import { NodeInspector } from "@/features/architecture-explorer/NodeInspector";
import { useArchitectureFlow } from "@/features/architecture-explorer/useArchitectureFlow";

function MapLoader() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3" style={{ color: C.muted }}>
      <Icon name="loader" size={24} className="motion-safe:animate-spin" style={{ color: "#a855f7" }} />
      <span className="text-sm">Rendering the architecture…</span>
    </div>
  );
}

const FlowMap = dynamic(() => import("@/features/architecture-explorer/FlowMap").then((m) => m.FlowMap), {
  ssr: false,
  loading: () => <MapLoader />,
});

const GROUPS: ArchGroup[] = ["client", "gateway", "security", "data", "orchestration", "ai", "observability"];

export default function ArchitectureExplorerPage() {
  const { user, isLoading } = useAuthUser();
  const { exec, run, stop } = useExecutionRun();
  const running = exec.runStatus === "running";
  const { nodeStatus } = useArchitectureFlow(exec);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedDef = selectedId ? archNode(selectedId) ?? null : null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: C.bg, color: C.text }}>
      <header
        className="flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6"
        style={{ background: `${C.bg}cc`, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}
      >
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm" style={{ color: C.muted }}>
          <Icon name="arrowLeft" size={16} /> DevPilot
        </Link>
        <span style={{ color: C.border }}>/</span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "#6a35f01f", border: "1px solid #6a35f0", color: "#a855f7" }}>
            <Icon name="workflow" size={15} />
          </span>
          <h1 className="truncate text-sm font-semibold">Architecture Explorer</h1>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] sm:inline-flex" style={{ color: C.subtle }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: running ? "#34d399" : C.subtle }} />
          {running ? `live · ${exec.activeStage ?? ""}` : exec.runStatus === "complete" ? "trace complete" : "click any node to explore"}
        </span>
      </header>

      {isLoading ? (
        <MapLoader />
      ) : !user ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ color: C.muted }}>
          <Icon name="lock" size={22} style={{ color: C.subtle }} />
          <p className="text-sm">
            Please{" "}
            <Link href="/login" className="underline" style={{ color: "#a855f7" }}>
              sign in
            </Link>{" "}
            to explore the architecture.
          </p>
        </div>
      ) : (
        <>
          <div className="shrink-0 px-3 pt-3 sm:px-4">
            <Composer running={running} onRun={run} onStop={stop} />
          </div>

          <div className="relative mt-3 min-h-0 flex-1">
            <div className="absolute inset-0">
              <FlowMap exec={exec} selectedId={selectedId} onSelect={setSelectedId} />
            </div>

            <NodeInspector
              def={selectedDef}
              status={selectedId ? nodeStatus[selectedId] ?? "pending" : "pending"}
              exec={exec}
              onClose={() => setSelectedId(null)}
            />

            {/* legend */}
            <div
              className="pointer-events-none absolute bottom-3 left-3 hidden rounded-xl p-3 sm:block"
              style={{ background: "rgba(13,15,26,0.82)", border: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.subtle }}>
                Layers
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {GROUPS.map((g) => (
                  <span key={g} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[g] }} />
                    {GROUP_LABEL[g]}
                  </span>
                ))}
              </div>
            </div>

            {/* hint */}
            <div
              className="pointer-events-none absolute right-3 top-3 rounded-lg px-3 py-1.5 text-[11px]"
              style={{ background: "rgba(13,15,26,0.82)", border: `1px solid ${C.border}`, color: C.muted, backdropFilter: "blur(8px)" }}
            >
              {running ? "Watch the request travel ↓" : "Run a question, or click a glowing node →"}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
