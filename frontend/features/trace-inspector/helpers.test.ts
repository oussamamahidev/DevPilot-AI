import { describe, it, expect } from "vitest";
import {
  agentStatus,
  traceHealthScore,
  scoreTone,
  riskLevel,
  diffWords,
  splitAnswerByCitations,
  formatLatency,
  sanitizeDebug,
  shortenId,
} from "./helpers";
import type { RagTraceAgentRun } from "@/types";

function run(partial: Partial<RagTraceAgentRun>): RagTraceAgentRun {
  return {
    id: "1",
    agent_type: "generator",
    status: "completed",
    latency_ms: 10,
    input_preview: {},
    output_preview: {},
    error: null,
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("agentStatus", () => {
  it("treats a never-run agent as skipped (no phantom green)", () => {
    expect(agentStatus(null)).toBe("skipped");
  });
  it("treats an error as failed", () => {
    expect(agentStatus(run({ error: "boom" }))).toBe("failed");
    expect(agentStatus(run({ status: "failed", error: null }))).toBe("failed");
  });
  it("detects running/pending", () => {
    expect(agentStatus(run({ status: "running" }))).toBe("running");
    expect(agentStatus(run({ status: "pending" }))).toBe("running");
  });
  it("defaults to completed", () => {
    expect(agentStatus(run({ status: "completed", error: null }))).toBe("completed");
  });
});

describe("traceHealthScore", () => {
  it("is 100 for a perfect, fast trace", () => {
    expect(traceHealthScore({ faithfulness: 1, relevance: 1, hallucination: 0, latencyMs: 500 })).toBe(100);
  });
  it("is 0 for the worst, slowest trace", () => {
    expect(traceHealthScore({ faithfulness: 0, relevance: 0, hallucination: 1, latencyMs: 20000 })).toBe(0);
  });
  it("stays within 0..100", () => {
    const s = traceHealthScore({ faithfulness: 0.5, relevance: 0.5, hallucination: 0.5, latencyMs: 3000 });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("scoreTone", () => {
  it("maps higher-is-better scores", () => {
    expect(scoreTone(0.8)).toBe("success");
    expect(scoreTone(0.6)).toBe("warning");
    expect(scoreTone(0.3)).toBe("danger");
  });
  it("inverts for hallucination-style metrics", () => {
    expect(scoreTone(0.2, true)).toBe("success");
    expect(scoreTone(0.5, true)).toBe("warning");
    expect(scoreTone(0.8, true)).toBe("danger");
  });
});

describe("riskLevel", () => {
  it("buckets hallucination into low/medium/high", () => {
    expect(riskLevel(0.2).label).toBe("Low risk");
    expect(riskLevel(0.5).label).toBe("Medium risk");
    expect(riskLevel(0.8).label).toBe("High risk");
  });
});

describe("diffWords", () => {
  it("reconstructs both sides exactly (LCS invariant)", () => {
    const oldText = "the quick brown fox";
    const newText = "the slow brown fox jumps";
    const segs = diffWords(oldText, newText);
    const reOld = segs.filter((s) => s.type !== "add").map((s) => s.text).join("");
    const reNew = segs.filter((s) => s.type !== "remove").map((s) => s.text).join("");
    expect(reOld).toBe(oldText);
    expect(reNew).toBe(newText);
  });
  it("marks an added word", () => {
    const segs = diffWords("a b", "a b c");
    expect(segs.some((s) => s.type === "add" && s.text.includes("c"))).toBe(true);
  });
});

describe("splitAnswerByCitations", () => {
  it("splits inline [n] markers into text + cite segments", () => {
    const segs = splitAnswerByCitations("Hello [1] world [2]");
    expect(segs).toEqual([
      { type: "text", text: "Hello " },
      { type: "cite", num: 1 },
      { type: "text", text: " world " },
      { type: "cite", num: 2 },
    ]);
  });
  it("returns a single text segment when there are no markers", () => {
    expect(splitAnswerByCitations("no citations here")).toEqual([{ type: "text", text: "no citations here" }]);
  });
});

describe("formatLatency", () => {
  it("formats ms, seconds, and missing values", () => {
    expect(formatLatency(500)).toBe("500 ms");
    expect(formatLatency(1500)).toBe("1.50 s");
    expect(formatLatency(null)).toBe("—");
  });
});

describe("sanitizeDebug", () => {
  it("redacts secret-like keys at any depth", () => {
    const out = sanitizeDebug({ password: "x", api_key: "y", nested: { token: "z", ok: 1 } }) as Record<string, unknown>;
    expect(out.password).not.toBe("x");
    expect(out.api_key).not.toBe("y");
    expect((out.nested as Record<string, unknown>).token).not.toBe("z");
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
  });
});

describe("shortenId", () => {
  it("middle-truncates long ids and passes through short ones", () => {
    expect(shortenId(null)).toBe("—");
    expect(shortenId("abc")).toBe("abc");
    expect(shortenId("0123456789abcdef", 8)).toContain("…");
  });
});
