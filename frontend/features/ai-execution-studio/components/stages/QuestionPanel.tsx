"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#38bdf8";

export function QuestionPanel({ exec }: { exec: ExecutionState }) {
  const hasRewrite =
    !!exec.rewrittenQuery && exec.rewrittenQuery.trim() !== exec.question.trim();

  return (
    <div className="grid min-w-0 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="min-w-0 rounded-2xl p-5"
        style={{
          background: C.bg2,
          border: `1px solid ${C.borderHi}`,
          boxShadow: `0 0 0 1px ${ACCENT}14, 0 18px 40px -28px ${ACCENT}66`,
        }}
      >
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <Icon name="message" size={16} style={{ color: ACCENT }} />
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: C.muted }}
          >
            Incoming question
          </span>
        </div>
        <p
          className="min-w-0 break-words text-lg font-medium leading-snug sm:text-xl"
          style={{ color: C.text }}
        >
          {exec.question || "—"}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
        {exec.workspaceName ? (
          <span
            className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs"
            style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.muted }}
          >
            <Icon name="box" size={13} style={{ color: ACCENT }} />
            <span className="truncate">{exec.workspaceName}</span>
          </span>
        ) : null}
      </motion.div>

      <AnimatePresence>
        {hasRewrite ? (
          <motion.div
            key="rewrite"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: 0.3, duration: 0.35 }}
            className="min-w-0 rounded-xl p-4"
            style={{ background: C.bg2, border: `1px solid ${C.border}` }}
          >
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <Icon name="refreshCw" size={13} style={{ color: ACCENT }} />
              <h4
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: C.muted }}
              >
                Rewritten for retrieval
              </h4>
            </div>
            <p
              className="min-w-0 break-words text-sm leading-relaxed"
              style={{ color: C.text }}
            >
              {exec.rewrittenQuery}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
