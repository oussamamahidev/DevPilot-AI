"use client";

import { useMemo } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ARCH_EDGES, ARCH_NODES, GROUP_COLOR, archNode } from "./architecture";
import { ArchNode } from "./ArchNode";
import { FlowEdge } from "./FlowEdge";
import { useArchitectureFlow } from "./useArchitectureFlow";
import type { ExecutionState } from "@/features/ai-execution-studio/types";

const nodeTypes = { arch: ArchNode };
const edgeTypes = { flow: FlowEdge };

export function FlowMap({
  exec,
  selectedId,
  onSelect,
}: {
  exec: ExecutionState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { nodeStatus, activeEdges } = useArchitectureFlow(exec);

  const nodes = useMemo<Node[]>(
    () =>
      ARCH_NODES.map((def) => ({
        id: def.id,
        type: "arch",
        position: def.position,
        data: { def, status: nodeStatus[def.id] ?? "pending", selected: def.id === selectedId, onSelect },
        draggable: false,
        selectable: false,
      })),
    [nodeStatus, onSelect, selectedId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      ARCH_EDGES.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "flow",
        data: { active: activeEdges.has(e.id), accent: GROUP_COLOR[archNode(e.target)?.group ?? "ai"] },
      })),
    [activeEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.3}
      maxZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      className="bg-transparent"
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="#1b2032" />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => GROUP_COLOR[(n.data as { def?: { group?: keyof typeof GROUP_COLOR } })?.def?.group ?? "ai"]}
        maskColor="rgba(6,7,13,0.7)"
        style={{ background: "#0a0c15", border: "1px solid #1b2032" }}
      />
      <Controls showInteractive={false} style={{ background: "#0d0f1a", border: "1px solid #1b2032" }} />
    </ReactFlow>
  );
}
