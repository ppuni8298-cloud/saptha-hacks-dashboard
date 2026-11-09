import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, Plus, Trash2, Upload, Lightbulb, ExternalLink, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { extractPdfText } from "@/lib/pdf";
import { logActivity } from "@/lib/db";
import { type Team } from "@/lib/queries";
import { checkPdf, submissionSchema } from "@/lib/submission";
import { fetchProblemStatements, type ProblemStatement } from "@/lib/problem-statements";

type Member = { name: string; email: string };

export function TeamForm({ team, members: initial }: { team?: Team; members?: Member[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: problemStatements = [] } = useQuery({
    queryKey: ["problem-statements"],
    queryFn: fetchProblemStatements,
  });

  const [f, setF] = useState({
    name: team?.name ?? "",
    email: team?.email ?? "",
    project_title: team?.project_title ?? "",
    project_description: team?.project_description ?? "",
    github_url: team?.github_url ?? "",
    website_url: team?.website_url ?? "",
  });

  const [selectedPsId, setSelectedPsId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>(initial?.length ? initial : [{ name: "", email: "" }]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const maxMb = 3;

  // Initialize selected problem statement from team project_title if exists
  useEffect(() => {
    if (problemStatements.length > 0 && !selectedPsId) {
      if (team?.project_title) {
        const tLower = team.project_title.toLowerCase();
        const found = problemStatements.find(
          (p) => tLower.includes(p.code.toLowerCase()) || tLower.includes(p.title.toLowerCase())
        );
        if (found) {
          setSelectedPsId(found.id);
        }
      }
    }
  }, [problemStatements, team?.project_title, selectedPsId]);

  const activePs = problemStatements.find((p) => p.id === selectedPsId);

  const handleProblemStatementChange = (id: string) => {
    setSelectedPsId(id);
    const chosen = problemStatements.find((p) => p.id === id);
    if (chosen) {
      const newTitle = `[${chosen.code}] ${chosen.title}`;
      setF((prev) => ({
        ...prev,
        project_title: newTitle,
        // If current description is empty or matches another default ps description, autofill with this one
        project_description:
          !prev.project_description ||
          problemStatements.some((ps) => ps.description === prev.project_description)
            ? chosen.description
            : prev.project_description,
      }));
    }
  };

  const pickPdf = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast.error("Only PDF files are allowed");
    if (file.size > maxMb * 1024 * 1024) return toast.error(`PDF must be under ${maxMb} MB`);
    setPdf(file);
    setRemovePdf(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPsId && problemStatements.length > 0) {
      return toast.error("Please select a problem statement for this team from the available options");
    }
    const parsed = submissionSchema.safeParse(f);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Check project details");
    if (!pdf && (!team?.pdf_path || removePdf)) return toast.error("Project PDF is required");
    setBusy(true);
    try {
      const id = team?.id ?? crypto.randomUUID();
      let path = team?.pdf_path ?? null;
      let text = team?.pdf_text ?? "";
      if (pdf) {
        await checkPdf(pdf);
        path = `${id}/${Date.now()}.pdf`;
        const { error: up } = await supabase.storage.from("project-pdfs").upload(path, pdf, { contentType: "application/pdf" });
        if (up) throw up;
        try { text = await extractPdfText(pdf); } catch { toast.warning("PDF stored, but its text could not be extracted"); }
      }
      const payload = { ...parsed.data, id, pdf_path: path, pdf_text: text, updated_at: new Date().toISOString() };
      const { data: saved, error } = team
        ? await supabase.from("teams").update(payload as any).eq("id", team.id).select().single()
        : await supabase.from("teams").insert(payload as any).select().single();
      if (error) throw new Error(error.code === "23505" ? "A team with this name already exists" : error.message);
      if (pdf) {
        if (team?.pdf_path) await supabase.storage.from("project-pdfs").remove([team.pdf_path]);
        if (team) await supabase.from("evaluations").update({ stale: true }).eq("team_id", id).eq("component", "pdf");
      }
      await supabase.from("team_members").delete().eq("team_id", id);
      const ms = members.filter((m) => m.name.trim()).map((m, i) => ({ team_id: id, name: m.name.trim(), email: m.email.trim() || null, position: i }));
      if (ms.length) await supabase.from("team_members").insert(ms);
      await logActivity(team ? "Edited team" : "Added team", f.name);
      qc.invalidateQueries();
      toast.success(team ? "Team updated" : "Team added");
      navigate({ to: "/teams/$id", params: { id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label} *</Label>
      <Input
        id={k}
        required
        maxLength={k === "name" ? 100 : k === "project_title" ? 200 : k === "email" ? 255 : 2048}
        type={type}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </div>
  );

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-3">
      <div className="glass space-y-4 rounded-2xl p-6 lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          {field("name", "Team name")}
          {field("email", "Team email", "email")}
        </div>

        {/* Problem Statement Selection Section */}
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="ps_select" className="flex items-center gap-2 font-semibold text-foreground">
              <Lightbulb className="size-4 text-primary" />
              Problem Statement *
            </Label>
            <Link
              to="/problem-statements"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Manage Problem Statements
              <ExternalLink className="size-3" />
            </Link>
          </div>

          <Select value={selectedPsId} onValueChange={handleProblemStatementChange}>
            <SelectTrigger id="ps_select" className="bg-background">
              <SelectValue placeholder="Select a problem statement from the list..." />
            </SelectTrigger>
            <SelectContent>
              {problemStatements.map((ps) => (
                <SelectItem key={ps.id} value={ps.id}>
                  <span className="font-mono font-semibold text-primary mr-1.5">[{ps.code}]</span>
                  <span>{ps.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({ps.category})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activePs && (
            <div className="mt-2.5 rounded-lg bg-background/80 border border-border/80 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Tag className="size-3 text-primary" />
                  {activePs.category}
                </span>
                <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {activePs.code}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{activePs.description}</p>
              {activePs.requirements && (
                <p className="text-[11px] text-muted-foreground/80 italic pt-1 border-t border-border/40">
                  <span className="font-medium text-foreground not-italic">Scope:</span> {activePs.requirements}
                </p>
              )}
            </div>
          )}
        </div>

        {field("project_title", "Project Title (auto-populated from problem statement)")}

        <div className="space-y-1.5">
          <Label htmlFor="project_description">Project description & solution approach *</Label>
          <Textarea
            id="project_description"
            required
            maxLength={10000}
            rows={4}
            value={f.project_description}
            onChange={(e) => setF({ ...f, project_description: e.target.value })}
            placeholder="Explain the team's specific approach, methodology, and tech stack for solving this selected problem statement..."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {field("github_url", "GitHub repository URL", "url")}
          {field("website_url", "Deployed website URL", "url")}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Team members ({members.length})</Label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setMembers([...members, { name: "", email: "" }])}
            >
              <Plus className="size-4" />
              Add member
            </Button>
          </div>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Name"
                  value={m.name}
                  onChange={(e) =>
                    setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={m.email}
                  onChange={(e) =>
                    setMembers(members.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setMembers(members.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass rounded-2xl p-6">
          <Label>Project PDF * (max {maxMb} MB)</Label>
          <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-primary">
            <Upload className="size-6" />
            {pdf ? pdf.name : team?.pdf_path && !removePdf ? "Replace current PDF" : "Choose a PDF"}
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pickPdf(e.target.files?.[0])} />
          </label>
          {team?.pdf_path && !pdf && !removePdf && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                PDF attached
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRemovePdf(true)}>
                Remove
              </Button>
            </div>
          )}
          {removePdf && <p className="mt-2 text-xs text-warning">PDF will be removed on save.</p>}
        </div>
        <Button className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {team ? "Save changes" : "Create team"}
        </Button>
      </div>
    </form>
  );
}
