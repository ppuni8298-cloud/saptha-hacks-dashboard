import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileJson, FileSpreadsheet, Loader2, Printer, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useTeamRows } from "@/lib/queries";
import { fetchAll } from "@/lib/db";
import { downloadBlob, exportRows } from "@/lib/export";
import { COMPONENTS } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Reports — Assessor" }, { name: "description", content: "Export evaluation results." }, { property: "og:title", content: "Reports — Assessor" }, { property: "og:description", content: "Export evaluation results." }] }),
  component: Reports,
});

function Reports() {
  const rows = useTeamRows();
  const [busy, setBusy] = useState(false);
  const summary = () => (rows.data ?? []).map((t) => ({
    Team: t.name, Email: t.email, Project: t.project_title,
    ...Object.fromEntries(COMPONENTS.flatMap((c) => { const e = t.evals[c]; return [[`${c} AI`, e?.ai_score ?? ""], [`${c} final`, e?.final_score ?? ""], [`${c} max`, e?.max_score ?? ""], [`${c} status`, e?.status ?? "not started"]]; })),
    "AI final /100": t.aiFinal ?? "", "Approved final /100": t.approvedFinal ?? "", Override: t.final_override ?? "", "Final status": t.final_status, Remarks: t.remarks ?? "",
  }));

  const detailed = async () => {
    setBusy(true);
    try {
      const [members, scores, { data: crit }] = await Promise.all([fetchAll<any>("team_members", "*", "position"), fetchAll<any>("criterion_scores", "*", "position"), supabase.from("evaluation_criteria").select("*")]);
      const report = {
        generated_at: new Date().toISOString(), criteria: crit,
        teams: (rows.data ?? []).map((t) => ({
          ...t, pdf_text: undefined,
          members: members.filter((m) => m.team_id === t.id),
          evaluations: Object.fromEntries(COMPONENTS.map((c) => [c, t.evals[c] ? { ...t.evals[c], criteria: scores.filter((s) => s.evaluation_id === t.evals[c]!.id) } : null])),
        })),
      };
      downloadBlob(JSON.stringify(report, null, 2), "evaluation-report.json", "application/json");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Reports" desc="Download results for the whole event." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl p-6 border-primary/30 relative overflow-hidden">
          <div className="absolute top-2 right-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">New</div>
          <CheckCircle2 className="size-6 text-primary" />
          <h3 className="mt-3 font-semibold">Qualification & Scorecards</h3>
          <p className="mt-1 text-sm text-muted-foreground">Instant team ticking qualification, plagiarism checks, and 1-page printable official PDF scorecards.</p>
          <Button size="sm" className="mt-4" asChild><Link to="/qualification">Open Qualification</Link></Button>
        </div>
        <div className="glass rounded-2xl p-6"><FileSpreadsheet className="size-6 text-primary" /><h3 className="mt-3 font-semibold">Summary spreadsheet</h3><p className="mt-1 text-sm text-muted-foreground">One row per team with every component score and status.</p>
          <div className="mt-4 flex gap-2"><Button size="sm" onClick={() => exportRows(summary(), "evaluation-summary", "csv")}>CSV</Button><Button size="sm" variant="secondary" onClick={() => exportRows(summary(), "evaluation-summary", "xlsx")}>Excel</Button></div></div>
        <div className="glass rounded-2xl p-6"><FileJson className="size-6 text-violet" /><h3 className="mt-3 font-semibold">Detailed JSON</h3><p className="mt-1 text-sm text-muted-foreground">Members, criteria, criterion-level AI and admin marks, explanations and evidence.</p>
          <Button size="sm" className="mt-4" onClick={detailed} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}Download JSON</Button></div>
        <div className="glass rounded-2xl p-6"><Printer className="size-6 text-success" /><h3 className="mt-3 font-semibold">Individual PDF reports</h3><p className="mt-1 text-sm text-muted-foreground">Open a team and use “PDF report” to save its full evaluation as PDF.</p>
          <Button size="sm" variant="secondary" className="mt-4" asChild><Link to="/teams">Choose team</Link></Button></div>
      </div>
    </>
  );
}
