import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_DIRECT_GATEWAY = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

function getAiConfig() {
  const geminiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || process.env["VITE_GEMINI_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];

  if (geminiKey) {
    return {
      provider: "gemini" as const,
      key: geminiKey,
      endpoint: GEMINI_DIRECT_GATEWAY,
    };
  }
  if (lovableKey) {
    return {
      provider: "lovable" as const,
      key: lovableKey,
      endpoint: LOVABLE_GATEWAY,
    };
  }
  return null;
}

type Crit = { id: string; name: string; description: string | null; instructions: string | null; max_marks: number; weight: number; position: number };
type AiCrit = { criterion_id: string; marks: number; explanation: string; evidence: string; confidence: number; insufficient_evidence: boolean };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "confidence", "criteria"],
  properties: {
    summary: { type: "string" },
    confidence: { type: "number" },
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterion_id", "marks", "explanation", "evidence", "confidence", "insufficient_evidence"],
        properties: {
          criterion_id: { type: "string" },
          marks: { type: "number" },
          explanation: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "number" },
          insufficient_evidence: { type: "boolean" },
        },
      },
    },
  },
};

const FOCUS: Record<string, string> = {
  pdf: "You are evaluating the team's project PDF document (extracted text).",
  github: "You are evaluating the team's GitHub source code. Judge the quality of the actual code shown. Never award marks for file count or lines of code.",
  website: "You are evaluating the team's deployed website from a static inspection of its public pages. Only credit features that are observable in the evidence. Do not assume features work because they are mentioned elsewhere.",
};

async function callAI(model: string, system: string, user: string) {
  const config = getAiConfig();
  if (!config) {
    throw Object.assign(
      new Error("AI is not configured. Please add GEMINI_API_KEY in your .env file to enable Gemini 3.1 Flash Lite."),
      { http: 401 }
    );
  }

  // If using direct Google Gemini API, strip "google/" prefix if present
  const resolvedModel = config.provider === "gemini" ? model.replace(/^google\//, "") : model;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.key}`,
  };

  if (config.provider === "lovable") {
    headers["Lovable-API-Key"] = config.key;
    headers["X-Lovable-AIG-SDK"] = "fetch";
  }

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_schema", json_schema: { name: "evaluation", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = body.slice(0, 300);
    try { msg = JSON.parse(body).error?.message ?? JSON.parse(body).message ?? msg; } catch {}
    throw Object.assign(new Error(msg || `AI request failed (${res.status})`), { http: res.status, retryAfter: Number(res.headers.get("retry-after")) || undefined });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", content = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number } = {};
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      const d = l.slice(5).trim();
      if (d === "[DONE]") continue;
      try {
        const j = JSON.parse(d);
        content += j.choices?.[0]?.delta?.content ?? "";
        if (j.usage) usage = j.usage;
      } catch {}
    }
  }
  return { content, usage };
}

export const checkAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const config = getAiConfig();
    return {
      configured: Boolean(config),
      provider: config ? (config.provider === "gemini" ? "Google Gemini API (Direct)" : "Lovable AI Gateway") : "Not configured",
      hasGeminiKey: Boolean(process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || process.env["VITE_GEMINI_API_KEY"]),
      hasLovableKey: Boolean(process.env["LOVABLE_API_KEY"]),
    };
  });

export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const config = getAiConfig();
    if (!config) {
      return {
        success: false,
        error: "No AI API key found. Please add GEMINI_API_KEY in your .env file.",
      };
    }

    const t0 = Date.now();
    try {
      const resolvedModel = config.provider === "gemini" ? "gemini-3.1-flash-lite" : "google/gemini-3.1-flash-lite";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.key}`,
      };
      if (config.provider === "lovable") {
        headers["Lovable-API-Key"] = config.key;
        headers["X-Lovable-AIG-SDK"] = "fetch";
      }

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: resolvedModel,
          messages: [{ role: "user", content: "Reply with 'Connected' if you receive this." }],
          max_tokens: 15,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let msg = body.slice(0, 300);
        try { msg = JSON.parse(body).error?.message ?? msg; } catch {}
        return { success: false, error: msg || `HTTP ${res.status}` };
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() ?? "Connected";
      return {
        success: true,
        provider: config.provider === "gemini" ? "Google Gemini API (Direct)" : "Lovable AI Gateway",
        model: resolvedModel,
        latencyMs: Date.now() - t0,
        reply,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

export const evaluateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: settings } = await sb.from("system_settings").select("*").eq("id", 1).single();
    if (!settings) throw new Error("Not authorised");
    if (settings.quota_exhausted) return { outcome: "quota" as const, message: settings.quota_message };

    // Claim the job atomically (prevents duplicate evaluations).
    const { data: job } = await sb.from("evaluation_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", data.jobId).eq("status", "queued").select().maybeSingle();
    if (!job) return { outcome: "skipped" as const };
    const component = job.component as "pdf" | "github" | "website";
    await sb.from("evaluation_jobs").update({ attempts: job.attempts + 1 }).eq("id", job.id);

    const [{ data: team }, { data: crits }] = await Promise.all([
      sb.from("teams").select("*").eq("id", job.team_id).single(),
      sb.from("evaluation_criteria").select("*").eq("component", component).eq("enabled", true).order("position"),
    ]);
    const criteria = (crits ?? []) as Crit[];
    const { data: evalRow } = await sb.from("evaluations").upsert({ team_id: job.team_id, component, status: "processing", error: null, updated_at: new Date().toISOString() }, { onConflict: "team_id,component" }).select().single();
    if (!team || !evalRow) throw new Error("Team not found");

    const fail = async (msg: string, finalFail: boolean) => {
      await sb.from("evaluation_jobs").update({ status: finalFail ? "failed" : "queued", error: msg, updated_at: new Date().toISOString() }).eq("id", job.id);
      await sb.from("evaluations").update({ status: finalFail ? "failed" : "pending", error: msg }).eq("id", evalRow.id);
    };

    if (!criteria.length) {
      await fail("No enabled criteria for this component", true);
      return { outcome: "failed" as const, message: "No enabled criteria" };
    }

    // 1. Evidence
    let evidence: string | null = null;
    let evidenceError: string | null = null;
    try {
      if (component === "pdf") evidence = team.pdf_text?.trim() ? team.pdf_text.slice(0, 40000) : null;
      else if (component === "github") evidence = team.github_url ? await (await import("./evidence.server")).gatherGithub(team.github_url) : null;
      else evidence = team.website_url ? await (await import("./evidence.server")).gatherWebsite(team.website_url) : null;
    } catch (e) {
      evidenceError = (e as Error).message;
    }

    const save = async (rows: any[], summary: string, confidence: number | null, model: string | null) => {
      const { data: prev } = await sb.from("criterion_scores").select("criterion_name,ai_marks,admin_marks").eq("evaluation_id", evalRow.id);
      await sb.from("criterion_scores").delete().eq("evaluation_id", evalRow.id);
      await sb.from("criterion_scores").insert(rows.map((r: any) => ({ evaluation_id: evalRow.id, ...r })));
      const ai = rows.reduce((s: number, r: any) => s + (r.ai_marks ?? 0), 0);
      const max = rows.reduce((s: number, r: any) => s + r.max_marks, 0);
      await sb.from("evaluations").update({ status: "completed", stale: false, ai_score: ai, final_score: ai, max_score: max, confidence, summary, model, error: null, approved_at: null, approved_by: null, updated_at: new Date().toISOString() }).eq("id", evalRow.id);
      await sb.from("evaluation_history").insert({ team_id: team.id, component, action: prev?.length ? "re-evaluated" : "evaluated", actor: context.userId, details: { ai_score: ai, max, previous: prev ?? [] } });
      await sb.from("evaluation_jobs").update({ status: "done", error: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    };

    if (!evidence) {
      const reason = evidenceError ?? (component === "pdf" ? "No PDF uploaded or no extractable text" : component === "github" ? "No valid GitHub URL" : "No valid website URL");
      await save(
        criteria.map((c) => ({ criterion_id: c.id, criterion_name: c.name, max_marks: c.max_marks, position: c.position, ai_marks: 0, ai_explanation: "Not enough evidence", ai_evidence: reason, confidence: 0, needs_review: true })),
        `Not enough evidence: ${reason}. Flagged for admin review.`, 0, null,
      );
      return { outcome: "done" as const, noEvidence: true };
    }

    // 2. AI call
    const system = `${FOCUS[component]}\nYou must follow ONLY the criteria and maximum marks below, set by the administrator. Evaluate each criterion independently. Marks must be between 0 and the criterion's max. Quote or point to concrete evidence. Never invent evidence; if the evidence is insufficient for a criterion, set insufficient_evidence=true, give a low mark, and write "Not enough evidence" in the explanation. Confidence is 0-1.\nAdmin scoring instructions: ${settings.scoring_instructions ?? ""}\n\nCRITERIA:\n${criteria.map((c) => `- id=${c.id} | ${c.name} | max ${c.max_marks} marks | importance ${c.weight}\n  ${c.description ?? ""} ${c.instructions ? "Instructions: " + c.instructions : ""}`).join("\n")}`;
    const user = `Team: ${team.name}\nProject: ${team.project_title ?? ""}\nDescription: ${team.project_description ?? ""}\n\nEVIDENCE:\n${evidence}`;
    const t0 = Date.now();
    try {
      const { content, usage } = await callAI(settings.model, system, user);
      await sb.from("api_usage_logs").insert({ model: settings.model, component, team_id: team.id, status: "success", http_status: 200, prompt_tokens: usage.prompt_tokens ?? null, completion_tokens: usage.completion_tokens ?? null, duration_ms: Date.now() - t0 });
      const parsed = JSON.parse(content) as { summary: string; confidence: number; criteria: AiCrit[] };
      // 3. Server-side validation: every criterion must be scored once, within bounds.
      const rows = criteria.map((c) => {
        const r = parsed.criteria?.find((x) => x.criterion_id === c.id);
        const valid = r && Number.isFinite(r.marks);
        const marks = valid ? Math.max(0, Math.min(c.max_marks, Math.round(r!.marks * 2) / 2)) : 0;
        return {
          criterion_id: c.id, criterion_name: c.name, max_marks: c.max_marks, position: c.position,
          ai_marks: marks,
          ai_explanation: valid ? r!.explanation : "Not enough evidence (AI returned no valid score)",
          ai_evidence: valid ? r!.evidence : "",
          confidence: valid ? Math.max(0, Math.min(1, r!.confidence)) : 0,
          needs_review: !valid || r!.insufficient_evidence || r!.marks > c.max_marks || r!.marks < 0 || (r!.confidence ?? 0) < 0.5,
        };
      });
      await save(rows, parsed.summary ?? "", Math.max(0, Math.min(1, parsed.confidence ?? 0)), settings.model);
      return { outcome: "done" as const };
    } catch (e) {
      const err = e as Error & { http?: number; retryAfter?: number };
      const http = err.http ?? 0;
      await sb.from("api_usage_logs").insert({ model: settings.model, component, team_id: team.id, status: "error", http_status: http || null, duration_ms: Date.now() - t0, error: err.message.slice(0, 500) });
      if (http === 429) {
        await fail("Rate limited — will retry", false);
        return { outcome: "rate_limited" as const, retryAfter: err.retryAfter ?? 20 };
      }
      if (http === 402 || http === 403) {
        await sb.from("system_settings").update({ quota_exhausted: true, queue_paused: true, quota_message: err.message }).eq("id", 1);
        await fail(err.message, false);
        return { outcome: "quota" as const, message: err.message };
      }
      const final = job.attempts + 1 >= settings.max_retries || http === 400 || http === 401;
      await fail(err.message, final);
      return { outcome: final ? ("failed" as const) : ("retry" as const), message: err.message };
    }
  });
