import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { statusTone, toStatusTone, StatusBadge } from "./StatusBadge";
import { Badge } from "./Badge";

describe("statusTone", () => {
  it("maps known statuses", () => {
    expect(statusTone("indexed")).toBe("success");
    expect(statusTone("processing")).toBe("info");
    expect(statusTone("queued")).toBe("warning");
    expect(statusTone("failed")).toBe("critical");
    expect(statusTone("anything-else")).toBe("neutral");
  });
});

describe("toStatusTone (vocabulary adapter)", () => {
  it("normalises divergent tone vocabularies onto StatusTone", () => {
    expect(toStatusTone("danger")).toBe("critical");
    expect(toStatusTone("brand")).toBe("ai");
    expect(toStatusTone("success")).toBe("success");
    expect(toStatusTone(undefined)).toBe("neutral");
  });
});

describe("StatusBadge / Badge render", () => {
  it("renders the status label", () => {
    render(<StatusBadge status="indexed" />);
    expect(screen.getByText("indexed")).toBeInTheDocument();
  });
  it("renders badge children", () => {
    render(<Badge tone="success">Healthy</Badge>);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });
});
