import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { exportRows, readSheet } from "@/lib/export";
import { fetchAll, logActivity } from "@/lib/db";
import { checkPdf, submissionSchema } from "@/lib/submission";
import { extractPdfText } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Bulk import — Assessor" }, { name: "description", content: "Import teams from CSV or Excel." }, { property: "og:title", content: "Bulk import — Assessor" }, { property: "og:description", content: "Import teams from CSV or Excel." }] }),
  component: Import,
});

type Parsed = { name: string; email: string; project_title: string; project_description: string; github_url: string; website_url: string; members: { name: string; email: string }[]; issues: string[]; duplicate: boolean };

const pick = (r: Record<string, string>, ...keys: string[]) => {
  const k = Object.keys(r).find((x) => keys.includes(x.toLowerCase().replace(/[^a-z0-9]/g, "")));
  return k ? String(r[k]).trim() : "";
};

function Import() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Parsed[]>([]);
  const [busy, setBusy] = useState(false);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const pdfFor = (name: string) => pdfs.find((file) => file.name.replace(/\.pdf$/i, "").toLowerCase() === name.toLowerCase());
  const canImport = (row: Parsed) => !row.duplicate && submissionSchema.safeParse(row).success && !!pdfFor(row.name);

  const load = async (file?: File) => {
    if (!file) return;
    try {
      const raw = await readSheet(file);
      const existing = new Set((await fetchAll<{ name: string }>("teams", "name")).map((t) => t.name.toLowerCase()));
      const seen = new Set<string>();
      setRows(raw.map((r) => {
        const members: { name: string; email: string }[] = [];
        for (let i = 1; i <= 20; i++) {
          const n = pick(r, `member${i}name`, `member${i}`); const e = pick(r, `member${i}email`);
          if (n) members.push({ name: n, email: e });
        }
        const listed = pick(r, "members");
        if (!members.length && listed) listed.split(/[;|]/).forEach((m) => { const [n, e] = m.split(/[<>,]/).map((s) => s.trim()); if (n) members.push({ name: n, email: e ?? "" }); });
        const p: Parsed = { name: pick(r, "teamname", "team", "name"), email: pick(r, "teamemail", "email"), project_title: pick(r, "problemstatement", "problem", "ps", "projecttitle", "title"), project_description: pick(r, "projectdescription", "description", "details", "problemdescription"), github_url: pick(r, "githuburl", "github", "repository", "repo"), website_url: pick(r, "websiteurl", "website", "deployedurl", "url"), members, issues: [], duplicate: false };
        if (!p.name) p.issues.push("missing team name");
        if (!p.project_title) p.issues.push("missing project title");
        if (!p.github_url) p.issues.push("no GitHub URL"); else if (!/^https?:\/\/(www\.)?github\.com\//i.test(p.github_url)) p.issues.push("invalid GitHub URL");
        if (!p.website_url) p.issues.push("no website URL"); else if (!/^https?:\/\//i.test(p.website_url)) p.issues.push("invalid website URL");
        if (!members.length) p.issues.push("no members");
        const key = p.name.toLowerCase();
        if (existing.has(key) || seen.has(key)) p.duplicate = true;
        seen.add(key);
        return p;
      }));
    } catch (e) {
      toast.error(`Could not read file: ${(e as Error).message}`);
    }
  };

  const save = async () => {
    const ok = rows.filter(canImport);
    setBusy(true);
    let n = 0;
    for (const r of ok) {
      const file = pdfFor(r.name);
      if (!file) continue;
      try { await checkPdf(file); } catch (error) { toast.error(`${r.name}: ${(error as Error).message}`); continue; }
      const id = crypto.randomUUID();
      const path = `${id}/${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from("project-pdfs").upload(path, file, { contentType: "application/pdf" });
      if (uploadError) { toast.error(`${r.name}: ${uploadError.message}`); continue; }
      let text = "";
      try { text = await extractPdfText(file); } catch { toast.warning(`${r.name}: PDF text could not be extracted`); }
      const { data, error } = await supabase.from("teams").insert({ ...submissionSchema.parse(r), id, pdf_path: path, pdf_text: text }).select("id").single();
      if (error) toast.error(`${r.name}: ${error.message}`);
      if (error || !data) continue;
      if (r.members.length) await supabase.from("team_members").insert(r.members.map((m, i) => ({ team_id: data.id, name: m.name, email: m.email || null, position: i })));
      n++;
    }
    await logActivity("Bulk import", `${n} team(s) imported`);
    setBusy(false);
    setRows([]);
    setPdfs([]);
    qc.invalidateQueries();
    toast.success(`${n} team(s) imported with PDFs.`);
  };

  const template = () => exportRows([{ "Team Name": "Team Alpha", "Team Email": "alpha@example.com", "Project Title": "Smart Campus", "Project Description": "…", "GitHub URL": "https://github.com/org/repo", "Website URL": "https://example.com", "Member1 Name": "Asha", "Member1 Email": "asha@example.com", "Member2 Name": "Ravi", "Member2 Email": "ravi@example.com" }], "team-import-template", "xlsx");
  const valid = rows.filter(canImport).length;

  return (
    <>
      <PageHeader title="Bulk import" desc="Upload a CSV or XLSX file. Rows are validated before saving.">
        <Button variant="secondary" onClick={template}><Download className="size-4" />Template</Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Upload className="size-4" />Choose file<input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => load(e.target.files?.[0])} /></label>
      </PageHeader>
      <div className="mb-4 text-sm"><label className="inline-flex cursor-pointer items-center gap-2 text-primary"><Upload className="size-4" />Choose project PDFs<input type="file" multiple accept="application/pdf,.pdf" className="hidden" onChange={(e) => setPdfs(Array.from(e.target.files ?? []))} /></label><p className="mt-1 text-muted-foreground">Name each PDF after its team, for example Team Alpha.pdf. Maximum 3 MB each.</p></div>
      {!rows.length ? <Empty title="No file loaded" desc="Columns: Team Name, Team Email, Project Title, Project Description, GitHub URL, Website URL, Member1 Name, Member1 Email, Member2 Name… (any number of members)." /> : (
        <>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>{rows.length} rows · <span className="text-success">{valid} will be imported</span> · <span className="text-warning">{rows.filter((r) => r.duplicate).length} duplicates skipped</span></span>
            <Button onClick={save} disabled={busy || !valid}>{busy && <Loader2 className="size-4 animate-spin" />}Import {valid} teams</Button>
          </div>
          <div className="glass overflow-x-auto rounded-2xl">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="p-3">Team</th><th className="p-3">Project</th><th className="p-3">Members</th><th className="p-3">Issues</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i} className={`border-b border-border/50 ${r.duplicate || !r.name ? "opacity-50" : ""}`}>
                  <td className="p-3">{r.name || <em className="text-destructive">missing</em>}<div className="text-xs text-muted-foreground">{r.email}</div></td>
                  <td className="p-3">{r.project_title}</td>
                  <td className="p-3 text-xs">{r.members.map((m) => m.name).join(", ")}</td>
                  <td className="p-3 text-xs">{r.duplicate && <span className="mr-1 text-destructive">duplicate</span>}<span className="text-warning">{[...r.issues, ...(!submissionSchema.safeParse(r).success ? ["complete all required fields"] : []), ...(!pdfFor(r.name) ? ["PDF required"] : [])].join(", ")}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-muted-foreground">View imported projects in <Link to="/teams" className="text-primary">Teams</Link>.</p>
    </>
  );
}
