import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchAll } from "./db";
import { COMPONENTS, weightedFinal, type Component, type Weights } from "./scoring";

export type Team = Tables<"teams">;
export type Evaluation = Tables<"evaluations">;

export const useWeights = () =>
  useQuery({
    queryKey: ["weights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("evaluation_components").select("*");
      if (error) throw error;
      return Object.fromEntries(data.map((c) => [c.key, Number(c.weight)])) as Weights;
    },
  });

export const useSettings = () =>
  useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

export type TeamRow = Team & {
  evals: Partial<Record<Component, Evaluation>>;
  aiFinal: number | null;
  approvedFinal: number | null;
  officialFinal: number | null;
  missing: Component[];
  overall: string;
};

export function overallStatus(t: Team, evals: Partial<Record<Component, Evaluation>>) {
  if (t.final_status === "approved") return "approved";
  if (t.final_status === "rejected") return "rejected";
  const list = COMPONENTS.map((c) => evals[c]);
  if (list.some((e) => e?.status === "processing")) return "processing";
  if (list.some((e) => e?.status === "failed")) return "failed";
  if (list.some((e) => e?.stale)) return "stale";
  if (list.every((e) => e && ["completed", "approved"].includes(e.status))) return "completed";
  return "pending";
}

export const useTeamRows = () => {
  const weights = useWeights();
  return useQuery({
    queryKey: ["team-rows", weights.data],
    enabled: !!weights.data,
    queryFn: async () => {
      const [teams, evals] = await Promise.all([fetchAll<Team>("teams"), fetchAll<Evaluation>("evaluations")]);
      const byTeam = new Map<string, Evaluation[]>();
      evals.forEach((e) => byTeam.set(e.team_id, [...(byTeam.get(e.team_id) ?? []), e]));
      return teams.map((t): TeamRow => {
        const list = byTeam.get(t.id) ?? [];
        const ev = Object.fromEntries(list.map((e) => [e.component, e])) as TeamRow["evals"];
        const norm = list.map((e) => ({ ...e, ai_score: e.ai_score, final_score: e.final_score, max_score: e.max_score }));
        const ai = weightedFinal(norm, weights.data!, "ai");
        const ap = weightedFinal(norm, weights.data!, "approved");
        return {
          ...t,
          evals: ev,
          aiFinal: ai.score,
          approvedFinal: ap.score,
          officialFinal: t.final_override ?? ap.score,
          missing: ap.missing,
          overall: overallStatus(t, ev),
        };
      });
    },
  });
};
