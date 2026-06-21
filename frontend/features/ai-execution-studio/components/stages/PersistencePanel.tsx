"use client";

import { motion } from "framer-motion";
import { Icon, type IconName } from "@/components/ui/Icon";
import { C } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#2dd4bf";

export function PersistencePanel({ exec }: { exec: ExecutionState }) {
  const nodes: { icon: IconName; label: string; value: string }[] = [
    {
      icon: "message",
      label: "Message",
      value: exec.messageId ? `${exec.messageId.slice(0, 8)}…` : "—",
    },
    { icon: "activity", label: "Agent runs", value: `${exec.agentRuns.length} runs` },
    { icon: "layers", label: "Chunks", value: `${exec.retrieved.length} chunks` },
    { icon: "shield", label: "Evaluation", value: exec.evaluation ? "scored" : "—" },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="database" size={16} style={{ color: ACCENT }} />
          <h4
            className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: C.muted }}
          >
            Writing trace to store
          </h4>
        </div>
        {exec.latencyMs != null && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
            style={{ background: C.panel, border: `1px solid ${C.border}`, color: ACCENT }}
          >
            {(exec.latencyMs / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
        {nodes.map((n, i) => (
          <motion.div
            key={n.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.15, duration: 0.35, ease: "easeOut" }}
            className="grid min-w-0 gap-1.5 rounded-xl p-3"
            style={{ background: C.bg2, border: `1px solid ${C.border}` }}
          >
            <Icon name={n.icon} size={16} style={{ color: ACCENT }} />
            <span className="min-w-0 truncate text-[10px] uppercase tracking-wider" style={{ color: C.subtle }}>
              {n.label}
            </span>
            <span className="min-w-0 truncate text-xs font-medium tabular-nums" style={{ color: C.text }}>
              {n.value}
            </span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="relative flex min-w-0 items-center gap-3 rounded-xl p-3"
        style={{ background: C.bg2, border: `1px solid ${ACCENT}3a` }}
      >
        <div className="relative h-[2px] min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: C.border }}>
          <motion.span
            className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
            style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
            animate={{ left: ["0%", "100%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.div
          className="grid shrink-0 place-items-center rounded-lg p-2"
          style={{ background: C.panel, border: `1px solid ${ACCENT}55` }}
          animate={{ boxShadow: [`0 0 0 0 ${ACCENT}00`, `0 0 14px 1px ${ACCENT}66`, `0 0 0 0 ${ACCENT}00`] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon name="database" size={18} style={{ color: ACCENT }} />
        </motion.div>
      </motion.div>
    </div>
  );
}
