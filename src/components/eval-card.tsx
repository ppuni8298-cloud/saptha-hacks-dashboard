import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Pencil, RefreshCw, RotateCcw, Settings2, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, fmt } from "@/components/page-header";
import { COMPONENT_LABEL, effectiveMarks, sumScores, type Component } from "@/lib/scoring";
import { enqueue, logActivity } from "@/lib/db";
import { useQueueRunner } from "@/lib/queue-runner";
import type { Evaluation } from "@/lib/queries";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type CS = Tables<"criterion_scores">;

export function EvalCard({ teamId, component, evaluation }: { teamId: string; component: Component; evaluation?: Evaluation | undefined }) {
  const qc = useQueryClient();
  const runner = useQueueRunner();
  const [edit, setEdit] = useState<CS | null>(null);
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const scores = useQuery({
    queryKey: ["cs", evaluation?.id, evaluation?.updated_at],
    enabled: !!evaluation?.id,
    queryFn: async () => (await supabase.from("criterion_scores").select("*").eq("evaluation_id", evaluation!.id).order("position")).data ?? [],
  });

  const actor = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

  const recompute = async (unapprove: boolean) => {
    const { data } = await supabase.from("criterion_scores").select("ai_marks,admin_marks,max_marks").eq("evaluation_id", evaluation!.id);
    const s = sumScores((data ?? []).map((r) => ({ ai_marks: r.ai_marks, admin_marks: r.admin_marks, max_marks: Number(r.max_marks) })));
    await supabase.from("evaluations").update({ final_score: s.final, ...(unapprove && evaluation!.status === "approved" ? { status: "completed", approved_at: null, approved_by: null } : {}), updated_at: new Date().toISOString() }).eq("id", evaluation!.id);
    qc.invalidateQueries();
  };

  const saveMark = async () => {
    if (!edit) return;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || n > Number(edit.max_marks)) return toast.error(`Marks must be between 0 and ${edit.max_marks}`);
    if (!reason.trim()) return toast.error("A reason is required");
    const uid = await actor();
    const prev = effectiveMarks({ ai_marks: edit.ai_marks, admin_marks: edit.admin_marks, max_marks: 0 });
    await supabase.from("criterion_scores").update({ admin_marks: n, admin_reason: reason, edited_by: uid, edited_at: new Date().toISOString() }).eq("id", edit.id);
    await supabase.from("admin_score_overrides").insert({ evaluation_id: evaluation!.id, criterion_score_id: edit.id, team_id: teamId, field: edit.criterion_name, previous_value: prev, new_value: n, reason, edited_by: uid });
    await supabase.from("evaluation_history").insert({ team_id: teamId, component, action: "marks edited", actor: uid, details: { criterion: edit.criterion_name, previous: prev, new: n, reason } });
    await logActivity("Edited marks", `${COMPONENT_LABEL[component]} · ${edit.criterion_name}: ${prev} → ${n}`);
    setEdit(null);
    await recompute(true);
    toast.success("Marks updated");
  };

  const revert = async (c: CS) => {
    const uid = await actor();
    await supabase.from("criterion_scores").update({ admin_marks: null, admin_reason: null, edited_by: null, edited_at: null }).eq("id", c.id);
    await supabase.from("admin_score_overrides").insert({ evaluation_id: evaluation!.id, criterion_score_id: c.id, team_id: teamId, field: c.criterion_name, previous_value: c.admin_marks, new_value: c.ai_marks, reason: "Reverted to AI marks", edited_by: uid });
    await supabase.from("evaluation_history").insert({ team_id: teamId, component, action: "reverted to AI", actor: uid, details: { criterion: c.criterion_name } });
    await recompute(true);
  };

  const revertAll = async () => {
    if (!confirm("Revert every criterion to the AI-generated marks?")) return;
    for (const c of (scores.data ?? []).filter((x) => x.admin_marks != null)) await revert(c);
    toast.success("Reverted to AI marks");
  };

  const approve = async (ok: boolean) => {
    const uid = await actor();
    await supabase.from("evaluations").update(ok ? { status: "approved", approved_by: uid, approved_at: new Date().toISOString() } : { status: "completed", approved_by: null, approved_at: null }).eq("id", evaluation!.id);
    await supabase.from("evaluation_history").insert({ team_id: teamId, component, action: ok ? "approved" : "approval withdrawn", actor: uid });
    await logActivity(ok ? "Approved evaluation" : "Withdrew approval", COMPONENT_LABEL[component]);
    qc.invalidateQueries();
  };

  const reevaluate = async () => {
    const n = await enqueue([teamId], [component]);
    if (!n) return toast.info("Already queued");
    toast.success("Queued for re-evaluation");
    if (!runner.running) runner.start();
    qc.invalidateQueries();
  };

  const e = evaluation;
  const p = e?.final_score != null && e.max_score ? (Number(e.final_score) / Number(e.max_score)) * 100 : null;
  const rows = scores.data ?? [];
  const edited = rows.some((r) => r.admin_marks != null);

  return (
    <div className="glass flex flex-col rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{COMPONENT_LABEL[component]}</div>
          <div className="mt-1 font-display text-3xl font-semibold">{fmt(e?.final_score)}<span className="text-base text-muted-foreground"> / {fmt(e?.max_score)}</span></div>
          <div className="text-xs text-muted-foreground">AI score {fmt(e?.ai_score)} · {p != null ? `${fmt(p)}%` : "no score"}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={e?.status ?? "not started"} />
          {e?.stale && <StatusBadge status="stale" />}
        </div>
      </div>
      {e?.confidence != null && (
        <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>AI confidence</span><span>{Math.round(Number(e.confidence) * 100)}%</span></div><Progress value={Number(e.confidence) * 100} className="h-1.5" /></div>
      )}
      {e?.stale && <p className="mt-3 flex gap-2 rounded-lg bg-warning/10 p-2 text-xs text-warning"><AlertTriangle className="size-4 shrink-0" />Criteria or evidence changed since this evaluation. Re-evaluate to apply them.</p>}
      {e?.error && <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{e.error}</p>}
      {e?.summary && <p className="mt-3 text-sm text-muted-foreground">{e.summary}</p>}

      <div className="mt-4 flex-1 space-y-2">
        {rows.map((c) => (
          <details key={c.id} className="group rounded-lg bg-background/40 p-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
              {c.needs_review && <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
              <span className="flex-1 truncate">{c.criterion_name}</span>
              {c.admin_marks != null && <span className="font-mono text-xs text-muted-foreground line-through">{fmt(c.ai_marks)}</span>}
              <span className={cn("font-mono font-medium", c.admin_marks != null && "text-violet")}>{fmt(effectiveMarks({ ...c, max_marks: 0 }))}</span>
              <span className="font-mono text-xs text-muted-foreground">/{fmt(c.max_marks)}</span>
            </summary>
            <div className="mt-2 space-y-2 text-xs">
              <p><span className="text-muted-foreground">Explanation: </span>{c.ai_explanation}</p>
              {c.ai_evidence && <p className="rounded bg-muted/50 p-2 font-mono text-[11px]">{c.ai_evidence}</p>}
              <p className="text-muted-foreground">Confidence {Math.round(Number(c.confidence ?? 0) * 100)}%</p>
              {c.admin_marks != null && <p className="text-violet">Admin edit: {c.admin_reason} · {c.edited_at && new Date(c.edited_at).toLocaleString()}</p>}
              <div className="no-print flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setEdit(c); setVal(String(effectiveMarks({ ...c, max_marks: 0 }))); setReason(""); }}><Pencil className="size-3" />Edit marks</Button>
                {c.admin_marks != null && <Button size="sm" variant="ghost" onClick={() => revert(c)}><Undo2 className="size-3" />Revert to AI</Button>}
              </div>
            </div>
          </details>
        ))}
        {!e && <p className="text-sm text-muted-foreground">Not evaluated yet.</p>}
      </div>

      <div className="no-print mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={reevaluate} disabled={e?.status === "processing"}><RefreshCw className="size-3.5" />{e ? "Re-evaluate" : "Evaluate"}</Button>
        <Button size="sm" variant="ghost" asChild><Link to="/criteria" search={{ c: component }}><Settings2 className="size-3.5" />Edit criteria</Link></Button>
        {edited && <Button size="sm" variant="ghost" onClick={revertAll}><RotateCcw className="size-3.5" />Revert all</Button>}
        {e && ["completed", "approved"].includes(e.status) && (
          e.status === "approved" ? <Button size="sm" variant="ghost" onClick={() => approve(false)}>Withdraw approval</Button> : <Button size="sm" onClick={() => approve(true)}><Check className="size-3.5" />Approve</Button>
        )}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit marks · {edit?.criterion_name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">AI gave {fmt(edit?.ai_marks)} / {fmt(edit?.max_marks)}. The original AI mark is preserved.</p>
          <Input type="number" step="0.5" min={0} max={Number(edit?.max_marks ?? 0)} value={val} onChange={(x) => setVal(x.target.value)} />
          <Textarea placeholder="Reason for change (required)" value={reason} onChange={(x) => setReason(x.target.value)} />
          <DialogFooter><Button onClick={saveMark}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
