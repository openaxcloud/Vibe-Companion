import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Mail, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ide-bg)] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #0079F2 1px, transparent 0)`, backgroundSize: "40px 40px" }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-[#0079F2]/8 via-[#0079F2]/2 to-transparent rounded-full blur-3xl" />
      </div>
      <div className="w-full max-w-[400px] px-6 z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] mb-8 transition-colors" data-testid="link-back-login">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>

        <div className="bg-[var(--ide-panel)]/80 backdrop-blur-md border border-[var(--ide-border)] rounded-2xl p-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {sent ? (
            <div className="text-center py-4" data-testid="text-reset-sent">
              <div className="w-14 h-14 rounded-full bg-[#0CCE6B]/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-[#0CCE6B]" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-2">Check your email</h2>
              <p className="text-sm text-[var(--ide-text-secondary)] mb-6">If an account exists with <span className="text-[var(--ide-text)]">{email}</span>, we've sent password reset instructions.</p>
              <Button onClick={() => { setSent(false); setEmail(""); }} variant="outline" className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]" data-testid="button-try-again">
                Try another email
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-[#0079F2]/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-[#0079F2]" />
                </div>
                <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-1">Reset your password</h2>
                <p className="text-sm text-[var(--ide-text-secondary)]">Enter your email and we'll send you a reset link</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-[var(--ide-text-secondary)]">Email address</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-11 rounded-xl text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)]"
                    placeholder="you@example.com" data-testid="input-email" />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white" data-testid="button-send-reset">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
