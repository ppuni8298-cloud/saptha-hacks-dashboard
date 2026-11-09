import { supabase } from "@/integrations/supabase/client";
import type { Component } from "./scoring";

export async function logActivity(action: string, details?: string) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("activity_logs").insert({ actor: data.user?.id ?? null, actor_email: data.user?.email ?? null, action, details: details ?? null });
}

/** Fetch all rows past the 1000-row API cap. */
export async function fetchAll<T>(table: string, select = "*", order = "created_at"): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase.from(table as any) as any).select(select).order(order).range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function enqueue(teamIds: string[], components: Component[]) {
  const rows = teamIds.flatMap((team_id) => components.map((component) => ({ team_id, component })));
  // Skip teams that already have an active job for that component (no duplicates).
  const { data: act } = await supabase.from("evaluation_jobs").select("team_id,component").in("status", ["queued", "processing"]).limit(5000);
  const key = new Set((act ?? []).map((a) => a.team_id + a.component));
  const fresh = rows.filter((r) => !key.has(r.team_id + r.component));
  let added = 0;
  for (let i = 0; i < fresh.length; i += 500) {
    const { error, count } = await supabase.from("evaluation_jobs").insert(fresh.slice(i, i + 500), { count: "exact" });
    if (error) throw error;
    added += count ?? 0;
  }
  await logActivity("Queued evaluations", `${added} job(s): ${components.join(", ")}`);
  return added;
}

