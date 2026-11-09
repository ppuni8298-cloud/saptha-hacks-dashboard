import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { evaluateJob } from "./evaluate.functions";
import { logActivity } from "./db";

type Ctx = { running: boolean; current: number; start: () => Promise<void>; pause: () => Promise<void>; lastMessage: string | null };
const QueueCtx = createContext<Ctx | null>(null);
export const useQueueRunner = () => useContext(QueueCtx)!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function QueueRunnerProvider({ children }: { children: ReactNode }) {
  const run = useServerFn(evaluateJob);
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(0);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const stopRef = useRef(true);

  const setPaused = (paused: boolean) => supabase.from("system_settings").update({ queue_paused: paused }).eq("id", 1);

  const loop = useCallback(async () => {
    let backoff = 0;
    while (!stopRef.current) {
      const { data: s } = await supabase.from("system_settings").select("*").eq("id", 1).single();
      if (!s || s.queue_paused || s.quota_exhausted) {
        if (s?.quota_exhausted) setLastMessage(`Stopped: ${s.quota_message ?? "AI quota exhausted"}`);
        break;
      }
      const since = new Date(); since.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase.from("api_usage_logs").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString());
      if ((count ?? 0) >= s.daily_request_limit) {
        await supabase.from("system_settings").update({ queue_paused: true, quota_exhausted: true, quota_message: `Daily request limit (${s.daily_request_limit}) reached` }).eq("id", 1);
        setLastMessage("Daily request limit reached");
        break;
      }
      const { data: jobs } = await supabase.from("evaluation_jobs").select("id").eq("status", "queued").order("created_at").limit(Math.max(1, Math.min(s.concurrency, s.batch_size)));
      if (!jobs?.length) {
        await setPaused(true);
        setLastMessage("Queue finished");
        toast.success("Evaluation queue finished");
        break;
      }
      const gap = Math.ceil(60000 / Math.max(1, s.rpm));
      setCurrent(jobs.length);
      const results = await Promise.all(
        jobs.map(async (j, i) => {
          await sleep(i * gap);
          try { return await run({ data: { jobId: j.id } }); } catch (e) { return { outcome: "error", message: (e as Error).message } as any; }
        }),
      );
      setCurrent(0);
      qc.invalidateQueries();
      if (results.some((r) => r.outcome === "quota")) {
        const m = results.find((r) => r.outcome === "quota")?.message;
        setLastMessage(`Stopped: ${m ?? "AI quota or credits exhausted"}`);
        toast.error("AI quota/credits exhausted — queue paused. Resume manually when ready.");
        break;
      }
      const limited = results.find((r) => r.outcome === "rate_limited");
      if (limited) {
        backoff = Math.min(backoff ? backoff * 2 : (limited.retryAfter ?? 20) * 1000, 5 * 60000);
        setLastMessage(`Rate limited — backing off ${Math.round(backoff / 1000)}s`);
        await sleep(backoff + Math.random() * 1000);
      } else {
        backoff = 0;
        await sleep(gap);
      }
    }
    stopRef.current = true;
    setRunning(false);
    qc.invalidateQueries();
  }, [run, qc]);

  const start = useCallback(async () => {
    if (!stopRef.current) return;
    await supabase.from("system_settings").update({ queue_paused: false }).eq("id", 1);
    await logActivity("Queue started");
    stopRef.current = false;
    setRunning(true);
    setLastMessage(null);
    void loop();
  }, [loop]);

  const pause = useCallback(async () => {
    stopRef.current = true;
    await setPaused(true);
    await logActivity("Queue paused");
    setLastMessage("Paused — in-flight jobs will finish");
  }, []);

  useEffect(() => () => { stopRef.current = true; }, []);

  return <QueueCtx.Provider value={{ running, current, start, pause, lastMessage }}>{children}</QueueCtx.Provider>;
}
