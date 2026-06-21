"use client";

import { Icon } from "@/components/ui/Icon";
import { C, STAGES } from "../constants";
import type { PlaybackSpeed } from "../constants";
import type { StageId, StageStatus } from "../types";

export function TransportBar({
  index,
  total,
  playing,
  isLive,
  speed,
  speeds,
  statusById,
  latencyMs,
  onToggle,
  onReplay,
  onSeek,
  onSpeed,
}: {
  index: number;
  total: number;
  playing: boolean;
  isLive: boolean;
  speed: PlaybackSpeed;
  speeds: readonly PlaybackSpeed[];
  statusById: Record<StageId, StageStatus>;
  latencyMs: number | null;
  onToggle: () => void;
  onReplay: () => void;
  onSeek: (i: number) => void;
  onSpeed: (s: PlaybackSpeed) => void;
}) {
  const btn = "grid h-9 w-9 place-items-center rounded-lg disabled:opacity-30";
  const btnStyle = { background: C.bg2, border: `1px solid ${C.border}`, color: C.text };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl p-2.5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onToggle} disabled={isLive} className={btn} style={btnStyle} aria-label={playing ? "Pause" : "Play"}>
          <Icon name={playing ? "close" : "chevronRight"} size={16} />
        </button>
        <button type="button" onClick={onReplay} disabled={isLive} className={btn} style={btnStyle} aria-label="Replay">
          <Icon name="refreshCw" size={15} />
        </button>
      </div>

      {/* stage scrubber */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5" role="group" aria-label="Pipeline timeline">
        {STAGES.map((stage, i) => {
          const status = statusById[stage.id];
          const active = i === index;
          const lit = status === "done" || status === "active";
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSeek(i)}
              aria-label={stage.label}
              className="group relative h-2 min-w-0 flex-1 rounded-full"
              style={{ background: lit ? stage.accent : C.border, opacity: active ? 1 : lit ? 0.7 : 0.4 }}
            >
              {active ? (
                <span className="absolute -top-1 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full" style={{ border: `2px solid ${stage.accent}`, background: C.bg }} />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1" aria-label="Playback speed">
        {speeds.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeed(s)}
            className="h-7 rounded-md px-2 text-xs font-semibold"
            style={{
              background: s === speed ? "#6a35f0" : C.bg2,
              border: `1px solid ${s === speed ? "#6a35f0" : C.border}`,
              color: s === speed ? "#fff" : C.muted,
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="hidden items-center gap-1.5 text-xs sm:flex" style={{ color: C.subtle }}>
        <Icon name="clock" size={13} />
        <span className="tabular-nums">{latencyMs != null ? `${(latencyMs / 1000).toFixed(2)}s` : isLive ? "live" : "—"}</span>
        <span style={{ color: C.border }}>·</span>
        <span className="tabular-nums">{index + 1}/{total}</span>
      </div>
    </div>
  );
}
