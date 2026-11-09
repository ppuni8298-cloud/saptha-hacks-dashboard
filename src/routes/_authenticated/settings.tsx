import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useWeights } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { logActivity } from "@/lib/db";
import { checkAiStatus, testAiConnection } from "@/lib/evaluate.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Settings — Assessor" }, { name: "description", content: "Model, weights, limits and queue settings." }, { property: "og:title", content: "Settings — Assessor" }, { property: "og:description", content: "Model, weights, limits and queue settings." }] }),
  component: SettingsPage,
});

const MODELS = [
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (primary, lowest latency & cost)" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash (higher quality)" },
];

function SettingsPage() {
  const qc = useQueryClient();
  const s = useSettings();
  const w = useWeights();
  const getStatus = useServerFn(checkAiStatus);
  const testConn = useServerFn(testAiConnection);

  const [f, setF] = useState<any>(null);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; provider: string; hasGeminiKey: boolean; hasLovableKey: boolean } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);

  useEffect(() => { if (s.data) setF({ ...s.data }); }, [s.data]);
  useEffect(() => { if (w.data) setWeights(Object.fromEntries(Object.entries(w.data).map(([k, v]) => [k, String(v)]))); }, [w.data]);

  useEffect(() => {
    getStatus().then(setAiStatus).catch(() => {});
  }, [getStatus]);

  if (!f) return <div className="glass h-96 animate-pulse rounded-2xl" />;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConn();
      if (res.success) {
        setTestResult({
          success: true,
          message: `Connected successfully to ${res.provider} (${res.model})!`,
          latency: res.latencyMs,
        });
        toast.success(`Gemini API connection test passed (${res.latencyMs}ms)`);
      } else {
        setTestResult({
          success: false,
          message: res.error || "Connection test failed",
        });
        toast.error(`Gemini API test failed: ${res.error}`);
      }
    } catch (e) {
      const err = (e as Error).message;
      setTestResult({ success: false, message: err });
      toast.error(`Connection error: ${err}`);
    } finally {
      setTesting(false);
    }
  };

  const wSum = COMPONENTS.reduce((a, c) => a + (Number(weights[c]) || 0), 0);
  const save = async () => {
    const nums = ["rpm", "concurrency", "batch_size", "max_retries", "max_pdf_mb", "daily_request_limit"];
    for (const k of nums) if (!(Number(f[k]) > 0)) return toast.error(`${k.replace(/_/g, " ")} must be positive`);
    if (Number(f.max_pdf_mb) > 3) return toast.error("Storage accepts PDFs up to 3 MB");
    const { error } = await supabase.from("system_settings").update({ model: f.model, scoring_instructions: f.scoring_instructions, ...Object.fromEntries(nums.map((k) => [k, Number(f[k])])), updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
    await logActivity("Updated settings");
    qc.invalidateQueries();
    toast.success("Settings saved");
  };
  const saveWeights = async () => {
    if (Math.abs(wSum - 100) > 0.001) return toast.error("Weights must add up to 100%");
    await Promise.all(COMPONENTS.map((c) => supabase.from("evaluation_components").update({ weight: Number(weights[c]) }).eq("key", c)));
    await logActivity("Changed component weights", COMPONENTS.map((c) => `${c} ${weights[c]}%`).join(", "));
    qc.invalidateQueries();
    toast.success("Weights saved — final scores recalculated");
  };
  const num = (k: string, label: string, hint?: string) => (
    <div className="space-y-1.5"><Label>{label}</Label><Input type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
  );

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass space-y-4 rounded-2xl p-6">
          <h3 className="font-semibold">AI Model & Gemini API</h3>

          {aiStatus?.hasGeminiKey ? (
            <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 p-3 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Google Gemini API connected via <code className="font-mono text-xs font-semibold">GEMINI_API_KEY</code></span>
            </div>
          ) : aiStatus?.hasLovableKey ? (
            <div className="flex items-center gap-2 rounded-xl bg-success/10 border border-success/20 p-3 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>AI configured via Lovable Gateway (<code className="font-mono text-xs font-semibold">LOVABLE_API_KEY</code>)</span>
            </div>
          ) : (
            <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 text-sm space-y-1 text-warning">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" />
                <span>API Key not yet configured</span>
              </div>
              <p className="text-xs text-muted-foreground">
                To connect Gemini 3.1 Flash Lite, add your key to <code className="font-mono text-foreground font-semibold">.env</code>:
                <br />
                <code className="text-[11px] block mt-1 bg-background/50 p-1.5 rounded font-mono text-foreground">GEMINI_API_KEY=your_gemini_api_key_here</code>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Selected Model</Label>
            <Select value={f.model} onValueChange={(v) => setF({ ...f, model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="gap-2"
            >
              {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5 text-primary" />}
              Test Gemini 3.1 Flash Lite Connection
            </Button>

            {testResult && (
              <div className={`mt-2 rounded-lg p-2.5 text-xs ${testResult.success ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                <div className="font-semibold">{testResult.message}</div>
                {testResult.latency != null && <div className="text-[11px] opacity-80 mt-0.5">Response latency: {testResult.latency} ms</div>}
              </div>
            )}
          </div>

          <div className="space-y-1.5"><Label>Global scoring instructions</Label><Textarea rows={4} value={f.scoring_instructions ?? ""} onChange={(e) => setF({ ...f, scoring_instructions: e.target.value })} /></div>
        </div>
        <div className="glass space-y-4 rounded-2xl p-6">
          <h3 className="font-semibold">Component weights</h3>
          {COMPONENTS.map((c) => <div key={c} className="flex items-center gap-3"><Label className="w-40">{COMPONENT_LABEL[c]}</Label><Input type="number" value={weights[c] ?? ""} onChange={(e) => setWeights({ ...weights, [c]: e.target.value })} /><span className="text-sm text-muted-foreground">%</span></div>)}
          <p className={`text-sm ${Math.abs(wSum - 100) > 0.001 ? "text-warning" : "text-muted-foreground"}`}>Total: {wSum}%</p>
          <Button size="sm" onClick={saveWeights}>Save weights & recalculate</Button>
        </div>
        <div className="glass space-y-4 rounded-2xl p-6 lg:col-span-2">
          <h3 className="font-semibold">Queue & limits</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {num("rpm", "Requests per minute", "Pacing between AI calls")}
            {num("concurrency", "Concurrency", "Jobs in flight at once")}
            {num("batch_size", "Batch size", "Max jobs picked per round")}
            {num("max_retries", "Retry limit", "Attempts before a job fails")}
            {num("daily_request_limit", "Daily request limit", "Queue stops when reached")}
            {num("max_pdf_mb", "Max PDF size (MB)", "Up to 3 MB")}
          </div>
          <Button onClick={save}>Save settings</Button>
          <p className="text-xs text-muted-foreground">Criteria are managed on the <Link to="/criteria" className="text-primary">Evaluation Criteria</Link> page. Add a GitHub token in your project secrets as GITHUB_TOKEN to raise GitHub's 60-requests/hour public limit.</p>
        </div>
      </div>
    </>
  );
}
