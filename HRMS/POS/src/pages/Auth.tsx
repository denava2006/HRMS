import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const normalizedEmail = email.trim().toLowerCase();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    nav("/", { replace: true });
  };

  const handleForgotPassword = async () => {
    if (!normalizedEmail) return toast.error("Enter your email above first, then tap Forgot password.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent! Check your email.");
  };


  return (
    <div className="min-h-screen flex flex-col bg-gradient-soft relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-success/10 blur-3xl" />


      <div className="relative flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-7 md:p-9 shadow-elevated border-border/50 animate-scale-in bg-card/95 backdrop-blur-xl">
          <div className="flex flex-col items-center mb-7">
            <Logo height={72} className="mb-6" />
            <h1 className="text-2xl font-bold text-center">Sync Your Store. Grow Your Business.</h1>
            <p className="text-sm text-muted-foreground mt-1.5">Welcome to SariSync</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 transition-all focus-visible:ring-primary" /></Field>
            <Field label="Password"><PasswordInput required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="h-11 transition-all focus-visible:ring-primary" /></Field>
            <div className="flex justify-end">
              <button type="button" onClick={handleForgotPassword} disabled={busy} className="text-xs text-primary hover:underline disabled:opacity-50">Forgot password?</button>
            </div>
            <Button type="submit" disabled={busy} className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-pop transition-all">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Login"}
            </Button>
          </form>
          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Accounts are created by your store Admin. This offline POS signs in against Supabase running on this computer.
          </p>

        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-sm">{label}</Label>{children}</div>;
}
