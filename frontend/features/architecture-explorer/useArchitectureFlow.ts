import { useMemo } from "react";
import { ARCH_EDGES, ARCH_NODES } from "./architecture";
import type { ExecutionState } from "@/features/ai-execution-studio/types";

export type NodeStatus = "pending" | "active" | "done";

export function useArchitectureFlow(exec: ExecutionState) {
  return useMemo(() => {
    const idle = exec.runStatus === "idle";
    const nodeStatus: Record<string, NodeStatus> = {};

    ARCH_NODES.forEach((n) => {
      if (idle) {
        nodeStatus[n.id] = "pending";
        return;
      }
      if (n.stage) {
        const s = exec.stageStatus[n.stage];
        nodeStatus[n.id] = s === "active" ? "active" : s === "done" ? "done" : "pending";
      } else if (n.id === "response") {
        nodeStatus[n.id] = exec.runStatus === "complete" ? "done" : "pending";
      } else if (n.id === "ragops") {
        nodeStatus[n.id] = exec.runStatus === "complete" ? "done" : "pending";
      } else {
        nodeStatus[n.id] = "done"; // entry infra nodes — traversed as soon as the request enters
      }
    });

    const activeEdges = new Set<string>();
    ARCH_EDGES.forEach((e) => {
      if (idle) {
        if (e.main) activeEdges.add(e.id); // ambient flow at rest
        return;
      }
      const ts = nodeStatus[e.target];
      const ss = nodeStatus[e.source];
      if (ts === "active" || (ss === "done" && ts === "done")) activeEdges.add(e.id);
    });

    return { nodeStatus, activeEdges };
  }, [exec]);
}
