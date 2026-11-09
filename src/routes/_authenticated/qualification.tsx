import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Search,
  Printer,
  ShieldCheck,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  Check,
  Sparkles,
  ArrowUpDown,
  X,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt, StatusBadge } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { logActivity } from "@/lib/db";
import { runFastPlagiarismCheck, applyPlagiarismDeduction, type PlagiarismResult } from "@/lib/plagiarism";
import { TeamReportCard } from "@/components/team-report-card";

export const Route = createFileRoute("/_authenticated/qualification")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Team Qualification — INNOVEDGE Assessor" },
      { name: "description", content: "Shortlist qualified teams and print official 1-page reports with plagiarism check." },
      { property: "og:title", content: "Team Qualification — INNOVEDGE Assessor" },
      { property: "og:description", content: "Shortlist qualified teams and print official 1-page reports with plagiarism check." },
    ],
  }),
  component: QualificationPage,
});

export function QualificationPage() {
  const qc = useQueryClient();
  const rows = useTeamRows();
  const teams = rows.data ?? [];

  // Search & Filter State
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "qualified" | "not_qualified" | "flagged">("all");
  const [selectedPs, setSelectedPs] = useState("all");
  const [sortBy, setSortBy] = useState<"score_desc" | "name_asc" | "plagiarism_desc">("score_desc");

  // Selected Team for 1-Page PDF Report Modal
  const [reportTeam, setReportTeam] = useState<TeamRow | null>(null);

  // Plagiarism Results Map
  const [plagiarismMap, setPlagiarismMap] = useState<Map<string, PlagiarismResult>>(() =>
    runFastPlagiarismCheck(teams)
  );
  const [hasRunPlagiarismCheck, setHasRunPlagiarismCheck] = useState(false);

  // Compute stats
  const totalCount = teams.length;
  const qualifiedCount = teams.filter((t) => t.final_status === "approved" || t.final_status === "qualified").length;
  const flaggedCount = Array.from(plagiarismMap.values()).filter((p) => p.isFlagged).length;

  // Extract unique problem statements
  const problemStatements = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.project_title) {
        const match = t.project_title.match(/^\[([^\]]+)\]/);
        set.add(match ? match[1] : t.project_title);
      }
    });
    return Array.from(set);
  }, [teams]);

  // Run Plagiarism Check
  const handleRunPlagiarism = () => {
    const res = runFastPlagiarismCheck(teams);
    setPlagiarismMap(res);
    setHasRunPlagiarismCheck(true);
    const flagged = Array.from(res.values()).filter((p) => p.isFlagged).length;
    if (flagged > 0) {
      toast.warning(`Plagiarism scan complete: ${flagged} team(s) flagged for similarity or duplicate code.`);
    } else {
      toast.success("Plagiarism scan complete: All teams are clean with no significant overlap!");
    }
  };

  // Toggle Qualification Tick for a Team
  const handleToggleQualify = async (team: TeamRow, currentlyQualified: boolean) => {
    const nextStatus = currentlyQualified ? "pending" : "approved";

    try {
      const { error } = await supabase
        .from("teams")
        .update({
          final_status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", team.id);

      if (error) throw error;

      await logActivity(
        nextStatus === "approved" ? "Qualified team" : "Unmarked qualified team",
        `${team.name} -> ${nextStatus}`
      );

      qc.invalidateQueries({ queryKey: ["team-rows"] });
      toast.success(
        nextStatus === "approved"
          ? `✓ ${team.name} marked as QUALIFIED for Round 2`
          : `${team.name} qualification status reset to Pending`
      );
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Auto-Qualify Teams with score >= 70%
  const handleAutoQualifyTop = async () => {
    const toQualify = teams.filter(
      (t) => (t.officialFinal ?? t.aiFinal ?? 0) >= 70 && t.final_status !== "qualified" && t.final_status !== "approved"
    );

    if (toQualify.length === 0) {
      return toast.info("No new teams with score >= 70% found to auto-qualify.");
    }

    if (!confirm(`Auto-qualify ${toQualify.length} team(s) with score >= 70%?`)) return;

    try {
      await supabase
        .from("teams")
        .update({ final_status: "approved", updated_at: new Date().toISOString() })
        .in(
          "id",
          toQualify.map((t) => t.id)
        );

      await logActivity("Bulk auto-qualified teams", `${toQualify.length} teams qualified`);
      qc.invalidateQueries({ queryKey: ["team-rows"] });
      toast.success(`Successfully qualified ${toQualify.length} high-scoring teams!`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Apply Plagiarism Deduction
  const handleApplyPenalty = async (team: TeamRow) => {
    const plag = plagiarismMap.get(team.id);
    if (!plag) return;

    if (!confirm(`Apply penalty to "${team.name}" for ${plag.similarityScore}% similarity? This will update their final marks.`)) return;

    try {
      await applyPlagiarismDeduction(team, plag);
      qc.invalidateQueries({ queryKey: ["team-rows"] });
      toast.success(`Plagiarism penalty applied to ${team.name}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Filtered and Sorted Teams
  const filteredTeams = useMemo(() => {
    const term = q.toLowerCase();

    return teams
      .filter((t) => {
        // Search filter
        const matchesQuery =
          !term ||
          t.name.toLowerCase().includes(term) ||
          (t.email && t.email.toLowerCase().includes(term)) ||
          (t.project_title && t.project_title.toLowerCase().includes(term)) ||
          (t.remarks && t.remarks.toLowerCase().includes(term));

        // Status filter
        const isQualified = t.final_status === "approved" || t.final_status === "qualified";
        const isFlagged = plagiarismMap.get(t.id)?.isFlagged ?? false;

        let matchesStatus = true;
        if (statusFilter === "qualified") matchesStatus = isQualified;
        else if (statusFilter === "not_qualified") matchesStatus = !isQualified;
        else if (statusFilter === "flagged") matchesStatus = isFlagged;

        // Problem statement filter
        const matchesPs =
          selectedPs === "all" ||
          (t.project_title && t.project_title.toLowerCase().includes(selectedPs.toLowerCase()));

        return matchesQuery && matchesStatus && matchesPs;
      })
      .sort((a, b) => {
        if (sortBy === "score_desc") {
          const scoreA = a.officialFinal ?? a.aiFinal ?? -1;
          const scoreB = b.officialFinal ?? b.aiFinal ?? -1;
          return scoreB - scoreA;
        }
        if (sortBy === "name_asc") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "plagiarism_desc") {
          const simA = plagiarismMap.get(a.id)?.similarityScore ?? 0;
          const simB = plagiarismMap.get(b.id)?.similarityScore ?? 0;
          return simB - simA;
        }
        return 0;
      });
  }, [teams, q, statusFilter, selectedPs, sortBy, plagiarismMap]);

  return (
    <>
      <PageHeader
        title="Team Qualification"
        desc="Tick teams to shortlist them for the next round. Generate certified 1-page reports with watermark and run fast plagiarism audits."
      >
        <Button variant="outline" onClick={handleRunPlagiarism} className="gap-2">
          <ShieldCheck className="size-4 text-primary" />
          Run Plagiarism Check
        </Button>
        <Button variant="secondary" onClick={handleAutoQualifyTop} className="gap-1.5">
          <Sparkles className="size-4 text-amber-500" />
          Auto-Qualify (&ge;70%)
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="size-4" />
          Print Qualified List
        </Button>
      </PageHeader>

      {/* Stats Cards Banner */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary font-bold">
            {totalCount}
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase">Total Teams</div>
            <div className="text-lg font-bold text-foreground">{totalCount} Registered</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 flex items-center gap-3 border-emerald-500/20 bg-emerald-500/[0.03]">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase">Qualified</div>
            <div className="text-lg font-bold text-emerald-600">{qualifiedCount} Shortlisted</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 font-bold">
            {totalCount - qualifiedCount}
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase">Pending Review</div>
            <div className="text-lg font-bold text-foreground">{totalCount - qualifiedCount} Teams</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 flex items-center gap-3 border-rose-500/20 bg-rose-500/[0.03]">
          <div className="grid size-10 place-items-center rounded-xl bg-rose-500/10 text-rose-600 font-bold">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase">Plagiarism Flagged</div>
            <div className="text-lg font-bold text-rose-600">{flaggedCount} Teams</div>
          </div>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search teams by name, email, problem statement..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-48 bg-background">
            <SelectValue placeholder="Qualification Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams ({totalCount})</SelectItem>
            <SelectItem value="qualified">Qualified Only ({qualifiedCount})</SelectItem>
            <SelectItem value="not_qualified">Not Qualified ({totalCount - qualifiedCount})</SelectItem>
            <SelectItem value="flagged">Plagiarism Flagged ({flaggedCount})</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedPs} onValueChange={setSelectedPs}>
          <SelectTrigger className="w-48 bg-background">
            <SelectValue placeholder="Problem Statement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Challenges</SelectItem>
            {problemStatements.map((ps) => (
              <SelectItem key={ps} value={ps}>
                {ps}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder="Sort order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score_desc">Score: High to Low</SelectItem>
            <SelectItem value="name_asc">Name: Alphabetical</SelectItem>
            <SelectItem value="plagiarism_desc">Plagiarism: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Teams Qualification Table */}
      {rows.isLoading ? (
        <div className="glass h-72 animate-pulse rounded-2xl" />
      ) : filteredTeams.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-lg font-semibold text-foreground">No matching teams found</div>
          <p className="mt-1 text-sm text-muted-foreground">Adjust your search or filter options to see teams.</p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 text-center w-28">Qualify</th>
                <th className="p-3">Team & Email</th>
                <th className="p-3">Problem Statement</th>
                <th className="p-3 text-right">PDF</th>
                <th className="p-3 text-right">GitHub</th>
                <th className="p-3 text-right">Website</th>
                <th className="p-3 text-right">Final Score</th>
                <th className="p-3 text-center">Originality</th>
                <th className="p-3 text-center">1-Page Report</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((t) => {
                const isQualified = t.final_status === "approved" || t.final_status === "qualified";
                const plag = plagiarismMap.get(t.id);
                const score = t.officialFinal ?? t.aiFinal;

                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border/50 transition-colors ${
                      isQualified
                        ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                        : plag?.isFlagged
                        ? "bg-rose-500/[0.03] hover:bg-rose-500/[0.07]"
                        : "hover:bg-accent/30"
                    }`}
                  >
                    {/* Ticking / Checkbox Option for Qualification */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Checkbox
                          checked={isQualified}
                          onCheckedChange={() => handleToggleQualify(t, isQualified)}
                          className="size-5 rounded-md data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isQualified ? "text-emerald-600" : "text-muted-foreground"
                          }`}
                        >
                          {isQualified ? "Qualified" : "Pending"}
                        </span>
                      </div>
                    </td>

                    {/* Team Name */}
                    <td className="p-3">
                      <Link to="/teams/$id" params={{ id: t.id }} className="font-semibold text-foreground hover:text-primary">
                        {t.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{t.email || "No email provided"}</div>
                    </td>

                    {/* Problem Statement */}
                    <td className="max-w-56 p-3">
                      {t.project_title ? (
                        <div className="truncate text-xs text-muted-foreground" title={t.project_title}>
                          {t.project_title.startsWith("[") ? (
                            <span className="font-mono font-bold text-primary mr-1">
                              {t.project_title.match(/^\[([^\]]+)\]/)?.[0]}
                            </span>
                          ) : null}
                          {t.project_title.replace(/^\[[^\]]+\]\s*/, "")}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">General</span>
                      )}
                    </td>

                    {/* PDF Component */}
                    <td className="p-3 text-right font-mono text-xs">
                      {t.evals.pdf?.final_score != null ? fmt(t.evals.pdf.final_score) : "—"}
                    </td>

                    {/* GitHub Component */}
                    <td className="p-3 text-right font-mono text-xs">
                      {t.evals.github?.final_score != null ? fmt(t.evals.github.final_score) : "—"}
                    </td>

                    {/* Website Component */}
                    <td className="p-3 text-right font-mono text-xs">
                      {t.evals.website?.final_score != null ? fmt(t.evals.website.final_score) : "—"}
                    </td>

                    {/* Final Score */}
                    <td className="p-3 text-right font-mono font-bold text-base text-foreground">
                      {score != null ? fmt(score) : "—"}
                    </td>

                    {/* Plagiarism Status */}
                    <td className="p-3 text-center">
                      {plag?.isFlagged ? (
                        <div className="inline-flex flex-col items-center">
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600"
                            title={plag.notes.join("\n")}
                          >
                            <AlertTriangle className="size-3" />
                            {plag.similarityScore}% Match
                          </span>
                          <button
                            onClick={() => handleApplyPenalty(t)}
                            className="mt-0.5 text-[10px] text-destructive hover:underline font-medium"
                          >
                            Apply penalty
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                          <Check className="size-3" />
                          Clean
                        </span>
                      )}
                    </td>

                    {/* 1-Page PDF Report Button */}
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs hover:border-primary hover:text-primary shadow-sm"
                        onClick={() => setReportTeam(t)}
                        title="Open official 1-page report for printing"
                      >
                        <FileText className="size-3.5 text-primary" />
                        1-Page Report
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Dialog for the 1-Page PDF Report */}
      <Dialog open={!!reportTeam} onOpenChange={(open) => !open && setReportTeam(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center justify-between">
              <span>Official INNOVEDGE Assessment Report</span>
            </DialogTitle>
          </DialogHeader>

          {reportTeam && (
            <TeamReportCard
              team={reportTeam}
              plagiarismScore={plagiarismMap.get(reportTeam.id)?.similarityScore ?? 0}
              onClose={() => setReportTeam(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
