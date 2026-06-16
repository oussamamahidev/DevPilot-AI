"use client";

import { useEffect, useState } from "react";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "./constants";

const STEP_MS = 1500;

/**
 * Timeline engine. While the run is live it follows the real stage index from
 * the streaming events; once complete it becomes a scrubber the user can
 * play / pause / replay / seek at 1× / 2× / 5×.
 */
export function usePlayer({ liveIndex, total, isLive }: { liveIndex: number; total: number; isLive: boolean }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  // Follow the real pipeline while streaming.
  useEffect(() => {
    if (isLive && liveIndex >= 0) setIndex(liveIndex);
  }, [isLive, liveIndex]);

  // Replay timer (only when not live and playing).
  useEffect(() => {
    if (isLive || !playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, total - 1)), STEP_MS / speed);
    return () => clearTimeout(t);
  }, [isLive, playing, index, speed, total]);

  return {
    index,
    playing,
    speed,
    speeds: PLAYBACK_SPEEDS,
    isLive,
    setSpeed,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying((p) => !p),
    replay: () => {
      setIndex(0);
      setPlaying(true);
    },
    seek: (i: number) => {
      setIndex(Math.max(0, Math.min(total - 1, i)));
      setPlaying(false);
    },
  };
}
