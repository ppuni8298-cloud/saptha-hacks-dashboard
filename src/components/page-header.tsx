import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, desc, children }: { title: string; desc?: string | undefined; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      <div className="no-print flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone: Record<string, string> = {
    pending: "bg-muted text-muted-foreground", queued: "bg-muted text-muted-foreground", cancelled: "bg-muted text-muted-foreground",
    processing: "bg-primary/20 text-primary", completed: "bg-violet/20 text-violet",
    done: "bg-success/20 text-success", approved: "bg-success/20 text-success",
    failed: "bg-destructive/20 text-destructive", rejected: "bg-destructive/20 text-destructive",
    stale: "bg-warning/20 text-warning", "needs review": "bg-warning/20 text-warning", "not started": "bg-muted text-muted-foreground",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", tone[status] ?? "bg-muted text-muted-foreground", className)}>{status}</span>;
}

export function Empty({ title, desc, children }: { title: string; desc?: string | undefined; children?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <p className="font-display font-medium">{title}</p>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

export const fmt = (n: number | null | undefined, d = 1) => (n == null ? "—" : Number(n).toFixed(d).replace(/\.0+$/, ""));
