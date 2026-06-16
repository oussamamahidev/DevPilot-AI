"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#34d399";

export function GenerationPanel({ exec }: { exec: ExecutionState }) {
  const { answer, isStreaming } = exec;
  const hasAnswer = answer.trim().length > 0;
  const empty = !hasAnswer && !isStreaming;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="sparkles" size={16} style={{ color: ACCENT }} />
          <h4
            className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: C.muted }}
          >
            Generating answer
          </h4>
        </div>
        {(isStreaming || hasAnswer) && (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: C.panel, border: `1px solid ${C.border}`, color: ACCENT }}
          >
            {isStreaming ? (
              <motion.span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: ACCENT }}
                animate={{ opacity: [1, 0.2, 1], scale: [1, 0.7, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : (
              <Icon name="checkCircle" size={12} style={{ color: ACCENT }} />
            )}
            {isStreaming ? "streaming" : "complete"}
          </span>
        )}
      </div>

      <div
        aria-live="polite"
        className="min-w-0 rounded-2xl p-4 text-sm leading-7"
        style={{ background: C.bg2, border: `1px solid ${C.border}`, color: C.text }}
      >
        <AnimatePresence mode="wait">
          {empty ? (
            <motion.div
              key="awaiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid place-items-center gap-2 py-8 text-center"
            >
              <Icon name="sparkles" size={22} style={{ color: C.subtle }} />
              <span className="text-xs" style={{ color: C.subtle }}>
                Awaiting generation&hellip;
              </span>
            </motion.div>
          ) : (
            <p key="answer" className="min-w-0 whitespace-pre-wrap break-words">
              {answer}
              {isStreaming && (
                <motion.span
                  className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px]"
                  style={{ background: ACCENT }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                />
              )}
            </p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
