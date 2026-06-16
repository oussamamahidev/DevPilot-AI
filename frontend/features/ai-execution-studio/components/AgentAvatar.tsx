"use client";

import { AnimatePresence, motion, type Transition } from "framer-motion";

export type Mood = "idle" | "thinking" | "searching" | "reading" | "writing" | "checking" | "done" | "error";

const SQUINT: Record<Mood, number> = {
  idle: 1, thinking: 1, searching: 1, reading: 1, writing: 1, checking: 0.4, done: 1, error: 1.15,
};

// where the eyes look (and whether they scan), per mood
function eyeMotion(mood: Mood): { animate: { x: number | number[]; y: number | number[] }; transition: Transition } {
  switch (mood) {
    case "searching":
      return { animate: { x: [-5, 5, -5], y: -1 }, transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } };
    case "reading":
      return { animate: { x: [-4, 4], y: 4 }, transition: { duration: 1.6, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } };
    case "thinking":
      return { animate: { x: 3, y: -4 }, transition: { type: "spring", stiffness: 120, damping: 12 } };
    case "writing":
      return { animate: { x: 0, y: 4 }, transition: { type: "spring", stiffness: 120, damping: 12 } };
    default:
      return { animate: { x: 0, y: 0 }, transition: { type: "spring", stiffness: 120, damping: 12 } };
  }
}

const eyeOrigin = { transformBox: "fill-box", transformOrigin: "center" } as const;

function Eye({ cx, mood }: { cx: number; mood: Mood }) {
  const squint = SQUINT[mood];
  const blinking = mood !== "checking" && mood !== "error";
  return (
    <motion.rect
      x={cx - 5}
      y={52}
      width={10}
      height={14}
      rx={5}
      fill="#0b0d16"
      style={eyeOrigin}
      animate={blinking ? { scaleY: [squint, squint, 0.1, squint] } : { scaleY: squint }}
      transition={blinking ? { duration: 3.6, times: [0, 0.92, 0.96, 1], repeat: Infinity } : { duration: 0.2 }}
    />
  );
}

export function AgentAvatar({ mood, accent, size = 120 }: { mood: Mood; accent: string; size?: number }) {
  const em = eyeMotion(mood);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* aura */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${accent}55, transparent 65%)` }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: mood === "writing" || mood === "searching" ? 1.1 : 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* body bob */}
      <motion.svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className="relative"
        role="img"
        aria-label={`AI agent — ${mood}`}
        animate={{ y: [0, -4, 0], rotate: mood === "error" ? [-2, 2, -2] : 0 }}
        transition={{ y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" }, rotate: { duration: 0.4, repeat: mood === "error" ? Infinity : 0 } }}
      >
        <defs>
          <radialGradient id="agentHead" cx="40%" cy="32%" r="75%">
            <stop offset="0%" stopColor={`${accent}`} />
            <stop offset="55%" stopColor={`${accent}`} />
            <stop offset="100%" stopColor="#11142a" />
          </radialGradient>
        </defs>

        {/* antenna */}
        <line x1="60" y1="26" x2="60" y2="15" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <motion.circle cx="60" cy="12" r="4" fill={accent} animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.25, 1] }} transition={{ duration: 1.3, repeat: Infinity }} style={{ filter: `drop-shadow(0 0 6px ${accent})`, transformBox: "fill-box", transformOrigin: "center" }} />

        {/* head */}
        <motion.circle cx="60" cy="66" r="40" fill="url(#agentHead)" stroke={accent} strokeWidth="1.5"
          animate={{ scale: mood === "writing" ? [1, 1.015, 1] : 1 }} transition={{ duration: 0.6, repeat: mood === "writing" ? Infinity : 0 }}
          style={{ transformBox: "fill-box", transformOrigin: "center", filter: `drop-shadow(0 6px 16px ${accent}66)` }} />
        {/* glossy highlight */}
        <ellipse cx="46" cy="48" rx="14" ry="8" fill="#ffffff" opacity="0.14" />

        {/* face panel */}
        <rect x="34" y="46" width="52" height="34" rx="16" fill="#0a0c18" opacity="0.55" />

        {/* eyes */}
        {mood === "done" ? (
          <g stroke="#0b0d16" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M40 60 q6 -7 12 0" />
            <path d="M68 60 q6 -7 12 0" />
          </g>
        ) : (
          <motion.g animate={em.animate} transition={em.transition}>
            <Eye cx={46} mood={mood} />
            <Eye cx={74} mood={mood} />
          </motion.g>
        )}

        {/* mouth */}
        {mood === "done" ? (
          <path d="M50 74 q10 12 20 0" stroke="#0b0d16" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        ) : mood === "error" ? (
          <path d="M52 78 q8 -7 16 0" stroke="#0b0d16" strokeWidth="3" fill="none" strokeLinecap="round" />
        ) : mood === "writing" ? (
          <motion.rect x="54" y="74" width="12" height="4" rx="2" fill="#0b0d16" style={eyeOrigin}
            animate={{ scaleX: [1, 0.4, 1], scaleY: [1, 1.6, 1] }} transition={{ duration: 0.45, repeat: Infinity }} />
        ) : mood === "thinking" || mood === "searching" ? (
          <circle cx="60" cy="76" r="3" fill="#0b0d16" />
        ) : (
          <rect x="54" y="75" width="12" height="3.5" rx="1.75" fill="#0b0d16" />
        )}
      </motion.svg>

      {/* thinking dots */}
      <AnimatePresence>
        {mood === "thinking" || mood === "searching" ? (
          <motion.div
            className="absolute -right-1 top-0 flex gap-1 rounded-full px-2 py-1"
            style={{ background: "#0d0f1a", border: `1px solid ${accent}55` }}
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: accent }}
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* celebration sparkles */}
      <AnimatePresence>
        {mood === "done" ? (
          <>
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              return (
                <motion.span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                  style={{ background: accent }}
                  initial={{ x: 0, y: 0, opacity: 0 }}
                  animate={{ x: Math.cos(angle) * (size * 0.5), y: Math.sin(angle) * (size * 0.5), opacity: [0, 1, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.05 }} />
              );
            })}
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
