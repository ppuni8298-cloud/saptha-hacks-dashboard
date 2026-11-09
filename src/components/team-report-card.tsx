import { useRef } from "react";
import { Printer, Download, CheckCircle, XCircle, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type TeamRow } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { fmt } from "@/components/page-header";

export function TeamReportCard({
  team,
  onClose,
  plagiarismScore = 0,
}: {
  team: TeamRow;
  onClose?: () => void;
  plagiarismScore?: number;
}) {
  const isQualified = team.final_status === "approved" || team.final_status === "qualified";
  const isRejected = team.final_status === "rejected" || team.final_status === "disqualified";

  // Generate dynamic, actionable improvements based on score deductions
  const improvements: string[] = [];
  const pdfEval = team.evals["pdf"];
  const ghEval = team.evals["github"];
  const webEval = team.evals["website"];

  if (pdfEval?.final_score != null && pdfEval.max_score != null) {
    const pct = (Number(pdfEval.final_score) / Number(pdfEval.max_score)) * 100;
    if (pct < 70) {
      improvements.push("Documentation: Elaborate on the technical architecture, implementation roadmap, and empirical impact metrics in the project PDF.");
    }
  }

  if (ghEval?.final_score != null && ghEval.max_score != null) {
    const pct = (Number(ghEval.final_score) / Number(ghEval.max_score)) * 100;
    if (pct < 70) {
      improvements.push("Code Quality: Enhance modularity, add unit test coverage, and ensure clear README setup instructions.");
    }
  }

  if (webEval?.final_score != null && webEval.max_score != null) {
    const pct = (Number(webEval.final_score) / Number(webEval.max_score)) * 100;
    if (pct < 70) {
      improvements.push("Prototype / Web: Refine user experience, improve mobile responsiveness, and connect dynamic backend API interactions.");
    }
  }

  if (plagiarismScore >= 35) {
    improvements.push(`Originality: Content similarity of ${plagiarismScore}% detected. Replace third-party template sections with original implementations.`);
  }

  if (improvements.length === 0) {
    improvements.push("Maintain current high code quality, benchmark system performance under peak load, and prepare an interactive pitch for Round 2.");
    improvements.push("Expand automated integration tests and refine responsive UI edge cases.");
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative mx-auto max-w-4xl bg-background text-foreground">
      {/* Action Bar (Hidden on print) */}
      <div className="no-print mb-4 flex items-center justify-between rounded-xl bg-card border border-border p-3 shadow-sm">
        <div className="text-sm font-semibold text-muted-foreground">
          1-Page Team Report: <span className="text-foreground">{team.name}</span>
        </div>
        <div className="flex gap-2">
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Back to List
            </Button>
          )}
          <Button size="sm" onClick={handlePrint} className="gap-1.5 shadow-sm">
            <Printer className="size-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* The Printable 1-Page Document Container */}
      <div
        id="single-page-report"
        className="print-container relative border border-border/80 bg-white dark:bg-card p-6 md:p-8 rounded-2xl shadow-md overflow-hidden text-slate-900 dark:text-slate-100"
        style={{
          minHeight: "1050px",
          pageBreakInside: "avoid",
          breakInside: "avoid",
        }}
      >
        {/* Transparent Watermark Logo in Background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.05] dark:opacity-[0.08] select-none"
        >
          <img
            src="/innovedge-logo.png"
            alt=""
            className="w-[420px] max-w-[80%] object-contain"
          />
        </div>

        {/* Content sits above watermark */}
        <div className="relative z-10 flex flex-col justify-between" style={{ minHeight: "1000px" }}>
          <div>
            {/* Header: Logo, Title, Qualification Stamp */}
            <div className="flex items-start justify-between border-b-2 border-primary/20 pb-4">
              <div className="flex items-center gap-3.5">
                <img
                  src="/innovedge-logo.png"
                  alt="INNOVEDGE Emblem"
                  className="size-16 object-contain rounded-xl shadow-sm border border-border/40 p-1 bg-white"
                />
                <div>
                  <div className="font-display text-xl font-black tracking-wider text-primary uppercase">
                    INNOVEDGE
                  </div>
                  <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Innovation and Entrepreneurship Development Club
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-foreground tracking-wide">
                    OFFICIAL PROJECT EVALUATION & QUALIFICATION SCORECARD
                  </div>
                </div>
              </div>

              {/* Status Stamp */}
              <div className="text-right">
                {isQualified ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-black tracking-wide text-emerald-700 dark:text-emerald-300 uppercase shadow-sm">
                    <CheckCircle className="size-4 text-emerald-600" />
                    QUALIFIED FOR ROUND 2
                  </div>
                ) : isRejected ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border-2 border-rose-600 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-black tracking-wide text-rose-700 dark:text-rose-300 uppercase shadow-sm">
                    <XCircle className="size-4 text-rose-600" />
                    NOT QUALIFIED
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-black tracking-wide text-amber-700 dark:text-amber-300 uppercase shadow-sm">
                    <Clock className="size-4 text-amber-500" />
                    QUALIFICATION PENDING
                  </div>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                  REF: INV-{team.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Team & Challenge Metadata */}
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4 border border-border/60 text-xs">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Team Name
                </span>
                <div className="text-base font-bold text-foreground">{team.name}</div>
                {team.email && <div className="text-muted-foreground">{team.email}</div>}
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Assigned Problem Statement
                </span>
                <div className="font-semibold text-foreground line-clamp-2">
                  {team.project_title || "General Innovation Challenge"}
                </div>
              </div>
            </div>

            {/* Overall Score Banner */}
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div className="col-span-1 rounded-xl bg-primary/10 border-2 border-primary/30 p-3 text-center flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Final Official Score
                </span>
                <div className="mt-1 font-display text-3xl font-black text-primary">
                  {fmt(team.officialFinal ?? team.aiFinal)}
                  <span className="text-sm font-semibold text-muted-foreground">/100</span>
                </div>
              </div>

              {COMPONENTS.map((c) => {
                const evalData = team.evals[c];
                const score = evalData?.final_score;
                const max = evalData?.max_score;
                const pct = score != null && max ? Math.round((Number(score) / Number(max)) * 100) : null;

                return (
                  <div
                    key={c}
                    className="col-span-1 rounded-xl bg-card border border-border/80 p-3 flex flex-col justify-between"
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                      {COMPONENT_LABEL[c]}
                    </span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-mono text-xl font-bold text-foreground">
                        {score != null ? fmt(score) : "—"}
                        <span className="text-xs text-muted-foreground font-normal">
                          {max ? ` / ${max}` : ""}
                        </span>
                      </span>
                      {pct != null && (
                        <span
                          className={`text-xs font-bold ${
                            pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-500" : "text-rose-500"
                          }`}
                        >
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Project Summary Overview */}
            {team.project_description && (
              <div className="mt-4 rounded-xl border border-border/70 p-3.5 bg-background text-xs">
                <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                  Project Summary & Solution Description:
                </span>
                <p className="mt-1 text-muted-foreground leading-relaxed line-clamp-3">
                  {team.project_description}
                </p>
              </div>
            )}

            {/* Key Areas for Improvement (User Requirement: wt it shld be done in one page) */}
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4 text-xs">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-primary text-[11px] mb-2">
                <ShieldCheck className="size-4 text-primary" />
                Key Areas for Improvement & Next Round Recommendations:
              </div>
              <ul className="space-y-1.5 text-muted-foreground">
                {improvements.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Plagiarism & Originality Clearance */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-[11px] border border-border/50">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {plagiarismScore < 35 ? (
                  <>
                    <ShieldCheck className="size-3.5 text-emerald-600" />
                    <span>Academic & Code Originality Check: <strong>PASSED</strong> (Similarity: {plagiarismScore}%)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-3.5 text-amber-500" />
                    <span>Academic & Code Originality Check: <strong>FLAGGED</strong> (Similarity: {plagiarismScore}%)</span>
                  </>
                )}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">
                Audited with Gemini 3.1 Flash Lite
              </span>
            </div>
          </div>

          {/* Footer: Official Signatures & Verification Stamp */}
          <div className="mt-6 pt-4 border-t border-border flex items-end justify-between text-[11px] text-muted-foreground">
            <div>
              <div className="font-semibold text-foreground">INNOVEDGE Hackathon Committee</div>
              <div>Innovation & Entrepreneurship Development Club</div>
              <div className="text-[10px]">Certified Digital Report • Valid without physical seal</div>
            </div>

            <div className="text-right">
              <div className="font-mono text-xs font-semibold text-foreground">
                Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </div>
              <div className="mt-1 text-[10px] text-primary font-semibold uppercase tracking-wider">
                Innovation • Entrepreneurship • Excellence
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

