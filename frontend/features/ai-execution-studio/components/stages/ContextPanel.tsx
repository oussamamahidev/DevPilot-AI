"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#f472b6";

export function ContextPanel({ exec }: { exec: ExecutionState }) {
  const blocks = exec.retrieved.length
    ? exec.retrieved.map((r) => ({ filename: r.filename, score: r.score, preview: r.preview }))
    : exec.citations.map((c) => ({ filename: c.filename, score: c.score, preview: c.preview }));

  const chars = blocks.reduce((sum, b) => sum + (b.preview?.length ?? 0), 0);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="box" size={16} style={{ color: ACCENT }} />
          <h4
            className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: C.muted }}
          >
            Merging chunks into context
          </h4>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
          style={{ background: C.panel, border: `1px solid ${C.border}`, color: ACCENT }}
        >
          {blocks.length} chunks &middot; ~{chars} chars
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="min-w-0 rounded-2xl p-4"
        style={{
          background: C.bg2,
          border: `1px solid ${ACCENT}3a`,
          boxShadow: `inset 0 0 60px -40px ${ACCENT}`,
        }}
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.subtle }}>
          Context window
        </p>
        {blocks.length === 0 ? (
          <p className="text-sm" style={{ color: C.subtle }}>
            No context yet&hellip;
          </p>
        ) : (
          <div className="grid min-w-0 gap-2">
            {blocks.map((b, i) => (
              <motion.div
                key={`${b.filename}-${i}`}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.07, duration: 0.35, ease: "easeOut" }}
                className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: C.panel, border: `1px solid ${C.border}` }}
              >
                <Icon name="fileText" size={13} style={{ color: ACCENT }} />
                <span className="min-w-0 flex-1 truncate text-xs" style={{ color: C.text }}>
                  {b.filename}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums" style={{ color: C.muted }}>
                  {b.score.toFixed(3)}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
