import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { isAllowedAccount } from "@/lib/submission";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Set new password — Assessor" },
      { name: "description", content: "Choose a new admin password." },
      { property: "og:title", content: "Set new password — Assessor" },
      { property: "og:description", content: "Choose a new admin password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") === "recovery") setRecovery(true);
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.auth.getUser();
    if (!recovery || !data.user || !isAllowedAccount(data.user.email ?? "")) return toast.error("Open a valid password reset link from your email.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 rounded-2xl p-8">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        {!recovery && <p className="text-sm text-muted-foreground">Open the password reset link from your email to continue.</p>}
        <div className="space-y-1.5"><Label htmlFor="pw">New password</Label><PasswordInput id="pw" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button className="w-full" disabled={busy || !recovery}>Update password</Button>
      </form>
    </div>
  );
}
