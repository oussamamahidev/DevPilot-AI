"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "@/features/ai-execution-studio/constants";
import type { ExecutionState } from "@/features/ai-execution-studio/types";
import { GROUP_COLOR, GROUP_LABEL, nodeDetail, type ArchNodeDef } from "./architecture";
import type { NodeStatus } from "./useArchitectureFlow";

const STATUS_META: Record<NodeStatus, { label: string; color: string }> = {
  active: { label: "Processing", color: "#fbbf24" },
  done: { label: "Complete", color: "#34d399" },
  pending: { label: "Idle", color: "#5b6178" },
};

function trunc(s: string, n = 64) {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n)}…` : t || "—";
}
function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function liveMetrics(def: ArchNodeDef, r: ExecutionState): { label: string; value: string }[] {
  if (r.runStatus === "idle") return [];
  switch (def.id) {
    case "embedding":
      return [{ label: "Query", value: trunc(r.question) }, ...(r.rewrittenQuery ? [{ label: "Rewritten", value: trunc(r.rewrittenQuery) }] : [])];
    case "qdrant":
      return r.retrieved.length
        ? [{ label: "Candidates", value: `${r.retrieved.length}` }, { label: "Top score", value: Math.max(...r.retrieved.map((c) => c.score)).toFixed(3) }]
        : [];
    case "reranker":
      return r.reranking.length
        ? [{ label: "Reranked", value: `${r.reranking.length}` }, { label: "Cited", value: `${r.reranking.filter((x) => x.used).length}` }]
        : [];
    case "prompt": {
      const n = r.retrieved.length || r.citations.length;
      return n ? [{ label: "Context chunks", value: `${n}` }] : [];
    }
    case "llm":
      return r.answer
        ? [{ label: "Answer", value: `${r.answer.length} chars` }, ...(r.latencyMs != null ? [{ label: "Latency", value: `${(r.latencyMs / 1000).toFixed(2)}s` }] : [])]
        : [];
    case "evaluation":
      return r.evaluation
        ? [
            { label: "Faithfulness", value: pct(r.evaluation.faithfulness) },
            { label: "Relevance", value: pct(r.evaluation.relevance) },
            { label: "Hallucination", value: pct(r.evaluation.hallucination) },
          ]
        : [];
    case "trace":
      return r.messageId ? [{ label: "Message", value: `${r.messageId.slice(0, 8)}…` }, { label: "Agent runs", value: `${r.agentRuns.length}` }] : [];
    default:
      return [];
  }
}

export function NodeInspector({ def, status, exec, onClose }: { def: ArchNodeDef | null; status: NodeStatus; exec: ExecutionState; onClose: () => void }) {
  return (
    <AnimatePresence>
      {def ? (
        <motion.aside
          key={def.id}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="absolute inset-x-3 bottom-3 z-10 max-h-[60%] overflow-y-auto rounded-2xl p-4 sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-3 sm:max-h-none sm:w-[340px]"
          style={{ background: "rgba(10,12,21,0.92)", border: `1px solid ${GROUP_COLOR[def.group]}55`, backdropFilter: "blur(12px)", boxShadow: `0 0 40px -12px ${GROUP_COLOR[def.group]}` }}
          aria-label={`${def.label} details`}
        >
          {(() => {
            const accent = GROUP_COLOR[def.group];
            const detail = nodeDetail(def.id);
            const live = liveMetrics(def, exec);
            const st = STATUS_META[status];
            return (
              <>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}1f`, border: `1px solid ${accent}`, color: accent }}>
                    <Icon name={def.icon} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold" style={{ color: C.text }}>{def.label}</h3>
                    <span className="text-[11px] font-medium" style={{ color: accent }}>{GROUP_LABEL[def.group]}</span>
                  </div>
                  <button type="button" onClick={onClose} aria-label="Close" className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: C.bg2, border: `1px solid ${C.border}`, color: C.muted }}>
                    <Icon name="close" size={14} />
                  </button>
                </div>

                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]" style={{ background: `${st.color}1f`, color: st.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} /> {st.label}
                </div>

                <p className="mt-3 text-xs leading-5" style={{ color: C.muted }}>{detail.description}</p>

                {live.length ? (
                  <div className="mt-4">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>Live · this run</p>
                    <div className="grid gap-1.5">
                      {live.map((m, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: `${accent}12`, border: `1px solid ${accent}33` }}>
                          <span className="text-[11px]" style={{ color: C.muted }}>{m.label}</span>
                          <span className="truncate text-[11px] font-semibold tabular-nums" style={{ color: C.text }}>{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {detail.facts.length ? (
                  <div className="mt-4">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.subtle }}>Configuration</p>
                    <div className="grid gap-1.5">
                      {detail.facts.map((f, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-[11px]" style={{ color: C.subtle }}>{f.label}</span>
                          <span className="truncate text-[11px] font-medium" style={{ color: C.text }}>{f.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {detail.slug ? (
                  <Link
                    href={`/architecture-explorer/${detail.slug}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
                    style={{ background: `${accent}1f`, border: `1px solid ${accent}`, color: accent }}
                  >
                    <Icon name="arrowRight" size={15} /> Explore the full page
                  </Link>
                ) : null}
              </>
            );
          })()}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
