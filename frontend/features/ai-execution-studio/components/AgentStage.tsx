"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { C, stageDef } from "../constants";
import type { ExecutionState, StageId } from "../types";
import { AgentAvatar, type Mood } from "./AgentAvatar";

const LINES: Record<StageId, string> = {
  question: "Got it — let me work through this. 🚀",
  embedding: "Turning your words into a 768-dimensional vector…",
  search: "Scanning the vector space for the closest matches… 🔍",
  retrieval: "Pulled the most similar chunks — looking relevant.",
  rerank: "Reshuffling them by what actually matters…",
  context: "Stitching the winners into one context window…",
  prompt: "Assembling the prompt: system + context + your question.",
  generation: "Drafting your answer, token by token… ✍️",
  evaluation: "Fact-checking myself — no hallucinations on my watch. 🛡️",
  persistence: "Saved the full trace. All done! ✅",
};

function moodFor(stageId: StageId, exec: ExecutionState): Mood {
  if (exec.runStatus === "error") return "error";
  switch (stageId) {
    case "embedding":
    case "context":
    case "prompt":
      return "thinking";
    case "search":
      return "searching";
    case "retrieval":
    case "rerank":
      return "reading";
    case "generation":
      return exec.isStreaming ? "writing" : exec.answer ? "done" : "writing";
    case "evaluation":
      return "checking";
    case "persistence":
      return "done";
    default:
      return "idle";
  }
}

function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 22);
    return () => clearInterval(id);
  }, [text]);
  return (
    <span>
      {text.slice(0, n)}
      <motion.span
        className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5"
        style={{ background: C.muted }}
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    </span>
  );
}

export function AgentStage({ stageId, exec }: { stageId: StageId; exec: ExecutionState }) {
  const def = stageDef(stageId);
  const isError = exec.runStatus === "error";
  const accent = isError ? "#f87171" : def.accent;
  const mood = moodFor(stageId, exec);
  const line = isError ? "Hmm, something went sideways — details below." : LINES[stageId];

  return (
    <div
      className="flex flex-col items-center gap-4 overflow-hidden rounded-2xl p-4 sm:flex-row sm:p-5"
      style={{
        background: `linear-gradient(120deg, ${C.panel}, ${accent}0f)`,
        border: `1px solid ${C.border}`,
      }}
    >
      <div className="shrink-0">
        <AgentAvatar mood={mood} accent={accent} size={104} />
      </div>

      {/* speech bubble */}
      <div className="relative min-w-0 flex-1">
        <span
          className="absolute -left-2 top-6 hidden h-4 w-4 rotate-45 sm:block"
          style={{ background: C.bg2, borderLeft: `1px solid ${accent}55`, borderBottom: `1px solid ${accent}55` }}
        />
        <div
          className="min-w-0 rounded-2xl px-4 py-3"
          style={{ background: C.bg2, border: `1px solid ${accent}55` }}
          aria-live="polite"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
              {def.label}
            </span>
            <span className="h-1 w-1 rounded-full" style={{ background: C.subtle }} />
            <span className="text-[11px]" style={{ color: C.subtle }}>
              {exec.isStreaming && stageId === "generation" ? "generating…" : exec.runStatus === "running" ? "thinking…" : "step"}
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={line}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-sm leading-6"
              style={{ color: C.text }}
            >
              <Typewriter text={line} />
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
