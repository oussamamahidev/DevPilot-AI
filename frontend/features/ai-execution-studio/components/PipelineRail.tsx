"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C, STAGES } from "../constants";
import type { StageId, StageStatus } from "../types";

function Connector({ filled, accent }: { filled: boolean; accent: string }) {
  return (
    <div className="relative w-px flex-1" style={{ minHeight: 26, background: C.border }}>
      {filled ? (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(${accent}, ${accent}55)` }} />
          <motion.div
            className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
            style={{ background: accent, boxShadow: `0 0 10px 2px ${accent}` }}
            initial={{ top: "-6px", opacity: 0 }}
            animate={{ top: ["-6px", "100%"], opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeIn" }}
          />
        </>
      ) : null}
    </div>
  );
}

function Node({
  index,
  status,
  current,
  onSelect,
}: {
  index: number;
  status: StageStatus;
  current: boolean;
  onSelect: () => void;
}) {
  const stage = STAGES[index];
  const isLast = index === STAGES.length - 1;
  const lit = status === "active" || status === "done";
  const accent = stage.accent;

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex flex-col items-center">
        <motion.button
          type="button"
          onClick={onSelect}
          aria-current={current ? "step" : undefined}
          aria-label={`${stage.label} — ${status}`}
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl focus-visible:outline-none focus-visible:ring-2"
          style={{
            background: lit ? `${accent}1f` : C.panel,
            border: `1px solid ${lit ? accent : C.border}`,
            color: lit ? accent : C.subtle,
          }}
          animate={
            status === "active"
              ? { boxShadow: [`0 0 0px ${accent}00`, `0 0 18px 3px ${accent}88`, `0 0 0px ${accent}00`] }
              : { boxShadow: `0 0 0px ${accent}00` }
          }
          transition={{ duration: 1.4, repeat: status === "active" ? Infinity : 0 }}
          whileHover={{ scale: 1.06 }}
        >
          <Icon name={stage.icon} size={18} />
          {status === "active" ? (
            <motion.span
              className="absolute inset-0 rounded-xl"
              style={{ border: `1px solid ${accent}` }}
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
          ) : null}
          {current ? (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          ) : null}
        </motion.button>
        {!isLast ? <Connector filled={status === "done"} accent={accent} /> : null}
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 pb-5 text-left focus-visible:outline-none"
      >
        <p
          className="truncate text-sm font-semibold transition-colors"
          style={{ color: current ? stage.accent : lit ? C.text : C.muted }}
        >
          {stage.label}
        </p>
        <p className="truncate text-xs" style={{ color: C.subtle }}>
          {status === "active" ? "running…" : stage.caption}
        </p>
      </button>
    </div>
  );
}

export function PipelineRail({
  statusById,
  currentId,
  onSelect,
}: {
  statusById: Record<StageId, StageStatus>;
  currentId: StageId;
  onSelect: (id: StageId) => void;
}) {
  return (
    <div className="flex flex-col">
      {STAGES.map((stage, i) => (
        <Node
          key={stage.id}
          index={i}
          status={statusById[stage.id]}
          current={stage.id === currentId}
          onSelect={() => onSelect(stage.id)}
        />
      ))}
    </div>
  );
}
