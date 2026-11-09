import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { isAllowedAccount } from "@/lib/submission";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin sign in — INNOVEDGE Assessor" },
      { name: "description", content: "Sign in to the INNOVEDGE AI project evaluation admin console." },
      { property: "og:title", content: "Admin sign in — INNOVEDGE Assessor" },
      { property: "og:description", content: "Sign in to the INNOVEDGE AI project evaluation admin console." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowedAccount(email)) return toast.error("This ID is not authorised.");
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
      navigate({ to: "/dashboard" });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("If that account exists, a reset link is on its way.");
      setMode("login");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass w-full max-w-sm rounded-2xl p-8">
        <div className="flex flex-col items-center text-center mb-5">
          <img src="/innovedge-logo.png" alt="INNOVEDGE Logo" className="size-20 object-contain drop-shadow-md mb-2" />
          <div className="font-display text-lg font-bold tracking-wider text-foreground">INNOVEDGE</div>
          <div className="text-[10px] tracking-widest uppercase font-semibold text-primary/80">Innovation • Entrepreneurship • Excellence</div>
        </div>
        <h1 className="text-xl font-semibold text-center">{mode === "login" ? "Admin Sign In" : "Reset Password"}</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">Restricted to authorised evaluation administrators.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">ID (email)</Label><Input id="email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {mode !== "forgot" && <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><PasswordInput id="pw" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
          <Button className="w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{mode === "login" ? "Sign in" : "Send reset link"}</Button>
        </form>
        <div className="mt-4 flex justify-between text-sm text-muted-foreground">
          {mode === "login" ? (<>
             <Button variant="link" onClick={() => { setPassword(""); setMode("forgot"); }}>Forgot password?</Button>
           </>) : <Button variant="link" onClick={() => setMode("login")}>Back to sign in</Button>}
        </div>
      </motion.div>
    </div>
  );
}
