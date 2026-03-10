import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Lock, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message || "Invalid or expired token", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E1525] text-[#F5F9FC]">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Invalid reset link</h2>
          <p className="text-sm text-[#9DA2B0] mb-4">This password reset link is invalid or has expired.</p>
          <Link href="/forgot-password" className="text-[#0079F2] text-sm">Request a new one</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E1525] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #0079F2 1px, transparent 0)`, backgroundSize: "40px 40px" }} />
      </div>
      <div className="w-full max-w-[400px] px-6 z-10">
        <div className="bg-[#1C2333]/80 backdrop-blur-md border border-[#2B3245] rounded-2xl p-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {success ? (
            <div className="text-center py-4" data-testid="text-reset-success">
              <div className="w-14 h-14 rounded-full bg-[#0CCE6B]/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-[#0CCE6B]" />
              </div>
              <h2 className="text-lg font-semibold text-[#F5F9FC] mb-2">Password reset!</h2>
              <p className="text-sm text-[#9DA2B0] mb-6">Your password has been updated. You can now sign in.</p>
              <Button onClick={() => setLocation("/")} className="bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-xl" data-testid="button-go-login">
                Go to login
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-[#0079F2]/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-7 h-7 text-[#0079F2]" />
                </div>
                <h2 className="text-lg font-semibold text-[#F5F9FC] mb-1">Set new password</h2>
                <p className="text-sm text-[#9DA2B0]">Choose a strong password for your account</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-[#9DA2B0]">New password</Label>
                  <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#0E1525] border-[#2B3245] h-11 rounded-xl text-[#F5F9FC]" placeholder="Min. 6 characters" data-testid="input-new-password" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-[#9DA2B0]">Confirm password</Label>
                  <Input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    className="bg-[#0E1525] border-[#2B3245] h-11 rounded-xl text-[#F5F9FC]" placeholder="Type password again" data-testid="input-confirm-password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white" data-testid="button-reset-password">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
