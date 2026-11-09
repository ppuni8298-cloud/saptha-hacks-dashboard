import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Tag, Layers, RefreshCw, Users, FileQuestion, Check } from "lucide-react";
import { PageHeader, Empty } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTeamRows } from "@/lib/queries";
import {
  fetchProblemStatements,
  createProblemStatement,
  updateProblemStatement,
  deleteProblemStatement,
  seedDefaultProblemStatements,
  type ProblemStatement,
} from "@/lib/problem-statements";

export const Route = createFileRoute("/_authenticated/problem-statements")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Problem Statements — Assessor" },
      { name: "description", content: "Manage hackathon problem statements and team problem selections." },
      { property: "og:title", content: "Problem Statements — Assessor" },
      { property: "og:description", content: "Manage hackathon problem statements and team problem selections." },
    ],
  }),
  component: ProblemStatementsPage,
});

export function ProblemStatementsPage() {
  const qc = useQueryClient();
  const teams = useTeamRows();

  const { data: problemStatements = [], isLoading } = useQuery({
    queryKey: ["problem-statements"],
    queryFn: fetchProblemStatements,
  });

  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Dialog state for Add / Edit
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProblemStatement | null>(null);
  const [busy, setBusy] = useState(false);

  // Form fields
  const [formCode, setFormCode] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRequirements, setFormRequirements] = useState("");

  // Calculate teams per problem statement
  const teamCounts = useMemo(() => {
    const map = new Map<string, number>();
    const allTeams = teams.data ?? [];
    for (const t of allTeams) {
      const title = (t.project_title ?? "").toLowerCase();
      for (const ps of problemStatements) {
        const codeMatch = ps.code && title.includes(ps.code.toLowerCase());
        const titleMatch = ps.title && title.includes(ps.title.toLowerCase());
        if (codeMatch || titleMatch) {
          map.set(ps.id, (map.get(ps.id) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [teams.data, problemStatements]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    problemStatements.forEach((ps) => {
      if (ps.category) set.add(ps.category);
    });
    return Array.from(set);
  }, [problemStatements]);

  // Filtered list
  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return problemStatements.filter((ps) => {
      const matchesSearch =
        !term ||
        ps.code.toLowerCase().includes(term) ||
        ps.title.toLowerCase().includes(term) ||
        ps.category.toLowerCase().includes(term) ||
        ps.description.toLowerCase().includes(term);
      const matchesCat = selectedCategory === "all" || ps.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [problemStatements, q, selectedCategory]);

  const openCreateDialog = () => {
    setEditingItem(null);
    const nextNum = (problemStatements.length + 1).toString().padStart(2, "0");
    setFormCode(`PS-${nextNum}`);
    setFormTitle("");
    setFormCategory("General");
    setFormDescription("");
    setFormRequirements("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (ps: ProblemStatement) => {
    setEditingItem(ps);
    setFormCode(ps.code);
    setFormTitle(ps.title);
    setFormCategory(ps.category || "General");
    setFormDescription(ps.description);
    setFormRequirements(ps.requirements || "");
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) return toast.error("Problem code is required (e.g., PS-01)");
    if (!formTitle.trim()) return toast.error("Problem title is required");
    if (!formDescription.trim()) return toast.error("Problem description is required");

    setBusy(true);
    try {
      if (editingItem) {
        await updateProblemStatement(editingItem.id, {
          code: formCode.trim(),
          title: formTitle.trim(),
          category: formCategory.trim() || "General",
          description: formDescription.trim(),
          requirements: formRequirements.trim(),
        });
        toast.success(`Problem statement ${formCode} updated successfully`);
      } else {
        await createProblemStatement({
          code: formCode.trim(),
          title: formTitle.trim(),
          category: formCategory.trim() || "General",
          description: formDescription.trim(),
          requirements: formRequirements.trim(),
        });
        toast.success(`Problem statement ${formCode} added successfully`);
      }
      qc.invalidateQueries({ queryKey: ["problem-statements"] });
      setIsDialogOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (ps: ProblemStatement) => {
    const enrolled = teamCounts.get(ps.id) ?? 0;
    const msg = enrolled > 0
      ? `Delete "${ps.code}: ${ps.title}"? Note: ${enrolled} registered team(s) are currently working on this problem.`
      : `Are you sure you want to delete "${ps.code}: ${ps.title}"?`;

    if (!confirm(msg)) return;

    try {
      await deleteProblemStatement(ps.id);
      toast.success(`Deleted problem statement ${ps.code}`);
      qc.invalidateQueries({ queryKey: ["problem-statements"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleSeedDefaults = async () => {
    if (!confirm("Load default curated problem statements? This will add standard challenges to your workspace.")) return;
    try {
      await seedDefaultProblemStatements();
      toast.success("Default problem statements added");
      qc.invalidateQueries({ queryKey: ["problem-statements"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Problem Statements"
        desc={`${problemStatements.length} problem statement(s) defined. Teams select their project problem statement from this section.`}
      >
        <Button variant="secondary" onClick={handleSeedDefaults}>
          <RefreshCw className="size-4" />
          Load Defaults
        </Button>
        <Button onClick={openCreateDialog}>
          <Plus className="size-4" />
          Add Problem Statement
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search code, title, domain, or description..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains ({problemStatements.length})</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass h-48 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          title="No problem statements found"
          desc="Add new problem statements for your hackathon or load standard default challenges."
        >
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" />
            Add Problem Statement
          </Button>
          <Button variant="secondary" onClick={handleSeedDefaults}>
            <RefreshCw className="size-4" />
            Load Defaults
          </Button>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ps) => {
            const count = teamCounts.get(ps.id) ?? 0;
            return (
              <div
                key={ps.id}
                className="glass relative flex flex-col justify-between rounded-2xl p-5 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div>
                  {/* Badges & Category Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                      {ps.code}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      <Tag className="size-3" />
                      {ps.category || "General"}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mt-3 font-semibold text-foreground line-clamp-2 leading-snug">
                    {ps.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-4 leading-relaxed whitespace-pre-wrap">
                    {ps.description}
                  </p>

                  {/* Requirements / constraints if any */}
                  {ps.requirements && (
                    <div className="mt-3 rounded-lg bg-accent/40 p-2.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Scope / Key requirements: </span>
                      {ps.requirements}
                    </div>
                  )}
                </div>

                {/* Footer with Teams Count and Actions (Edit & Delete) */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    <span>
                      {count === 1 ? "1 team enrolled" : `${count} teams enrolled`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Easy Edit Option */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-xs hover:text-primary hover:bg-primary/10"
                      onClick={() => openEditDialog(ps)}
                      title="Edit this problem statement"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>

                    {/* Delete Option */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(ps)}
                      title="Delete problem statement"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? `Edit Problem Statement (${editingItem.code})` : "Add Problem Statement"}
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Update problem statement details. Changes will reflect across all team registrations and evaluations."
                  : "Define a new challenge problem statement that teams can select during registration."}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="ps_code">Code *</Label>
                  <Input
                    id="ps_code"
                    required
                    placeholder="e.g. PS-01"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="ps_category">Domain / Category *</Label>
                  <Input
                    id="ps_category"
                    required
                    placeholder="e.g. Healthcare, AI & IoT, FinTech"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ps_title">Problem Statement Title *</Label>
                <Input
                  id="ps_title"
                  required
                  placeholder="e.g. AI-Powered Adaptive Traffic Management System"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ps_description">Description & Background *</Label>
                <Textarea
                  id="ps_description"
                  required
                  rows={4}
                  placeholder="Detailed description of the problem context, real-world pain points, and expected outcomes..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ps_requirements">Scope, Key Constraints & Deliverables (Optional)</Label>
                <Textarea
                  id="ps_requirements"
                  rows={2}
                  placeholder="e.g., Must integrate real-time sensor streams, demonstrate WCAG accessibility..."
                  value={formRequirements}
                  onChange={(e) => setFormRequirements(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving..." : editingItem ? "Save Changes" : "Create Problem Statement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

