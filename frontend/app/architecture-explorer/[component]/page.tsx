"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useAuthUser } from "@/hooks/useAuthUser";
import { C } from "@/features/ai-execution-studio/constants";
import { Composer } from "@/features/ai-execution-studio/components/Composer";
import { useExecutionRun } from "@/features/ai-execution-studio/useExecutionRun";
import type { ExecutionState } from "@/features/ai-execution-studio/types";
import { EmbeddingPanel } from "@/features/ai-execution-studio/components/stages/EmbeddingPanel";
import { SearchPanel } from "@/features/ai-execution-studio/components/stages/SearchPanel";
import { RerankPanel } from "@/features/ai-execution-studio/components/stages/RerankPanel";
import { PromptPanel } from "@/features/ai-execution-studio/components/stages/PromptPanel";
import { GenerationPanel } from "@/features/ai-execution-studio/components/stages/GenerationPanel";
import { EvaluationPanel } from "@/features/ai-execution-studio/components/stages/EvaluationPanel";
import { PersistencePanel } from "@/features/ai-execution-studio/components/stages/PersistencePanel";
import { COMPONENTS, GROUP_COLOR, GROUP_LABEL, componentBySlug } from "@/features/architecture-explorer/architecture";

const PANELS: Record<string, ComponentType<{ exec: ExecutionState }>> = {
  embedding: EmbeddingPanel,
  qdrant: SearchPanel,
  reranking: RerankPanel,
  prompt: PromptPanel,
  llm: GenerationPanel,
  evaluation: EvaluationPanel,
  trace: PersistencePanel,
};

export default function ComponentExplorerPage() {
  const params = useParams<{ component: string }>();
  const slug = params.component;
  const config = componentBySlug(slug);
  const { user, isLoading } = useAuthUser();
  const { exec, run, stop } = useExecutionRun();
  const running = exec.runStatus === "running";

  const accent = config ? GROUP_COLOR[config.group] : "#a855f7";
  const Panel = config?.panel ? PANELS[config.panel] : undefined;
  const idx = config ? COMPONENTS.findIndex((c) => c.slug === config.slug) : -1;
  const next = idx >= 0 ? COMPONENTS[(idx + 1) % COMPONENTS.length] : undefined;

  return (
    <div className="min-h-[100dvh] overflow-x-hidden" style={{ background: C.bg, color: C.text }}>
      <header
        className="sticky top-0 z-20 flex h-14 items-center gap-3 px-4 sm:px-6"
        style={{ background: `${C.bg}cc`, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(8px)" }}
      >
        <Link href="/architecture-explorer" className="inline-flex items-center gap-2 text-sm" style={{ color: C.muted }}>
          <Icon name="arrowLeft" size={16} /> Architecture
        </Link>
        <span style={{ color: C.border }}>/</span>
        <h1 className="truncate text-sm font-semibold">{config?.title ?? "Component"}</h1>
        {next ? (
          <Link href={`/architecture-explorer/${next.slug}`} className="ml-auto inline-flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
            Next: {next.title} <Icon name="arrowRight" size={14} />
          </Link>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
        {!config ? (
          <div className="grid place-items-center gap-3 py-28 text-center" style={{ color: C.muted }}>
            <Icon name="alertCircle" size={22} style={{ color: C.subtle }} />
            <p className="text-sm">
              Unknown component.{" "}
              <Link href="/architecture-explorer" className="underline" style={{ color: "#a855f7" }}>
                Back to the map
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {/* hero */}
            <div
              className="rounded-2xl p-5"
              style={{ background: `linear-gradient(120deg, ${C.panel}, ${accent}12)`, border: `1px solid ${C.border}` }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${accent}1f`, color: accent }}>
                {GROUP_LABEL[config.group]}
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{config.title}</h2>
              <p className="mt-1.5 max-w-2xl text-sm" style={{ color: C.muted }}>
                {config.tagline}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {config.facts.map((f, i) => (
                  <span key={i} className="rounded-lg px-2.5 py-1.5 text-xs" style={{ background: C.bg2, border: `1px solid ${C.border}`, color: C.text }}>
                    <span style={{ color: C.subtle }}>{f.label}: </span>
                    <span className="font-medium">{f.value}</span>
                  </span>
                ))}
              </div>
            </div>

            {isLoading ? null : !user ? (
              <p className="text-sm" style={{ color: C.muted }}>
                Please{" "}
                <Link href="/login" className="underline" style={{ color: "#a855f7" }}>
                  sign in
                </Link>{" "}
                to run a live query.
              </p>
            ) : Panel ? (
              <>
                <Composer running={running} onRun={run} onStop={stop} />
                <div className="rounded-2xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                  <p className="mb-4 text-xs" style={{ color: C.subtle }}>
                    Run a question to watch this component process it with real data.
                  </p>
                  <Panel exec={exec} />
                </div>
              </>
            ) : (
              <Link
                href="/admin/ragops"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ background: `${accent}1f`, border: `1px solid ${accent}`, color: accent }}
              >
                <Icon name="activity" size={16} /> Open the RAGOps control tower
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
