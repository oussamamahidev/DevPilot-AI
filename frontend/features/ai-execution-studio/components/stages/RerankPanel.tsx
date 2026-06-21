"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#e879f9";
const UP = "#34d399";
const DOWN = "#f87171";

export function RerankPanel({ exec }: { exec: ExecutionState }) {
  const rows = [...exec.reranking].sort(
    (a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999),
  );

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon name="activity" size={16} style={{ color: ACCENT }} />
        <h4
          className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: C.muted }}
        >
          Reorder by relevance
        </h4>
      </div>

      {rows.length > 0 ? (
        <div className="grid min-w-0 gap-2">
          {rows.map((r, i) => {
            const promoted =
              r.finalRank != null && r.originalRank != null && r.finalRank < r.originalRank;
            const demoted =
              r.finalRank != null && r.originalRank != null && r.finalRank > r.originalRank;
            const moveColor = promoted ? UP : demoted ? DOWN : C.muted;
            return (
              <motion.div
                layout
                key={`${r.filename}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="flex min-w-0 items-center gap-3 rounded-xl p-3"
                style={{ background: C.bg2, border: `1px solid ${C.border}` }}
              >
                <span
                  className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums"
                  style={{ color: moveColor }}
                >
                  #{r.originalRank ?? "—"}
                  <Icon
                    name="arrowRight"
                    size={12}
                    style={{
                      color: moveColor,
                      transform: promoted
                        ? "rotate(-45deg)"
                        : demoted
                          ? "rotate(45deg)"
                          : "none",
                    }}
                  />
                  #{r.finalRank ?? "—"}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: C.text }}>
                  {r.filename}
                </span>

                {r.used ? (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: `${ACCENT}1f`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
                  >
                    cited
                  </span>
                ) : null}

                <span
                  className="shrink-0 text-xs font-semibold tabular-nums"
                  style={{ color: C.muted }}
                >
                  {r.rerankScore?.toFixed(3) ?? "—"}
                </span>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          <p className="text-xs" style={{ color: C.subtle }}>
            Reranker details not captured for this run
          </p>
          <div className="grid min-w-0 gap-2">
            {exec.retrieved.map((r, i) => (
              <div
                key={`${r.filename}-${i}`}
                className="flex min-w-0 items-center gap-3 rounded-xl p-3"
                style={{ background: C.bg2, border: `1px solid ${C.border}` }}
              >
                <span
                  className="shrink-0 text-xs font-semibold tabular-nums"
                  style={{ color: C.subtle }}
                >
                  #{r.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: C.text }}>
                  {r.filename}
                </span>
                <span
                  className="shrink-0 text-xs font-semibold tabular-nums"
                  style={{ color: C.muted }}
                >
                  {r.score.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
