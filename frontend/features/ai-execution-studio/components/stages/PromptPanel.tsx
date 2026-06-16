"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C } from "../../constants";
import type { ExecutionState } from "../../types";

const ACCENT = "#fb7185";
const SYSTEM_PROMPT =
  "You are DevPilot AI. Answer strictly from the provided context. Cite sources as [n]. If the context is insufficient, say so — never fabricate.";

const truncate = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);

function SourceCard({
  icon,
  label,
  children,
  delay,
}: {
  icon: "shield" | "layers" | "message";
  label: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className="min-w-0 rounded-xl p-3.5"
      style={{ background: C.bg2, border: `1px solid ${C.border}` }}
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-2">
        <Icon name={icon} size={13} style={{ color: ACCENT }} />
        <h4 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
          {label}
        </h4>
      </div>
      <div className="min-w-0 break-words text-xs leading-relaxed" style={{ color: C.text }}>
        {children}
      </div>
    </motion.div>
  );
}

export function PromptPanel({ exec }: { exec: ExecutionState }) {
  const chunks = exec.retrieved.length ? exec.retrieved : exec.citations;
  const previews = chunks.slice(0, 2).map((c) => c.preview);

  return (
    <div className="grid min-w-0 gap-3">
      <SourceCard icon="shield" label="System prompt" delay={0.05}>
        {SYSTEM_PROMPT}
      </SourceCard>

      <SourceCard icon="layers" label="Retrieved context" delay={0.15}>
        <p className="mb-1 text-[11px]" style={{ color: C.muted }}>
          {chunks.length} chunks
        </p>
        {previews.length ? (
          <ul className="grid min-w-0 gap-1">
            {previews.map((p, i) => (
              <li key={i} className="min-w-0 truncate" style={{ color: C.muted }}>
                {truncate(p, 120)}
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ color: C.subtle }}>—</span>
        )}
      </SourceCard>

      <SourceCard icon="message" label="User question" delay={0.25}>
        {exec.question || "—"}
      </SourceCard>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
        className="grid place-items-center"
      >
        <Icon name="chevronDown" size={18} style={{ color: ACCENT }} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.45, ease: "easeOut" }}
        className="min-w-0 rounded-2xl p-4"
        style={{
          background: C.bg2,
          border: `1px solid ${ACCENT}3a`,
          boxShadow: `0 18px 40px -28px ${ACCENT}88`,
        }}
      >
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <Icon name="code" size={15} style={{ color: ACCENT }} />
          <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
            Final prompt
          </h4>
        </div>
        <p className="min-w-0 break-words text-xs leading-relaxed" style={{ color: C.text }}>
          <span style={{ color: C.subtle }}>[system]</span> {truncate(SYSTEM_PROMPT, 90)}{" "}
          <span style={{ color: C.subtle }}>[context]</span> {chunks.length} chunks{" "}
          <span style={{ color: C.subtle }}>[question]</span> {exec.question || "—"}
        </p>
      </motion.div>
    </div>
  );
}
