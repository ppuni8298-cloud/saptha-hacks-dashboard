export type Component = "pdf" | "github" | "website";
export const COMPONENTS: Component[] = ["pdf", "github", "website"];
export const COMPONENT_LABEL: Record<Component, string> = {
  pdf: "Project PDF",
  github: "GitHub Code",
  website: "Deployed Website",
};

export type CriterionScore = { ai_marks: number | null; admin_marks: number | null; max_marks: number };
export type EvalLike = {
  component: string;
  status: string;
  ai_score: number | null;
  final_score: number | null;
  max_score: number | null;
};

/** Final marks for one criterion: admin edit wins, otherwise the AI mark. */
export const effectiveMarks = (c: CriterionScore) => c.admin_marks ?? c.ai_marks ?? 0;

export function sumScores(rows: CriterionScore[]) {
  return {
    ai: rows.reduce((s, r) => s + (r.ai_marks ?? 0), 0),
    final: rows.reduce((s, r) => s + effectiveMarks(r), 0),
    max: rows.reduce((s, r) => s + r.max_marks, 0),
  };
}

/** Percentage (0-100) of a component, or null when there is no usable score. */
export function pct(score: number | null | undefined, max: number | null | undefined) {
  if (score == null || !max) return null;
  return (score / max) * 100;
}

export type Weights = Record<Component, number>;

/**
 * Weighted final score out of 100. Returns null (never zero) when any
 * required component is missing. `mode: "approved"` only counts approved components.
 */
export function weightedFinal(evals: EvalLike[], weights: Weights, mode: "ai" | "approved") {
  const totalW = COMPONENTS.reduce((s, c) => s + (weights[c] ?? 0), 0);
  if (!totalW) return { score: null as number | null, missing: [...COMPONENTS] };
  let score = 0;
  const missing: Component[] = [];
  for (const c of COMPONENTS) {
    const e = evals.find((x) => x.component === c);
    const w = weights[c] ?? 0;
    if (w === 0) continue;
    const ok = e && (mode === "ai" ? e.ai_score != null : e.status === "approved");
    const p = ok ? pct(mode === "ai" ? e!.ai_score : e!.final_score, e!.max_score) : null;
    if (p == null) {
      missing.push(c);
      continue;
    }
    score += (p * w) / totalW;
  }
  return { score: missing.length ? null : Math.round(score * 100) / 100, missing };
}

/** Standard competition ranking ("1,1,3") with tie flags. */
export function rankWithTies<T extends { score: number }>(rows: T[]) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  return sorted.map((r, i) => {
    const first = sorted.findIndex((x) => x.score === r.score);
    const tied = sorted.filter((x) => x.score === r.score).length > 1;
    return { ...r, rank: first + 1, tied, index: i };
  });
}
