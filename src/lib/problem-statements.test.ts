import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROBLEM_STATEMENTS,
  formatProblemStatementLabel,
} from "./problem-statements";

describe("Problem Statements Service", () => {
  it("provides valid default problem statements", () => {
    expect(DEFAULT_PROBLEM_STATEMENTS.length).toBeGreaterThan(0);
    for (const ps of DEFAULT_PROBLEM_STATEMENTS) {
      expect(ps.code).toMatch(/^PS-\d+$/);
      expect(ps.title.length).toBeGreaterThan(5);
      expect(ps.category.length).toBeGreaterThan(2);
      expect(ps.description.length).toBeGreaterThan(10);
    }
  });

  it("formats problem statement label correctly", () => {
    const label = formatProblemStatementLabel({
      id: "123",
      code: "PS-01",
      title: "Smart Traffic Flow Optimization",
      category: "Smart Cities",
      description: "Sample description",
    });

    expect(label).toBe("[PS-01] Smart Traffic Flow Optimization");
  });
});

