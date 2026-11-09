import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMPONENTS, COMPONENT_LABEL, type Component } from "@/lib/scoring";
import { logActivity } from "@/lib/db";
import type { Tables } from "@/integrations/supabase/types";

type Crit = Tables<"evaluation_criteria">;

export const Route = createFileRoute("/_authenticated/criteria")({
  validateSearch: (s: Record<string, unknown>): { c?: Component | undefined } => ({ c: COMPONENTS.includes(s["c"] as Component) ? (s["c"] as Component) : undefined }),
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Evaluation criteria — Assessor" }, { name: "description", content: "Manage PDF, GitHub and website criteria." }, { property: "og:title", content: "Evaluation criteria — Assessor" }, { property: "og:description", content: "Manage PDF, GitHub and website criteria." }] }),
  component: Criteria,
});

function Criteria() {
  const { c = "pdf" } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const crits = useQuery({ queryKey: ["criteria", c], queryFn: async () => (await supabase.from("evaluation_criteria").select("*").eq("component", c).order("position")).data ?? [] });
  const templates = useQuery({ queryKey: ["templates", c], queryFn: async () => (await supabase.from("evaluation_templates").select("*").eq("component", c).order("created_at", { ascending: false })).data ?? [] });
  const list = crits.data ?? [];
  const total = list.filter((x) => x.enabled).reduce((s, x) => s + Number(x.max_marks), 0);
  const refresh = () => qc.invalidateQueries();

  const update = async (id: string, patch: Partial<Crit>) => {
    const { error } = await supabase.from("evaluation_criteria").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };
  const add = async () => {
    await supabase.from("evaluation_criteria").insert({ component: c, name: "New criterion", max_marks: 10, position: (list.at(-1)?.position ?? 0) + 1 });
    await logActivity("Added criterion", COMPONENT_LABEL[c]);
    refresh();
  };
  const remove = async (x: Crit) => {
    if (!confirm(`Delete "${x.name}"? Existing evaluations keep their scores but will be flagged for re-evaluation.`)) return;
    await supabase.from("evaluation_criteria").delete().eq("id", x.id);
    await logActivity("Deleted criterion", `${COMPONENT_LABEL[c]} · ${x.name}`);
    refresh();
  };
  const move = async (i: number, d: -1 | 1) => {
    const a = list[i], b = list[i + d];
    if (!a || !b) return;
    await Promise.all([supabase.from("evaluation_criteria").update({ position: b.position }).eq("id", a.id), supabase.from("evaluation_criteria").update({ position: a.position }).eq("id", b.id)]);
    refresh();
  };
  const saveTemplate = async () => {
    const name = prompt("Template name");
    if (!name) return;
    await supabase.from("evaluation_templates").insert({ component: c, name, criteria: list.map(({ name, description, instructions, max_marks, weight, enabled }) => ({ name, description, instructions, max_marks, weight, enabled })) });
    toast.success("Template saved");
    refresh();
  };
  const applyTemplate = async (t: Tables<"evaluation_templates">) => {
    if (!confirm(`Replace all ${COMPONENT_LABEL[c]} criteria with "${t.name}"? Existing evaluations will be flagged for re-evaluation.`)) return;
    await supabase.from("evaluation_criteria").delete().eq("component", c);
    await supabase.from("evaluation_criteria").insert((t.criteria as any[]).map((x, i) => ({ ...x, component: c, position: i + 1 })));
    await logActivity("Applied template", `${COMPONENT_LABEL[c]} · ${t.name}`);
    refresh();
  };

  return (
    <>
      <PageHeader title="Evaluation criteria" desc="Each component is managed independently. The AI follows only these criteria and marks.">
        <Button variant="secondary" onClick={saveTemplate}><Save className="size-4" />Save as template</Button>
        <Button onClick={add}><Plus className="size-4" />Add criterion</Button>
      </PageHeader>
      <Tabs value={c} onValueChange={(v) => navigate({ to: "/criteria", search: { c: v as Component } })}>
        <TabsList>{COMPONENTS.map((k) => <TabsTrigger key={k} value={k}>{COMPONENT_LABEL[k]}</TabsTrigger>)}</TabsList>
      </Tabs>
      <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
        Total enabled marks: <span className="font-mono text-lg text-foreground">{fmt(total)}</span>
        {total !== 100 && <span className="text-warning">(not 100 — scores are converted to a percentage)</span>}
      </div>
      <div className="mt-4 space-y-3">
        {list.map((x, i) => <CritRow key={x.id + x.updated_at} x={x} first={i === 0} last={i === list.length - 1} onMove={(d) => move(i, d)} onSave={(p) => update(x.id, p)} onDelete={() => remove(x)} />)}
      </div>
      {!!templates.data?.length && (
        <div className="glass mt-6 rounded-2xl p-5">
          <h3 className="font-semibold">{COMPONENT_LABEL[c]} templates</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {templates.data.map((t) => (
              <div key={t.id} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm">
                {t.name}
                <Button size="sm" variant="ghost" onClick={() => applyTemplate(t)}><FolderOpen className="size-3.5" />Apply</Button>
                <Button size="icon" variant="ghost" className="size-7" onClick={async () => { await supabase.from("evaluation_templates").delete().eq("id", t.id); refresh(); }}><Trash2 className="size-3.5" /></Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function CritRow({ x, first, last, onMove, onSave, onDelete }: { x: Crit; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onSave: (p: Partial<Crit>) => void; onDelete: () => void }) {
  const [f, setF] = useState({ name: x.name, description: x.description ?? "", instructions: x.instructions ?? "", max_marks: String(x.max_marks), weight: String(x.weight) });
  const dirty = f.name !== x.name || f.description !== (x.description ?? "") || f.instructions !== (x.instructions ?? "") || Number(f.max_marks) !== Number(x.max_marks) || Number(f.weight) !== Number(x.weight);
  const save = () => {
    const m = Number(f.max_marks);
    if (!f.name.trim() || !(m > 0)) return toast.error("Name and positive max marks are required");
    onSave({ name: f.name.trim(), description: f.description, instructions: f.instructions, max_marks: m, weight: Number(f.weight) || 1 });
    toast.success("Criterion saved — affected evaluations flagged for re-evaluation");
  };
  return (
    <div className={`glass rounded-2xl p-4 ${x.enabled ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col"><Button size="icon" variant="ghost" className="size-6" disabled={first} onClick={() => onMove(-1)}><ArrowUp className="size-3" /></Button><Button size="icon" variant="ghost" className="size-6" disabled={last} onClick={() => onMove(1)}><ArrowDown className="size-3" /></Button></div>
        <Input className="min-w-48 flex-1 font-medium" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">Max<Input className="w-20" type="number" value={f.max_marks} onChange={(e) => setF({ ...f, max_marks: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">Importance<Input className="w-16" type="number" step="0.5" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={x.enabled} onCheckedChange={(v) => onSave({ enabled: v })} />Enabled</label>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="size-4" /></Button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <Textarea rows={2} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Textarea rows={2} placeholder="Evaluation instructions for the AI" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
      </div>
      {dirty && <Button size="sm" className="mt-2" onClick={save}>Save changes</Button>}
    </div>
  );
}
