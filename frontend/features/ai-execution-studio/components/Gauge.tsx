"use client";

import { motion } from "framer-motion";
import { C } from "../constants";

/** Animated radial gauge (0..1). Used by the Evaluation stage. */
export function Gauge({ label, value, accent }: { label: string; value: number; accent: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 34;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke={C.border} strokeWidth="6" />
          <motion.circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - pct * circ }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 5px ${accent}aa)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-xl font-semibold tabular-nums" style={{ color: C.text }}>
            {Math.round(pct * 100)}
          </span>
        </div>
      </div>
      <p className="text-center text-xs" style={{ color: C.muted }}>
        {label}
      </p>
    </div>
  );
}
