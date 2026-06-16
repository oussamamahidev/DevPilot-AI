"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "../../constants";
import { Gauge } from "../Gauge";
import type { ExecutionState } from "../../types";

export function EvaluationPanel({ exec }: { exec: ExecutionState }) {
  const ev = exec.evaluation;

  if (!ev) {
    return (
      <div className="grid min-w-0 gap-4">
        <div className="grid place-items-center gap-2 py-10 text-center">
          <Icon name="shield" size={24} style={{ color: C.subtle }} />
          <span className="text-xs" style={{ color: C.subtle }}>
            Awaiting evaluation&hellip;
          </span>
        </div>
      </div>
    );
  }

  const riskHigh = ev.hallucination > 0.6;

  return (
    <div className="grid min-w-0 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <div className="min-w-0">
          <Gauge label="Faithfulness" value={ev.faithfulness} accent="#34d399" />
        </div>
        <div className="min-w-0">
          <Gauge label="Relevance" value={ev.relevance} accent="#38bdf8" />
        </div>
        <div className="min-w-0">
          <Gauge label="Context precision" value={ev.contextPrecision} accent="#a78bfa" />
        </div>
        <div className="min-w-0">
          <Gauge label="Grounding" value={1 - ev.hallucination} accent="#fbbf24" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        className="min-w-0 rounded-xl p-4"
        style={{ background: C.bg2, border: `1px solid ${C.border}` }}
      >
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <Icon name="shield" size={13} style={{ color: C.muted }} />
          <h4 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
            Verdict
          </h4>
        </div>
        <p className="min-w-0 break-words text-xs leading-relaxed" style={{ color: C.muted }}>
          {ev.explanation || "—"}
        </p>
      </motion.div>

      <p
        className="text-xs font-medium tabular-nums"
        style={{ color: riskHigh ? "#f87171" : C.muted }}
      >
        Hallucination risk: {Math.round(ev.hallucination * 100)}%
      </p>
    </div>
  );
}
