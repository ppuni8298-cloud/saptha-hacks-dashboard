import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { rankWithTies } from "@/lib/scoring";
import { exportRows } from "@/lib/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Leaderboard — Assessor" }, { name: "description", content: "Official ranking of approved evaluations." }, { property: "og:title", content: "Leaderboard — Assessor" }, { property: "og:description", content: "Official ranking of approved evaluations." }] }),
  component: Board,
});

const compPct = (t: TeamRow, c: "pdf" | "github" | "website") => {
  const e = t.evals[c];
  return e?.final_score != null && e.max_score ? (Number(e.final_score) / Number(e.max_score)) * 100 : null;
};

function leaderboardRows(rows: TeamRow[], includePending: boolean) {
  const official = rows.filter((t) => t.final_status === "approved" && t.officialFinal != null).map((t) => ({ t, score: t.officialFinal!, official: true }));
  const ranked = rankWithTies(official);
  const pending = includePending ? rows.filter((t) => !(t.final_status === "approved" && t.officialFinal != null)).map((t) => ({ t, score: t.officialFinal ?? t.aiFinal ?? -1, official: false, rank: null as number | null, tied: false })).sort((a, b) => b.score - a.score) : [];
  return [...ranked, ...pending];
}

function Board() {
  const rows = useTeamRows();
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(true);
  const list = useMemo(() => leaderboardRows(rows.data ?? [], pending).filter((x) => !q || x.t.name.toLowerCase().includes(q.toLowerCase()) || x.t.project_title?.toLowerCase().includes(q.toLowerCase())), [rows.data, pending, q]);
  const flat = () => list.map((x) => ({ Rank: x.rank ?? "pending", Team: x.t.name, Project: x.t.project_title, PDF: compPct(x.t, "pdf")?.toFixed(2) ?? "", GitHub: compPct(x.t, "github")?.toFixed(2) ?? "", Website: compPct(x.t, "website")?.toFixed(2) ?? "", Final: x.official ? x.score.toFixed(2) : "", "AI final": x.t.aiFinal?.toFixed(2) ?? "", Status: x.official ? "approved" : x.t.overall, Tied: x.tied ? "yes" : "" }));

  return (
    <>
      <PageHeader title="Leaderboard" desc="Only approved final evaluations are ranked. Pending entries are clearly labelled.">
        <Button variant="secondary" onClick={() => exportRows(flat(), "leaderboard", "csv")}><Download className="size-4" />CSV</Button>
        <Button variant="secondary" onClick={() => exportRows(flat(), "leaderboard", "xlsx")}><Download className="size-4" />Excel</Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Input className="w-64" placeholder="Search teams" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={pending} onCheckedChange={setPending} />Show pending entries</label>
      </div>
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="p-3">Rank</th><th className="p-3">Team</th><th className="p-3">Project</th><th className="p-3 text-right">PDF</th><th className="p-3 text-right">GitHub</th><th className="p-3 text-right">Website</th><th className="p-3 text-right">Final</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {!list.length && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No entries yet.</td></tr>}
            {list.map((x) => (
              <tr key={x.t.id} className={cn("border-b border-border/50", !x.official && "opacity-60")}>
                <td className="p-3 font-display font-semibold">{x.rank != null ? <span className={cn(x.rank <= 3 && "text-primary")}>#{x.rank}{x.tied && <span className="ml-1 rounded bg-warning/20 px-1 text-[10px] text-warning">TIE</span>}</span> : <span className="text-xs text-muted-foreground">pending</span>}</td>
                <td className="p-3"><Link to="/teams/$id" params={{ id: x.t.id }} className="font-medium hover:text-primary">{x.t.name}</Link></td>
                <td className="max-w-60 truncate p-3 text-muted-foreground">{x.t.project_title}</td>
                <td className="p-3 text-right font-mono">{fmt(compPct(x.t, "pdf"))}</td>
                <td className="p-3 text-right font-mono">{fmt(compPct(x.t, "github"))}</td>
                <td className="p-3 text-right font-mono">{fmt(compPct(x.t, "website"))}</td>
                <td className="p-3 text-right font-mono font-semibold">{x.official ? fmt(x.score, 2) : <span className="text-xs text-muted-foreground">AI {fmt(x.t.aiFinal)}</span>}</td>
                <td className="p-3"><StatusBadge status={x.official ? "approved" : x.t.overall} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
