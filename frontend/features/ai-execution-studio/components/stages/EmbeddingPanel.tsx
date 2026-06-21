"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#818cf8";
const COLS = 16;
const ROWS = 6;
const CELLS = COLS * ROWS;

export function EmbeddingPanel({ exec }: { exec: ExecutionState }) {
  const source = exec.rewrittenQuery?.trim() || exec.question;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="cpu" size={16} style={{ color: ACCENT }} />
          <h4
            className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: C.muted }}
          >
            Encoding query → vector
          </h4>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
          style={{ background: C.panel, border: `1px solid ${C.border}`, color: ACCENT }}
        >
          768 dims
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="min-w-0 rounded-2xl p-4"
        style={{ background: C.bg2, border: `1px solid ${C.border}` }}
      >
        <div
          className="grid min-w-0 gap-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: CELLS }).map((_, i) => (
            <motion.div
              key={i}
              className="aspect-square min-w-0 rounded-[3px]"
              style={{ background: C.border }}
              animate={{
                backgroundColor: [C.border, ACCENT, C.border],
                opacity: [0.4, 1, 0.55],
              }}
              transition={{
                duration: 1.6,
                delay: i * 0.01,
                repeat: Infinity,
                repeatDelay: 0.8,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </motion.div>

      <p className="min-w-0 break-words text-xs leading-relaxed" style={{ color: C.subtle }}>
        Encoding query &rarr; 768-dimensional vector
        {source ? (
          <>
            {" "}
            from <span style={{ color: C.muted }}>&ldquo;{source}&rdquo;</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
