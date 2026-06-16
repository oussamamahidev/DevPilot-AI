"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export type FlowEdgeData = { active?: boolean; accent?: string };

/**
 * Architecture edge with a faint base line and, when the request is flowing
 * through it, a glowing gradient plus traveling SMIL particles (GPU-driven,
 * so the 60fps budget is untouched by JS).
 */
export function FlowEdge({ id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, data }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const d = (data as FlowEdgeData) ?? {};
  const accent = d.accent ?? "#3a4060";
  const active = Boolean(d.active);

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: "#23283c", strokeWidth: 1.5 }} />
      {active ? (
        <>
          <path id={`${id}-glow`} d={path} fill="none" stroke={accent} strokeWidth={2} opacity={0.75} style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />
          {[0, 0.46, 0.92].map((begin, i) => (
            <circle key={i} r={3.2} fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }}>
              <animateMotion dur="1.4s" begin={`${begin}s`} repeatCount="indefinite">
                <mpath xlinkHref={`#${id}-glow`} />
              </animateMotion>
            </circle>
          ))}
        </>
      ) : null}
    </>
  );
}
