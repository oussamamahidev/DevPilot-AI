import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyClientFilters,
  isUngrounded,
  traceScore,
  faithfulnessBuckets,
  workspaceComparison,
  buildKpis,
} from "./helpers";
import { buildServerParams } from "./hooks";
import type { RagTraceListItem, RagTraceQualitySummary } from "@/types";

function mkTrace(p: Partial<RagTraceListItem>): RagTraceListItem {
  return {
    message_id: "m1",
    conversation_id: "c1",
    workspace_id: "w1",
    workspace_name: "Alpha",
    user_id: "u1",
    user_email: "a@x.com",
    question_preview: "q",
    answer_preview: "a",
    retrieval_strategy: "hybrid",
    citation_count: 2,
    faithfulness: 0.8,
    relevance: 0.8,
    context_precision: 0.8,
    hallucination_score: 0.1,
    corrected: false,
    created_at: "2026-01-01T00:00:00Z",
    total_latency_ms: 1000,
    ...p,
  };
}

describe("activeFilterCount", () => {
  it("is zero for empty filters", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });
  it("counts each active dimension", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, search: "x", workspaceId: "w1" })).toBe(2);
  });
});

describe("applyClientFilters", () => {
  const items = [
    mkTrace({ message_id: "1", user_email: "a@x.com", faithfulness: 0.9, hallucination_score: 0.1 }),
    mkTrace({ message_id: "2", user_email: "b@x.com", faithfulness: 0.4, hallucination_score: 0.7 }),
  ];
  it("filters by user email", () => {
    const out = applyClientFilters(items, { ...EMPTY_FILTERS, userEmail: "b@x.com" });
    expect(out.map((t) => t.message_id)).toEqual(["2"]);
  });
  it("applies the faithfulness upper bound", () => {
    const out = applyClientFilters(items, { ...EMPTY_FILTERS, maxFaithfulness: 0.5 });
    expect(out.map((t) => t.message_id)).toEqual(["2"]);
  });
  it("applies the hallucination lower bound", () => {
    const out = applyClientFilters(items, { ...EMPTY_FILTERS, minHallucination: 0.5 });
    expect(out.map((t) => t.message_id)).toEqual(["2"]);
  });
});

describe("isUngrounded / traceScore", () => {
  it("flags answers with no citations", () => {
    expect(isUngrounded(mkTrace({ citation_count: 0 }))).toBe(true);
    expect(isUngrounded(mkTrace({ citation_count: 3 }))).toBe(false);
  });
  it("produces a 0..100 health score", () => {
    const s = traceScore(mkTrace({}));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("distributions", () => {
  it("bucket counts sum to the item count", () => {
    const items = [0.05, 0.25, 0.45, 0.65, 0.85, 0.95].map((f) => mkTrace({ faithfulness: f }));
    const buckets = faithfulnessBuckets(items);
    expect(buckets).toHaveLength(5);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(items.length);
  });
});

describe("workspaceComparison", () => {
  it("groups by workspace and sorts worst faithfulness first", () => {
    const items = [
      mkTrace({ workspace_id: "w1", workspace_name: "Alpha", faithfulness: 0.9 }),
      mkTrace({ workspace_id: "w2", workspace_name: "Beta", faithfulness: 0.2 }),
    ];
    const stats = workspaceComparison(items);
    expect(stats[0].name).toBe("Beta");
    expect(stats).toHaveLength(2);
  });
});

describe("buildKpis", () => {
  const summary: RagTraceQualitySummary = {
    total_rag_queries: 120,
    average_faithfulness: 0.8,
    average_relevance: 0.7,
    average_context_precision: 0.6,
    average_hallucination_score: 0.2,
    low_quality_count: 3,
    hallucination_risk_count: 1,
    no_context_count: 4,
    corrected_answers_count: 5,
    average_latency_by_agent: {},
    worst_messages_by_hallucination: [],
    worst_messages_by_relevance: [],
  };
  it("uses the global summary when no filters are active", () => {
    const kpis = buildKpis([], 0, summary, false);
    expect(kpis).toHaveLength(6);
    expect(kpis[0].value).toBe("120");
  });
});

describe("buildServerParams", () => {
  it("maps filter state to the real API params", () => {
    const p = buildServerParams({ ...EMPTY_FILTERS, search: "auth", workspaceId: "w1", corrected: "yes", maxHallucination: 0.5 });
    expect(p).toMatchObject({ page: 1, page_size: 100, search: "auth", workspace_id: "w1", corrected: true, max_hallucination_score: 0.5 });
  });
  it("omits inactive filters", () => {
    const p = buildServerParams(EMPTY_FILTERS);
    expect(p).toEqual({ page: 1, page_size: 100 });
  });
});
