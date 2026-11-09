import { type TeamRow } from "./queries";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./db";

export type PlagiarismResult = {
  teamId: string;
  teamName: string;
  similarityScore: number; // 0 to 100
  isFlagged: boolean; // true if score >= 35%
  severity: "clean" | "low" | "medium" | "high";
  matchedWith: { teamId: string; teamName: string; similarity: number; reason: string }[];
  duplicateRepo: boolean;
  notes: string[];
};

function normalizeUrl(url?: string | null): string {
  if (!url) return "";
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function tokenize(text?: string | null): Set<string> {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return new Set(words);
}

export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

export function calculateSimilarity(textA?: string | null, textB?: string | null): number {
  return calculateJaccardSimilarity(tokenize(textA), tokenize(textB));
}

export { tokenize };

export function runFastPlagiarismCheck(teams: TeamRow[]): Map<string, PlagiarismResult> {
  const results = new Map<string, PlagiarismResult>();

  // Pre-tokenize and extract metadata
  const parsed = teams.map((t) => ({
    team: t,
    repo: normalizeUrl(t.github_url),
    pdfTokens: tokenize(t.pdf_text),
    descTokens: tokenize(t.project_description),
    titleTokens: tokenize(t.project_title),
  }));

  for (let i = 0; i < parsed.length; i++) {
    const a = parsed[i];
    const matches: { teamId: string; teamName: string; similarity: number; reason: string }[] = [];
    const notes: string[] = [];
    let maxSim = 0;
    let duplicateRepo = false;

    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue;
      const b = parsed[j];

      // 1. Check duplicate GitHub repo
      if (a.repo && b.repo && a.repo === b.repo) {
        duplicateRepo = true;
        maxSim = 100;
        matches.push({
          teamId: b.team.id,
          teamName: b.team.name,
          similarity: 100,
          reason: `Identical GitHub repository: ${a.team.github_url}`,
        });
        notes.push(`Exact duplicate repository submitted by "${b.team.name}"`);
      }

      // 2. Check text similarities (PDF extracted text & project description)
      const pdfSim = calculateJaccardSimilarity(a.pdfTokens, b.pdfTokens);
      const descSim = calculateJaccardSimilarity(a.descTokens, b.descTokens);
      const overallSim = Math.max(pdfSim, descSim);

      if (overallSim >= 35 && !duplicateRepo) {
        maxSim = Math.max(maxSim, overallSim);
        matches.push({
          teamId: b.team.id,
          teamName: b.team.name,
          similarity: overallSim,
          reason: pdfSim > descSim ? `${pdfSim}% PDF text similarity` : `${descSim}% Description overlap`,
        });
        notes.push(`${overallSim}% content overlap with "${b.team.name}"`);
      }
    }

    let severity: PlagiarismResult["severity"] = "clean";
    if (maxSim >= 65 || duplicateRepo) severity = "high";
    else if (maxSim >= 35) severity = "medium";
    else if (maxSim > 15) severity = "low";

    results.set(a.team.id, {
      teamId: a.team.id,
      teamName: a.team.name,
      similarityScore: maxSim,
      isFlagged: maxSim >= 35 || duplicateRepo,
      severity,
      matchedWith: matches,
      duplicateRepo,
      notes,
    });
  }

  return results;
}

export async function applyPlagiarismDeduction(
  team: TeamRow,
  plagiarism: PlagiarismResult,
  customScore?: number
): Promise<void> {
  const penaltyScore =
    customScore !== undefined
      ? customScore
      : plagiarism.severity === "high"
      ? 0
      : Math.max(0, (team.officialFinal ?? team.aiFinal ?? 50) - 30);

  const reason = `Plagiarism check penalty: ${plagiarism.notes.join("; ")}`;

  // Update team override in Supabase
  await supabase
    .from("teams")
    .update({
      final_override: penaltyScore,
      override_reason: reason,
      final_status: plagiarism.severity === "high" ? "rejected" : team.final_status,
      remarks: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", team.id);

  // Record history
  const user = (await supabase.auth.getUser()).data.user?.id ?? null;
  await supabase.from("evaluation_history").insert({
    team_id: team.id,
    action: "plagiarism_penalty",
    actor: user,
    details: { penaltyScore, reason, matches: plagiarism.matchedWith },
  });

  await logActivity("Plagiarism penalty applied", `${team.name} -> score adjusted to ${penaltyScore}`);
}

