import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard, Users, UserPlus, Upload, ListChecks, ListOrdered, ClipboardCheck, Trophy, FileDown, Settings, ScrollText, LogOut, Loader2, ShieldAlert, Menu, Gauge, Lightbulb, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QueueRunnerProvider, useQueueRunner } from "@/lib/queue-runner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/problem-statements", label: "Problem Statements", icon: Lightbulb },
  { to: "/qualification", label: "Team Qualification", icon: CheckCircle2 },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/teams/new", label: "Add Team", icon: UserPlus },
  { to: "/import", label: "Bulk Import", icon: Upload },
  { to: "/criteria", label: "Evaluation Criteria", icon: ListChecks },
  { to: "/queue", label: "Evaluation Queue", icon: ListOrdered },
  { to: "/evaluations", label: "Evaluations", icon: ClipboardCheck },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/reports", label: "Reports", icon: FileDown },
  { to: "/usage", label: "API Usage", icon: Gauge },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/activity", label: "Activity Logs", icon: ScrollText },
] as const;

function Layout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const admin = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("claim_first_admin");
      return !!data;
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (admin.isLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  if (!admin.data)
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Not an authorised admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user.email} is signed in but has no administrator access.</p>
          <Button className="mt-6" variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );

  return (
    <QueueRunnerProvider>
      <Shell email={user.email ?? ""} onSignOut={signOut} />
    </QueueRunnerProvider>
  );
}

function Shell({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const q = useQueueRunner();
  return (
    <div className="flex min-h-screen">
      <aside className={cn("no-print fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-16 items-center gap-3 px-4">
          <img src="/innovedge-logo.png" alt="INNOVEDGE" className="size-10 rounded-lg object-contain bg-background/50 p-0.5 border border-sidebar-border shadow-sm" />
          <div>
            <div className="font-display text-sm font-bold tracking-wide text-sidebar-accent-foreground">INNOVEDGE</div>
            <div className="text-[11px] text-muted-foreground font-medium">Assessor Platform</div>
          </div>
        </div>
        <nav className="space-y-0.5 px-3 py-2">
          {NAV.map((n) => {
            const active = n.to === "/teams" ? path === "/teams" || (path.startsWith("/teams/") && path !== "/teams/new") : path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground")}>
                <n.icon className={cn("size-4", active && "text-primary")} />
                {n.label}
                {n.to === "/queue" && q.running && <span className="ml-auto size-2 animate-pulse rounded-full bg-success" />}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-4">
          <div className="truncate text-xs text-muted-foreground">{email}</div>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={onSignOut}><LogOut className="size-4" /> Sign out</Button>
        </div>
      </aside>
      <div className="flex-1 lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
          <Button size="icon" variant="ghost" onClick={() => setOpen(!open)}><Menu className="size-5" /></Button>
          <div className="flex items-center gap-2">
            <img src="/innovedge-logo.png" alt="INNOVEDGE" className="size-7 object-contain rounded" />
            <span className="font-display font-semibold text-sm">INNOVEDGE</span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8"><Outlet /></main>
      </div>
      {open && <div className="fixed inset-0 z-30 bg-background/60 lg:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}

