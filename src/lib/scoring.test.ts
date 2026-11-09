import { describe, it, expect } from "vitest";
import { weightedFinal, effectiveMarks, rankWithTies } from "./scoring";

const W = { pdf: 30, github: 40, website: 30 };
const ev = (component: string, status: string, ai: number, fin: number) => ({
  component, status, ai_score: ai, final_score: fin, max_score: 100,
});

describe("scoring", () => {
  it("applies 30/40/30 weights", () => {
    const r = weightedFinal([ev("pdf", "approved", 80, 80), ev("github", "approved", 50, 50), ev("website", "approved", 100, 100)], W, "approved");
    expect(r.score).toBe(74);
  });
  it("never treats a missing component as zero", () => {
    const r = weightedFinal([ev("pdf", "approved", 80, 80), ev("github", "approved", 50, 50)], W, "approved");
    expect(r.score).toBeNull();
    expect(r.missing).toEqual(["website"]);
  });
  it("unapproved components don't count toward the approved score", () => {
    const r = weightedFinal([ev("pdf", "completed", 80, 80), ev("github", "approved", 50, 50), ev("website", "approved", 100, 100)], W, "approved");
    expect(r.score).toBeNull();
  });
  it("admin marks override AI marks", () => {
    expect(effectiveMarks({ ai_marks: 7, admin_marks: 9, max_marks: 10 })).toBe(9);
    expect(effectiveMarks({ ai_marks: 7, admin_marks: null, max_marks: 10 })).toBe(7);
  });
  it("ties share a rank", () => {
    const r = rankWithTies([{ score: 90 }, { score: 80 }, { score: 90 }]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 3]);
  });
});
