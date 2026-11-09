import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { useSettings } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "API usage — Assessor" }, { name: "description", content: "AI request and token usage." }, { property: "og:title", content: "API usage — Assessor" }, { property: "og:description", content: "AI request and token usage." }] }),
  component: Usage,
});

const useUsage = () => useQuery({
  queryKey: ["usage"],
  queryFn: async () => (await supabase.from("api_usage_logs").select("*").gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()).order("created_at", { ascending: false }).limit(1000)).data ?? [],
});

function Usage() {
  const usage = useUsage();
  const settings = useSettings();
  const logs = usage.data ?? [];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const todayLogs = logs.filter((l) => new Date(l.created_at) >= today);
  const tokens = (ls: typeof logs) => ls.reduce((s, l) => s + (l.prompt_tokens ?? 0) + (l.completion_tokens ?? 0), 0);
  const limit = settings.data?.daily_request_limit ?? 0;
  const byHour = Array.from({ length: 24 }, (_, h) => ({ h: `${h}:00`, ok: todayLogs.filter((l) => new Date(l.created_at).getUTCHours() === h && l.status === "success").length, err: todayLogs.filter((l) => new Date(l.created_at).getUTCHours() === h && l.status !== "success").length }));
  const stat = (k: string, v: string | number, sub?: string) => <div className="glass rounded-2xl p-5"><div className="text-xs uppercase text-muted-foreground">{k}</div><div className="mt-1 font-display text-2xl font-semibold">{v}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div>;

  return (
    <>
      <PageHeader title="API usage" desc={`Model: ${settings.data?.model ?? "–"} · counted per request in UTC days`} />
      <div className="grid gap-4 md:grid-cols-4">
        {stat("Requests today", todayLogs.length, `of ${limit} daily limit`)}
        {stat("Remaining today", Math.max(0, limit - todayLogs.length), "app-side limit")}
        {stat("Tokens today", tokens(todayLogs).toLocaleString())}
        {stat("Errors today", todayLogs.filter((l) => l.status !== "success").length, `${tokens(logs).toLocaleString()} tokens / 7 days`)}
      </div>
      <div className="glass mt-4 h-64 rounded-2xl p-4">
        <ResponsiveContainer><BarChart data={byHour}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="h" stroke="var(--muted-foreground)" fontSize={10} /><YAxis stroke="var(--muted-foreground)" fontSize={10} allowDecimals={false} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Bar dataKey="ok" stackId="a" fill="var(--chart-1)" name="Success" /><Bar dataKey="err" stackId="a" fill="var(--chart-5)" name="Error" /></BarChart></ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">AI usage is billed to your workspace credits; check remaining balance in Settings → Plans & credits.</p>
      <div className="glass mt-4 overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="p-3">Time</th><th className="p-3">Component</th><th className="p-3">Status</th><th className="p-3 text-right">Tokens in/out</th><th className="p-3 text-right">Duration</th><th className="p-3">Error</th></tr></thead>
          <tbody>
            {!logs.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No AI requests yet.</td></tr>}
            {logs.slice(0, 200).map((l) => (
              <tr key={l.id} className="border-b border-border/50">
                <td className="p-3 text-xs">{new Date(l.created_at).toLocaleString()}</td><td className="p-3">{l.component}</td>
                <td className="p-3"><StatusBadge status={l.status === "success" ? "done" : "failed"} /></td>
                <td className="p-3 text-right font-mono text-xs">{l.prompt_tokens ?? "–"} / {l.completion_tokens ?? "–"}</td>
                <td className="p-3 text-right font-mono text-xs">{l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : "–"}</td>
                <td className="max-w-80 truncate p-3 text-xs text-destructive" title={l.error ?? ""}>{l.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
