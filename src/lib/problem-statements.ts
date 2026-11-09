import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./db";

export type ProblemStatement = {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  requirements?: string;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_PROBLEM_STATEMENTS: Omit<ProblemStatement, "id">[] = [
  {
    code: "PS-01",
    title: "AI-Powered Adaptive Traffic & Mobility Optimization",
    category: "Smart Cities & IoT",
    description:
      "Design and build an intelligent traffic management system that uses computer vision and real-time sensor data to optimize signal timings, alleviate urban bottlenecks, and prioritize emergency vehicles.",
    requirements:
      "Demonstrate dynamic signal scheduling algorithms, real-time vehicle flow metrics, and a responsive traffic monitoring dashboard.",
  },
  {
    code: "PS-02",
    title: "Smart Healthcare Patient Triage & Diagnostic Assistant",
    category: "Healthcare & MedTech",
    description:
      "Develop a secure clinical decision support assistant that aids healthcare providers in symptom triaging, risk stratification, and patient queue prioritization while upholding strict medical data privacy.",
    requirements:
      "Explainable AI assessments, HIPAA/GDPR-conscious data handling, urgency scoring, and clinician verification controls.",
  },
  {
    code: "PS-03",
    title: "Decentralized Digital Identity & Credential Verification",
    category: "Cybersecurity & Web3",
    description:
      "Create a tamper-proof verification portal for academic, government, or employment credentials leveraging cryptographic signatures to prevent credential forgery and streamline background verification.",
    requirements:
      "Cryptographic signature validation pipeline, zero-knowledge/privacy-preserving workflow, and an intuitive verifier inspection interface.",
  },
  {
    code: "PS-04",
    title: "Precision Agriculture & Crop Disease Detection Engine",
    category: "Agritech & Sustainability",
    description:
      "Build an accessible mobile-friendly platform for smallholder farmers that diagnoses crop pathogens from plant imagery and provides geo-targeted organic remedy and irrigation recommendations.",
    requirements:
      "Offline-first capability, multimodal disease classification, localized actionable guidance, and soil/weather impact insights.",
  },
  {
    code: "PS-05",
    title: "Real-Time Micro-Lending Risk & Fraud Prevention API",
    category: "FinTech & Banking",
    description:
      "Construct an automated credit scoring and transaction fraud detection pipeline for micro-enterprises lacking conventional credit history using alternative behavioral signals.",
    requirements:
      "Fairness-aware credit risk model, real-time transaction anomaly detection, and interactive admin risk scoring panel.",
  },
  {
    code: "PS-06",
    title: "Personalized Accessible Learning Engine for Students",
    category: "EdTech & Accessibility",
    description:
      "Develop an adaptive learning platform tailored for students with neurodivergent needs, featuring dynamic multimodal content, interactive scaffolding, and pacing adjustments.",
    requirements:
      "WCAG 2.2 AA accessibility conformance, adaptive content presentation engine, and student progress analytics.",
  },
];

const LOCAL_STORAGE_KEY = "assessor_problem_statements";

function loadLocal(): ProblemStatement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(items: ProblemStatement[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export async function fetchProblemStatements(): Promise<ProblemStatement[]> {
  try {
    const { data, error } = await supabase
      .from("evaluation_templates")
      .select("*")
      .eq("component", "problem_statement")
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      const parsed: ProblemStatement[] = data.map((row) => {
        const c = (row.criteria ?? {}) as any;
        return {
          id: row.id,
          code: c.code || row.name.split(" - ")[0] || "PS",
          title: c.title || (row.name.includes(" - ") ? row.name.split(" - ").slice(1).join(" - ") : row.name),
          category: c.category || "General",
          description: c.description || "",
          requirements: c.requirements || "",
          created_at: row.created_at,
          updated_at: c.updated_at || row.created_at,
        };
      });
      saveLocal(parsed);
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to fetch problem statements from database, checking local cache:", err);
  }

  // Fallback to local storage or defaults
  const cached = loadLocal();
  if (cached.length > 0) return cached;

  // If completely empty, return defaults with generated IDs
  return DEFAULT_PROBLEM_STATEMENTS.map((ps, i) => ({
    ...ps,
    id: `default-${i + 1}`,
  }));
}

export async function createProblemStatement(ps: Omit<ProblemStatement, "id">): Promise<ProblemStatement> {
  const name = `${ps.code} - ${ps.title}`;
  const criteriaPayload = {
    code: ps.code.trim(),
    title: ps.title.trim(),
    category: ps.category.trim(),
    description: ps.description.trim(),
    requirements: ps.requirements?.trim() || "",
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("evaluation_templates")
      .insert({
        component: "problem_statement",
        name,
        criteria: criteriaPayload as any,
      })
      .select()
      .single();

    if (!error && data) {
      const created: ProblemStatement = {
        id: data.id,
        ...ps,
        created_at: data.created_at,
        updated_at: criteriaPayload.updated_at,
      };
      const existing = loadLocal();
      saveLocal([...existing.filter((x) => x.id !== created.id), created]);
      await logActivity("Added problem statement", `${created.code}: ${created.title}`);
      return created;
    }
  } catch (err) {
    console.warn("Could not save to Supabase, falling back to local:", err);
  }

  // Fallback local save
  const fallback: ProblemStatement = {
    id: crypto.randomUUID(),
    ...ps,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const list = loadLocal();
  saveLocal([...list, fallback]);
  await logActivity("Added problem statement", `${fallback.code}: ${fallback.title}`);
  return fallback;
}

export async function updateProblemStatement(id: string, ps: Partial<ProblemStatement>): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("evaluation_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existing) {
      const prev = (existing.criteria ?? {}) as any;
      const updatedCode = (ps.code ?? prev.code ?? "").trim();
      const updatedTitle = (ps.title ?? prev.title ?? "").trim();
      const updatedCriteria = {
        ...prev,
        code: updatedCode,
        title: updatedTitle,
        category: (ps.category ?? prev.category ?? "").trim(),
        description: (ps.description ?? prev.description ?? "").trim(),
        requirements: (ps.requirements ?? prev.requirements ?? "").trim(),
        updated_at: new Date().toISOString(),
      };
      const name = `${updatedCode} - ${updatedTitle}`;

      await supabase
        .from("evaluation_templates")
        .update({
          name,
          criteria: updatedCriteria as any,
        })
        .eq("id", id);
    }
  } catch (err) {
    console.warn("Could not update in Supabase:", err);
  }

  // Update local storage
  const list = loadLocal();
  const updatedList = list.map((item) => (item.id === id ? { ...item, ...ps, updated_at: new Date().toISOString() } : item));
  saveLocal(updatedList);
  await logActivity("Updated problem statement", `${ps.code ?? id}: ${ps.title ?? ""}`);
}

export async function deleteProblemStatement(id: string): Promise<void> {
  try {
    await supabase.from("evaluation_templates").delete().eq("id", id);
  } catch (err) {
    console.warn("Could not delete from Supabase:", err);
  }

  const list = loadLocal();
  saveLocal(list.filter((x) => x.id !== id));
  await logActivity("Deleted problem statement", id);
}

export async function seedDefaultProblemStatements(): Promise<ProblemStatement[]> {
  const createdList: ProblemStatement[] = [];
  for (const item of DEFAULT_PROBLEM_STATEMENTS) {
    const created = await createProblemStatement(item);
    createdList.push(created);
  }
  return createdList;
}

export function formatProblemStatementLabel(ps: ProblemStatement): string {
  return `[${ps.code}] ${ps.title}`;
}

