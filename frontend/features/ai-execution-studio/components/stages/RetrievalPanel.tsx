"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#c084fc";

type Chunk = { filename: string; score: number; preview: string };

export function RetrievalPanel({ exec }: { exec: ExecutionState }) {
  const chunks: Chunk[] =
    exec.retrieved.length > 0
      ? exec.retrieved.map((r) => ({ filename: r.filename, score: r.score, preview: r.preview }))
      : exec.citations.map((c) => ({ filename: c.filename, score: c.score, preview: c.preview }));

  if (chunks.length === 0) {
    return (
      <div className="grid min-w-0 place-items-center gap-2 py-10 text-center">
        <Icon name="layers" size={26} style={{ color: C.subtle }} />
        <p className="text-sm" style={{ color: C.subtle }}>
          No chunks retrieved
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon name="layers" size={16} style={{ color: ACCENT }} />
        <h4
          className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: C.muted }}
        >
          Top candidates by similarity
        </h4>
      </div>

      <div className="grid min-w-0 gap-2.5">
        {chunks.map((c, i) => {
          const pct = Math.max(0, Math.min(100, Math.round(c.score * 100)));
          return (
            <motion.div
              key={`${c.filename}-${i}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
              className="min-w-0 rounded-xl p-3.5"
              style={{ background: C.bg2, border: `1px solid ${C.border}` }}
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon name="fileText" size={14} style={{ color: ACCENT }} />
                  <span className="min-w-0 truncate text-sm font-medium" style={{ color: C.text }}>
                    {c.filename}
                  </span>
                </div>
                <span
                  className="shrink-0 text-xs font-semibold tabular-nums"
                  style={{ color: ACCENT }}
                >
                  {c.score.toFixed(3)}
                </span>
              </div>

              <div
                className="mt-2.5 h-1.5 w-full min-w-0 overflow-hidden rounded-full"
                style={{ background: C.border }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: ACCENT }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: i * 0.08 + 0.15, duration: 0.6, ease: "easeOut" }}
                />
              </div>

              {c.preview ? (
                <p className="mt-2 min-w-0 truncate text-xs" style={{ color: C.subtle }}>
                  {c.preview}
                </p>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
