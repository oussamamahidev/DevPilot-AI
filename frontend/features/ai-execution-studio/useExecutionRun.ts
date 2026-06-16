"use client";

import { useCallback, useEffect, useState } from "react";
import { useChatStream } from "@/hooks/useChatStream";
import { useTraceInspector } from "@/features/trace-inspector/hooks";
import { STAGE_IDS, initialExecution } from "./constants";
import type { ExecutionState, StageId } from "./types";

/** Mark every stage before `target` done and `target` active (monotonic). */
function reach(state: ExecutionState, target: StageId): ExecutionState {
  const idx = STAGE_IDS.indexOf(target);
  const stageStatus = { ...state.stageStatus };
  STAGE_IDS.forEach((id, i) => {
    if (i < idx) stageStatus[id] = "done";
    else if (i === idx && stageStatus[id] !== "done") stageStatus[id] = "active";
  });
  return { ...state, stageStatus, activeStage: target };
}

function finishAll(state: ExecutionState): ExecutionState {
  const stageStatus = { ...state.stageStatus };
  STAGE_IDS.forEach((id) => (stageStatus[id] = "done"));
  return { ...state, stageStatus, activeStage: "persistence", isStreaming: false, runStatus: "complete" };
}

export function useExecutionRun() {
  const { sendStreamingMessage, stopStreaming, isStreaming } = useChatStream();
  const [exec, setExec] = useState<ExecutionState>(initialExecution);
  const [messageId, setMessageId] = useState<string | null>(null);

  // Once the live run yields a message id, hydrate the rich, real trace data.
  const inspector = useTraceInspector(messageId ?? "", false, Boolean(messageId));

  useEffect(() => {
    const trace = inspector.trace;
    if (!trace) return;
    const chunks = inspector.retrieval?.chunks ?? trace.retrieved_chunks;
    setExec((prev) => ({
      ...prev,
      rewrittenQuery: inspector.retrieval?.rewritten_query ?? prev.rewrittenQuery,
      retrieved: chunks.map((c) => ({
        rank: c.rank,
        filename: c.filename,
        score: c.score,
        preview: c.content_preview,
        sourceScores: c.source_scores ?? {},
        chunkId: c.chunk_id,
      })),
      reranking: (inspector.reranking?.items ?? []).map((r) => ({
        filename: r.filename,
        originalRank: r.original_rank,
        finalRank: r.final_rank,
        originalScore: r.original_score,
        rerankScore: r.rerank_score,
        used: r.used_in_final_citations,
      })),
      agentRuns: trace.agent_runs.map((a) => ({ agentType: a.agent_type, latencyMs: a.latency_ms, status: a.status })),
      latencyMs: trace.latency_summary?.total_latency_ms ?? prev.latencyMs,
    }));
  }, [inspector.trace, inspector.retrieval, inspector.reranking]);

  const run = useCallback(
    async (input: { workspaceId: string; workspaceName: string; question: string }) => {
      setMessageId(null);
      setExec(
        reach(
          { ...initialExecution(), question: input.question, workspaceName: input.workspaceName, runStatus: "running" },
          "question",
        ),
      );

      try {
        await sendStreamingMessage({
        workspaceId: input.workspaceId,
        question: input.question,
        conversationId: null,
        retrievalStrategy: "hybrid",
        onStart: () => setExec((s) => reach(s, "embedding")),
        onTrace: (trace) => {
          setExec((s) => {
            switch (trace.stage) {
              case "retrieval":
                return reach(s, "search");
              case "reranker":
                return reach(s, "rerank");
              case "generator":
                return reach(s, "prompt");
              case "evaluator":
              case "corrector":
                return reach(s, "evaluation");
              default:
                return s;
            }
          });
        },
        onCitations: (citations) =>
          setExec((s) =>
            reach(
              {
                ...s,
                citations: citations.map((c) => ({
                  id: c.id,
                  filename: c.filename,
                  score: c.score,
                  preview: c.content ?? "",
                })),
              },
              "retrieval",
            ),
          ),
        onToken: (text) => setExec((s) => reach({ ...s, answer: s.answer + text, isStreaming: true }, "generation")),
        onEvaluation: (ev) =>
          setExec((s) =>
            reach(
              {
                ...s,
                evaluation: {
                  faithfulness: ev.faithfulness,
                  relevance: ev.relevance,
                  contextPrecision: ev.context_precision,
                  hallucination: ev.hallucination_score,
                  explanation: ev.explanation,
                },
              },
              "evaluation",
            ),
          ),
        onMessage: (data) => {
          setMessageId(data.message_id);
          setExec((s) => ({ ...s, messageId: data.message_id }));
        },
        onDone: () => setExec((s) => finishAll(s)),
        onError: (message) => setExec((s) => ({ ...s, error: message, runStatus: "error", isStreaming: false })),
        });
      } catch (e) {
        const status = (e as { status?: number }).status;
        const message = e instanceof Error ? e.message : "The request failed.";
        setExec((s) => ({
          ...s,
          error: status === 401 ? "Your session has expired — please sign in again." : message,
          runStatus: "error",
          isStreaming: false,
        }));
      }
    },
    [sendStreamingMessage],
  );

  const reset = useCallback(() => {
    setMessageId(null);
    setExec(initialExecution());
  }, []);

  return { exec, run, reset, stop: stopStreaming, isStreaming };
}
