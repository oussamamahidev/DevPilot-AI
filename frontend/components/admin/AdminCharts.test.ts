import { describe, it, expect } from "vitest";
import { pctTone, healthTone, latencyTone, fmtMs, scoreBuckets, agentLatencyRows } from "./AdminCharts";

describe("pctTone", () => {
  it("maps higher-is-better and inverted metrics", () => {
    expect(pctTone(0.8)).toBe("success");
    expect(pctTone(0.5)).toBe("warning");
    expect(pctTone(0.2)).toBe("critical");
    expect(pctTone(0.2, true)).toBe("success");
    expect(pctTone(0.8, true)).toBe("critical");
  });
});

describe("healthTone / latencyTone", () => {
  it("buckets health scores", () => {
    expect(healthTone(85)).toBe("success");
    expect(healthTone(60)).toBe("warning");
    expect(healthTone(40)).toBe("critical");
  });
  it("buckets latency", () => {
    expect(latencyTone(1000)).toBe("success");
    expect(latencyTone(3000)).toBe("warning");
    expect(latencyTone(5000)).toBe("critical");
  });
});

describe("fmtMs", () => {
  it("formats ms, seconds and empty", () => {
    expect(fmtMs(500)).toBe("500 ms");
    expect(fmtMs(2500)).toBe("2.50 s");
    expect(fmtMs(0)).toBe("—");
  });
});

describe("scoreBuckets", () => {
  it("returns 5 bands whose counts sum to the input size", () => {
    const b = scoreBuckets([0.1, 0.3, 0.5, 0.7, 0.9]);
    expect(b).toHaveLength(5);
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(5);
  });
});

describe("agentLatencyRows", () => {
  it("orders pipeline stages canonically", () => {
    const rows = agentLatencyRows({ generator: 2000, router: 100, retrieval: 500 });
    expect(rows.map((r) => r.label)).toEqual(["Router", "Retriever", "Generator"]);
    expect(rows[0].display).toBe("100 ms");
  });
});
