"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { GROUP_COLOR, type ArchNodeDef } from "./architecture";

export type ArchNodeData = {
  def: ArchNodeDef;
  status: "pending" | "active" | "done";
  selected?: boolean;
  onSelect?: (id: string) => void;
};

const handleStyle = { opacity: 0, width: 1, height: 1, border: "none", background: "transparent" } as const;

export function ArchNode({ data }: NodeProps) {
  const { def, status, selected, onSelect } = data as unknown as ArchNodeData;
  const accent = GROUP_COLOR[def.group];
  const lit = status === "active" || status === "done";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.04, y: -2 }}
      onClick={() => onSelect?.(def.id)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(def.id);
        }
      }}
      className="relative w-[190px] rounded-xl px-3 py-2.5"
      style={{
        background: lit ? `linear-gradient(135deg, rgba(15,17,30,0.92), ${accent}1a)` : "rgba(13,15,26,0.82)",
        border: `1px solid ${selected ? accent : lit ? accent : "#23283c"}`,
        backdropFilter: "blur(10px)",
        cursor: "pointer",
        boxShadow: selected
          ? `0 0 0 2px ${accent}, 0 0 26px -2px ${accent}`
          : status === "active"
            ? `0 0 22px -2px ${accent}aa`
            : lit
              ? `0 0 12px -6px ${accent}`
              : "none",
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Left} id="l" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right} id="r" style={handleStyle} />

      {status === "active" ? (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ border: `1px solid ${accent}` }}
          initial={{ opacity: 0.55, scale: 1 }}
          animate={{ opacity: 0, scale: 1.18 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      ) : null}

      <div className="flex items-center gap-2.5">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ background: `${accent}1f`, border: `1px solid ${accent}66`, color: accent }}
        >
          <Icon name={def.icon} size={16} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold" style={{ color: lit ? "#e9ebf7" : "#aeb4ce" }}>
            {def.label}
          </p>
          <p className="truncate text-[10px]" style={{ color: "#6b7088" }}>
            {def.sub}
          </p>
        </div>
        {def.slug ? <Icon name="chevronRight" size={13} className="shrink-0" style={{ color: "#6b7088" }} /> : null}
      </div>
    </motion.div>
  );
}
