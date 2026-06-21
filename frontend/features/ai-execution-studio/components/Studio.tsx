"use client";

import { MotionConfig, motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C, STAGE_IDS, STAGES, stageIndex } from "../constants";
import { useExecutionRun } from "../useExecutionRun";
import { usePlayer } from "../usePlayer";
import { Composer } from "./Composer";
import { AgentStage } from "./AgentStage";
import { TransportBar } from "./TransportBar";
import { PipelineRail } from "./PipelineRail";
import { StageDetail } from "./StageDetail";

function EmptyHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid place-items-center rounded-2xl px-6 py-16 text-center"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <div
        className="mb-5 grid h-14 w-14 place-items-center rounded-2xl"
        style={{ background: "#6a35f01f", border: "1px solid #6a35f0", color: "#a855f7" }}
      >
        <Icon name="zap" size={26} />
      </div>
      <h2 className="text-xl font-semibold" style={{ color: C.text }}>
        Watch the AI think
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: C.muted }}>
        Ask a question above and every stage of the RAG pipeline — embedding, vector search, retrieval, reranking,
        generation and evaluation — animates in real time from live execution data.
      </p>
      <div className="mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
        {STAGES.map((s, i) => (
          <motion.span
            key={s.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: C.bg2, border: `1px solid ${C.border}`, color: s.accent }}
          >
            <Icon name={s.icon} size={12} /> {s.label}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

export function Studio() {
  const { exec, run, stop } = useExecutionRun();
  const isLive = exec.runStatus === "running";
  const liveIndex = stageIndex(exec.activeStage);
  const player = usePlayer({ liveIndex, total: STAGE_IDS.length, isLive });
  const currentStage = STAGE_IDS[player.index] ?? "question";
  const started = exec.runStatus !== "idle";

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid min-w-0 gap-3">
        <Composer running={isLive} onRun={run} onStop={stop} />

        {exec.error ? (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
            style={{ background: "#f8717115", border: "1px solid #f8717155", color: "#fca5a5" }}
            role="alert"
          >
            <Icon name="alertCircle" size={16} /> {exec.error}
          </div>
        ) : null}

        {!started ? (
          <EmptyHero />
        ) : (
          <>
            <AgentStage stageId={currentStage} exec={exec} />

            <TransportBar
              index={player.index}
              total={STAGE_IDS.length}
              playing={player.playing}
              isLive={isLive}
              speed={player.speed}
              speeds={player.speeds}
              statusById={exec.stageStatus}
              latencyMs={exec.latencyMs}
              onToggle={player.toggle}
              onReplay={player.replay}
              onSeek={player.seek}
              onSpeed={player.setSpeed}
            />

            <div className="grid min-w-0 gap-3 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
              <div className="min-w-0 rounded-2xl p-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                <PipelineRail
                  statusById={exec.stageStatus}
                  currentId={currentStage}
                  onSelect={(id) => player.seek(STAGE_IDS.indexOf(id))}
                />
              </div>
              <StageDetail stageId={currentStage} exec={exec} />
            </div>
          </>
        )}
      </div>
    </MotionConfig>
  );
}
