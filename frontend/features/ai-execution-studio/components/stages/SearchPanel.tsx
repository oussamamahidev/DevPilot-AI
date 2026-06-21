"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C, projectPoint } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#a78bfa";

export function SearchPanel({ exec }: { exec: ExecutionState }) {
  const source =
    exec.retrieved.length > 0
      ? exec.retrieved.map((r, idx) => ({
          seed: r.chunkId ?? `${r.filename}${idx}`,
          score: r.score,
        }))
      : exec.citations.map((c, idx) => ({
          seed: `${c.filename}${idx}`,
          score: c.score,
        }));

  const points = source.map((s, idx) => {
    const p = projectPoint(s.seed, s.score);
    return { ...p, score: s.score, idx };
  });

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon name="search" size={16} style={{ color: ACCENT }} />
        <h4
          className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: C.muted }}
        >
          Nearest neighbours in vector space
        </h4>
      </div>

      <div
        className="mx-auto aspect-square w-full max-w-[460px] min-w-0 overflow-hidden rounded-2xl"
        style={{ background: C.bg2, border: `1px solid ${C.border}` }}
      >
        <svg
          viewBox="0 0 100 100"
          className="block h-full w-full"
          role="img"
          aria-label={`Vector space with ${points.length} retrieved chunks around the query`}
        >
          {/* faint grid */}
          {Array.from({ length: 9 }).map((_, i) => {
            const v = ((i + 1) * 100) / 10;
            return (
              <g key={`g${i}`}>
                <line x1={v} y1={0} x2={v} y2={100} stroke={C.grid} strokeWidth={0.4} />
                <line x1={0} y1={v} x2={100} y2={v} stroke={C.grid} strokeWidth={0.4} />
              </g>
            );
          })}

          {/* radar sweep */}
          <motion.circle
            cx={50}
            cy={50}
            r={6}
            fill="none"
            stroke={ACCENT}
            strokeWidth={0.5}
            initial={{ opacity: 0.5, r: 4 }}
            animate={{ opacity: 0, r: 48 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
          />

          {/* links from query to top 5 */}
          {points.slice(0, 5).map((p) => (
            <line
              key={`l${p.idx}`}
              x1={50}
              y1={50}
              x2={p.x}
              y2={p.y}
              stroke={ACCENT}
              strokeWidth={0.35}
              strokeOpacity={0.25 + p.score * 0.4}
            />
          ))}

          {/* candidate vectors */}
          {points.map((p) => {
            const bright = Math.max(0.2, Math.min(1, p.score));
            const color = p.score >= 0.45 ? ACCENT : C.subtle;
            return (
              <motion.circle
                key={`p${p.idx}`}
                cx={p.x}
                cy={p.y}
                r={2.4}
                fill={color}
                style={{ filter: p.score >= 0.6 ? `drop-shadow(0 0 3px ${ACCENT})` : "none" }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: bright, scale: 1 }}
                transition={{ delay: p.idx * 0.05, duration: 0.4, ease: "easeOut" }}
              />
            );
          })}

          {/* query node */}
          <motion.circle
            cx={50}
            cy={50}
            r={3.2}
            fill={ACCENT}
            style={{ filter: `drop-shadow(0 0 5px ${ACCENT})` }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>

      <p className="text-center text-xs tabular-nums" style={{ color: C.subtle }}>
        {points.length} candidate vectors
      </p>
    </div>
  );
}
