"use client";

import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { C, STAGE_IDS, stageDef } from "../constants";
import type { ExecutionState, StageId } from "../types";
import { QuestionPanel } from "./stages/QuestionPanel";
import { EmbeddingPanel } from "./stages/EmbeddingPanel";
import { SearchPanel } from "./stages/SearchPanel";
import { RetrievalPanel } from "./stages/RetrievalPanel";
import { RerankPanel } from "./stages/RerankPanel";
import { ContextPanel } from "./stages/ContextPanel";
import { PromptPanel } from "./stages/PromptPanel";
import { GenerationPanel } from "./stages/GenerationPanel";
import { EvaluationPanel } from "./stages/EvaluationPanel";
import { PersistencePanel } from "./stages/PersistencePanel";

const PANELS: Record<StageId, ComponentType<{ exec: ExecutionState }>> = {
  question: QuestionPanel,
  embedding: EmbeddingPanel,
  search: SearchPanel,
  retrieval: RetrievalPanel,
  rerank: RerankPanel,
  context: ContextPanel,
  prompt: PromptPanel,
  generation: GenerationPanel,
  evaluation: EvaluationPanel,
  persistence: PersistencePanel,
};

export function StageDetail({ stageId, exec }: { stageId: StageId; exec: ExecutionState }) {
  const def = stageDef(stageId);
  const Panel = PANELS[stageId];
  const number = STAGE_IDS.indexOf(stageId) + 1;

  return (
    <div className="min-w-0 rounded-2xl p-5" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="mb-4 flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${def.accent}1f`, border: `1px solid ${def.accent}`, color: def.accent }}
        >
          <Icon name={def.icon} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold" style={{ color: C.text }}>
            {def.label}
          </h2>
          <p className="truncate text-xs" style={{ color: C.subtle }}>
            {def.caption}
          </p>
        </div>
        <span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: def.accent }}>
          {number} / 10
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stageId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24 }}
        >
          <Panel exec={exec} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
