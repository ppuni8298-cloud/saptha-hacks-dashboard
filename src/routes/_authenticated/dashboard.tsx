import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSettings, useTeamRows } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { useQueueRunner } from "@/lib/queue-runner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Dashboard — Assessor" }, { name: "description", content: "Event-wide evaluation progress." }, { property: "og:title", content: "Dashboard — Assessor" }, { property: "og:description", content: "Event-wide evaluation progress." }] }),
  component: Dashboard,
});

function Dashboard() {
  const rows = useTeamRows();
  const settings = useSettings();
  const runner = useQueueRunner();
  const activity = useQuery({ queryKey: ["activity-recent"], queryFn: async () => (await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(8)).data ?? [] });
  const usage = useQuery({
    queryKey: ["usage-today"],
    queryFn: async () => {
      const d = new Date(); d.setUTCHours(0, 0, 0, 0);
      return (await supabase.from("api_usage_logs").select("id", { count: "exact", head: true }).gte("created_at", d.toISOString())).count ?? 0;
    },
  });
  const jobs = useQuery({ queryKey: ["jobs-counts"], refetchInterval: runner.running ? 5000 : false, queryFn: async () => (await supabase.from("evaluation_jobs").select("status").in("status", ["queued", "processing"]).limit(2000)).data ?? [] });

  const s = useMemo(() => {
    const t = rows.data ?? [];
    const scored = t.map((x) => x.officialFinal ?? x.aiFinal).filter((v): v is number => v != null);
    const by = (st: string) => t.filter((x) => x.overall === st).length;
    const dist = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i * 10 + 10}`, n: scored.filter((v) => Math.min(9, Math.floor(v / 10)) === i).length }));
    const comp = COMPONENTS.map((c) => ({ c, done: t.filter((x) => ["completed", "approved"].includes(x.evals[c]?.status ?? "")).length, approved: t.filter((x) => x.evals[c]?.status === "approved").length }));
    return { total: t.length, evaluated: t.filter((x) => x.aiFinal != null).length, pending: by("pending"), processing: by("processing"), failed: by("failed"), approved: by("approved"), avg: scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null, max: scored.length ? Math.max(...scored) : null, dist, comp, status: ["pending", "processing", "completed", "stale", "failed", "approved", "rejected"].map((k) => ({ k, n: by(k) })).filter((x) => x.n) };
  }, [rows.data]);

  if (rows.isLoading) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="glass h-28 animate-pulse rounded-2xl" />)}</div>;
  if (!s.total) return (<><PageHeader title="Dashboard" /><Empty title="No teams registered yet" desc="Add teams or import a spreadsheet to begin."><Button asChild><Link to="/teams/new">Add team</Link></Button><Button variant="secondary" asChild><Link to="/import">Bulk import</Link></Button></Empty></>);

  const cards = [["Total teams", s.total], ["Evaluated", s.evaluated], ["Pending", s.pending], ["Processing", s.processing], ["Failed", s.failed], ["Approved", s.approved], ["Average score", fmt(s.avg)], ["Highest score", fmt(s.max)]] as const;
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary)", "var(--muted-foreground)"];
  const queued = jobs.data?.filter((j) => j.status === "queued").length ?? 0;

  return (
    <>
      <PageHeader title="Dashboard" desc="Live overview of the evaluation event.">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild><Link to="/problem-statements">Problem Statements</Link></Button>
          <Button variant="secondary" size="sm" asChild><Link to="/qualification">Qualification</Link></Button>
          <Button size="sm" asChild><Link to="/queue">{runner.running ? "Queue running…" : "Open queue"}</Link></Button>
        </div>
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(([k, v], i) => (
          <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="mt-2 font-display text-3xl font-semibold">{v}</div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="font-semibold">Score distribution</h3>
          <div className="mt-3 h-60"><ResponsiveContainer><BarChart data={s.dist}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={11} /><YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /><Bar dataKey="n" name="Teams" fill="var(--chart-1)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold">Status</h3>
          <div className="h-44"><ResponsiveContainer><PieChart><Pie data={s.status} dataKey="n" nameKey="k" innerRadius={45} outerRadius={70} paddingAngle={2}>{s.status.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} /></PieChart></ResponsiveContainer></div>
          <div className="flex flex-wrap gap-2 text-xs">{s.status.map((x, i) => <span key={x.k} className="flex items-center gap-1 capitalize"><span className="size-2 rounded-full" style={{ background: colors[i % colors.length] }} />{x.k} {x.n}</span>)}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="glass space-y-4 rounded-2xl p-5">
          <h3 className="font-semibold">Component progress</h3>
          {s.comp.map((c) => (
            <div key={c.c}><div className="mb-1 flex justify-between text-sm"><span>{COMPONENT_LABEL[c.c]}</span><span className="font-mono text-xs text-muted-foreground">{c.done}/{s.total} · {c.approved} approved</span></div><Progress value={(c.done / s.total) * 100} /></div>
          ))}
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold">Queue & AI usage</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Queue</span><span>{runner.running ? "running" : "idle"} · {queued} waiting</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Requests today</span><span className="font-mono">{usage.data ?? 0} / {settings.data?.daily_request_limit}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Remaining today</span><span className="font-mono">{Math.max(0, (settings.data?.daily_request_limit ?? 0) - (usage.data ?? 0))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Model</span><span className="text-xs">{settings.data?.model}</span></div>
            {settings.data?.quota_exhausted && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">Stopped: {settings.data.quota_message}</p>}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold">Recent activity</h3>
          <div className="mt-3 space-y-2 text-sm">
            {!activity.data?.length && <p className="text-muted-foreground">Nothing yet.</p>}
            {activity.data?.map((a) => <div key={a.id}><div className="truncate">{a.action}{a.details && <span className="text-muted-foreground"> · {a.details}</span>}</div><div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div></div>)}
          </div>
        </div>
      </div>
    </>
  );
}
