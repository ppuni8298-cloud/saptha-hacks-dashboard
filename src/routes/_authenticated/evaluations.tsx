import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useTeamRows } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Evaluations — Assessor" }, { name: "description", content: "Review every component evaluation." }, { property: "og:title", content: "Evaluations — Assessor" }, { property: "og:description", content: "Review every component evaluation." }] }),
  component: Evals,
});

function Evals() {
  const rows = useTeamRows();
  const [comp, setComp] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => (rows.data ?? []).flatMap((t) => COMPONENTS.map((c) => ({ t, c, e: t.evals[c] })))
    .filter((x) => comp === "all" || x.c === comp)
    .filter((x) => status === "all" || (status === "stale" ? x.e?.stale : (x.e?.status ?? "not started") === status))
    .filter((x) => !q || x.t.name.toLowerCase().includes(q.toLowerCase())), [rows.data, comp, status, q]);

  return (
    <>
      <PageHeader title="Evaluations" desc="Every PDF, GitHub and website evaluation, independently." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="w-64" placeholder="Search team" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={comp} onValueChange={setComp}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All components</SelectItem>{COMPONENTS.map((c) => <SelectItem key={c} value={c}>{COMPONENT_LABEL[c]}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{["all", "not started", "pending", "processing", "completed", "approved", "failed", "stale"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="p-3">Team</th><th className="p-3">Component</th><th className="p-3 text-right">AI</th><th className="p-3 text-right">Final</th><th className="p-3 text-right">Confidence</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {!list.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nothing matches.</td></tr>}
            {list.slice(0, 600).map(({ t, c, e }) => (
              <tr key={t.id + c} className="border-b border-border/50 hover:bg-accent/30">
                <td className="p-3"><Link to="/teams/$id" params={{ id: t.id }} className="hover:text-primary">{t.name}</Link></td>
                <td className="p-3">{COMPONENT_LABEL[c]}</td>
                <td className="p-3 text-right font-mono">{fmt(e?.ai_score)}</td>
                <td className="p-3 text-right font-mono">{fmt(e?.final_score)}<span className="text-muted-foreground">/{fmt(e?.max_score)}</span></td>
                <td className="p-3 text-right font-mono">{e?.confidence != null ? `${Math.round(Number(e.confidence) * 100)}%` : "—"}</td>
                <td className="flex gap-1 p-3"><StatusBadge status={e?.status ?? "not started"} />{e?.stale && <StatusBadge status="stale" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
