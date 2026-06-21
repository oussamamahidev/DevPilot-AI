"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { listWorkspaces } from "@/lib/workspaces";
import { C } from "../constants";

const EXAMPLES = [
  "Summarize the key architectural decisions.",
  "What are the main risks in this project?",
  "Which technologies are used and why?",
];

export function Composer({
  running,
  onRun,
  onStop,
}: {
  running: boolean;
  onRun: (input: { workspaceId: string; workspaceName: string; question: string }) => void;
  onStop: () => void;
}) {
  const workspacesQuery = useQuery({ queryKey: ["workspaces"], queryFn: () => listWorkspaces() });
  const workspaces = useMemo(() => workspacesQuery.data ?? [], [workspacesQuery.data]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [question, setQuestion] = useState("");

  useEffect(() => {
    if (!workspaceId && workspaces.length > 0) setWorkspaceId(workspaces[0].id);
  }, [workspaces, workspaceId]);

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const canRun = Boolean(workspaceId && question.trim() && !running);

  function submit() {
    if (!canRun || !workspace) return;
    onRun({ workspaceId, workspaceName: workspace.name, question: question.trim() });
  }

  return (
    <div className="rounded-2xl p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <select
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          disabled={running || workspaces.length === 0}
          aria-label="Workspace"
          className="h-11 shrink-0 rounded-xl px-3 text-sm outline-none lg:max-w-[200px]"
          style={{ background: C.bg2, border: `1px solid ${C.border}`, color: C.text }}
        >
          {workspaces.length === 0 ? <option value="">No workspaces</option> : null}
          {workspaces.map((w) => (
            <option key={w.id} value={w.id} style={{ background: C.bg2 }}>
              {w.name}
            </option>
          ))}
        </select>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3" style={{ background: C.bg2, border: `1px solid ${C.border}` }}>
          <Icon name="sparkles" size={16} style={{ color: C.subtle }} className="shrink-0" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            disabled={running}
            placeholder="Ask your documents — then watch the AI think…"
            aria-label="Question"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: C.text }}
          />
        </div>

        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold"
            style={{ background: `${C.border}`, color: C.text }}
          >
            <Icon name="close" size={16} /> Stop
          </button>
        ) : (
          <motion.button
            type="button"
            onClick={submit}
            disabled={!canRun}
            whileHover={canRun ? { scale: 1.03 } : undefined}
            whileTap={canRun ? { scale: 0.97 } : undefined}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(100deg,#6a35f0,#a855f7)", boxShadow: canRun ? "0 0 24px -4px #8b5cf6" : "none" }}
          >
            <Icon name="zap" size={16} /> Run pipeline
          </motion.button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setQuestion(ex)}
            disabled={running}
            className="rounded-full px-2.5 py-1 text-[11px] transition disabled:opacity-40"
            style={{ background: C.bg2, border: `1px solid ${C.border}`, color: C.muted }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
