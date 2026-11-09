import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Play, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, Empty, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamRows } from "@/lib/queries";
import { COMPONENTS } from "@/lib/scoring";
import { enqueue, logActivity } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/teams/")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Teams — Assessor" }, { name: "description", content: "All registered teams." }, { property: "og:title", content: "Teams — Assessor" }, { property: "og:description", content: "All registered teams." }] }),
  component: Teams,
});

function Teams() {
  const rows = useTeamRows();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (rows.data ?? [])
      .filter((t) => !s || [t.name, t.email, t.project_title].some((v) => v?.toLowerCase().includes(s)))
      .filter((t) => status === "all" || t.overall === status)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows.data, q, status]);

  const evaluate = async () => {
    const n = await enqueue([...sel], COMPONENTS);
    toast.success(`${n} job(s) queued. Start the queue to run them.`);
    setSel(new Set());
  };
  const del = async () => {
    if (!confirm(`Delete ${sel.size} team(s) and all their evaluations?`)) return;
    await supabase.from("teams").delete().in("id", [...sel]);
    await logActivity("Deleted teams", `${sel.size} team(s)`);
    setSel(new Set());
    qc.invalidateQueries();
  };

  return (
    <>
      <PageHeader title="Teams" desc={`${rows.data?.length ?? 0} registered teams`}>
        <Button asChild variant="secondary"><Link to="/import">Bulk import</Link></Button>
        <Button asChild><Link to="/teams/new"><Plus className="size-4" />Add team</Link></Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search name, email or project title" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{["all", "pending", "processing", "completed", "stale", "failed", "approved", "rejected"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
        </Select>
        {sel.size > 0 && (<><Button onClick={evaluate}><Play className="size-4" />Queue evaluation ({sel.size})</Button><Button variant="destructive" onClick={del}><Trash2 className="size-4" /></Button></>)}
      </div>
      {rows.isLoading ? <div className="glass h-64 animate-pulse rounded-2xl" /> : !list.length ? (
        <Empty title="No teams found" desc="Add teams manually or import a CSV/XLSX file."><Button asChild><Link to="/teams/new">Add team</Link></Button></Empty>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border">
              <th className="p-3"><Checkbox checked={sel.size === list.length} onCheckedChange={(v) => setSel(v ? new Set(list.map((t) => t.id)) : new Set())} /></th>
              <th className="p-3">Team</th><th className="p-3">Project</th><th className="p-3 text-right">PDF</th><th className="p-3 text-right">GitHub</th><th className="p-3 text-right">Website</th><th className="p-3 text-right">Final</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="p-3"><Checkbox checked={sel.has(t.id)} onCheckedChange={(v) => { const n = new Set(sel); v ? n.add(t.id) : n.delete(t.id); setSel(n); }} /></td>
                  <td className="p-3"><Link to="/teams/$id" params={{ id: t.id }} className="font-medium hover:text-primary">{t.name}</Link><div className="text-xs text-muted-foreground">{t.email}</div></td>
                  <td className="max-w-64 truncate p-3 text-muted-foreground">
                    {t.project_title?.startsWith("[") ? (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                          {t.project_title.match(/^\[([^\]]+)\]/)?.[1] ?? "PS"}
                        </span>
                        <span className="truncate">{t.project_title.replace(/^\[[^\]]+\]\s*/, "")}</span>
                      </div>
                    ) : (
                      t.project_title
                    )}
                  </td>
                  {COMPONENTS.map((c) => { const e = t.evals[c]; return <td key={c} className="p-3 text-right font-mono">{e?.final_score != null ? fmt((Number(e.final_score) / Number(e.max_score)) * 100) : "—"}</td>; })}
                  <td className="p-3 text-right font-mono font-semibold">{fmt(t.officialFinal ?? t.aiFinal)}{t.officialFinal == null && t.aiFinal != null && <span className="ml-1 text-[10px] text-muted-foreground">AI</span>}</td>
                  <td className="p-3"><StatusBadge status={t.overall} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
