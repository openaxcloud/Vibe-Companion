import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Zap, Eye, Code2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { login, register, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0d1117]">
        <div className="w-8 h-8 border-2 border-[#30363d] border-t-[#58a6ff] rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    setLocation("/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login.mutateAsync({ email, password });
      } else {
        await register.mutateAsync({ email, password });
      }
    } catch (error: any) {
      const msg = error?.message?.includes(":")
        ? error.message.split(":").slice(1).join(":").trim()
        : error?.message || "Something went wrong";
      toast({ title: isLogin ? "Login failed" : "Registration failed", description: msg, variant: "destructive" });
    }
  };

  const isSubmitting = login.isPending || register.isPending;

  return (
    <div className="h-full flex flex-col bg-[#0d1117] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#58a6ff]/5 via-transparent to-transparent pointer-events-none" />

      <div className="flex-1 flex flex-col justify-center px-6 max-w-sm mx-auto w-full z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="w-14 h-14 bg-[#161b22] rounded-2xl flex items-center justify-center mx-auto mb-5 border border-[#30363d] shadow-[0_0_30px_rgba(88,166,255,0.15)]">
            <Code2 className="w-7 h-7 text-[#58a6ff]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Vibe Platform</h1>
          <p className="text-[#8b949e] text-sm">Code from anywhere. Build everything.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[11px] text-[#8b949e]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="developer@vibe.co"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0d1117] border-[#30363d] h-10 rounded-lg text-[#c9d1d9] placeholder:text-[#484f58] focus-visible:ring-[#58a6ff]/50 focus-visible:border-[#58a6ff]"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[11px] text-[#8b949e]">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="bg-[#0d1117] border-[#30363d] h-10 rounded-lg text-[#c9d1d9] placeholder:text-[#484f58] focus-visible:ring-[#58a6ff]/50 focus-visible:border-[#58a6ff]"
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white mt-1"
              disabled={isSubmitting}
              data-testid="button-submit-auth"
            >
              {isSubmitting ? (
                <Sparkles className="w-4 h-4 animate-spin" />
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-[#8b949e] mt-5">
            {isLogin ? "New here? " : "Already have an account? "}
            <span
              className="text-[#58a6ff] font-medium cursor-pointer hover:underline"
              onClick={() => setIsLogin(!isLogin)}
              data-testid="link-toggle-auth"
            >
              {isLogin ? "Create an account" : "Sign in"}
            </span>
          </p>
        </motion.div>

        <Link href="/demo" className="mt-8 flex items-center justify-center gap-2 text-xs text-[#484f58] hover:text-[#58a6ff] transition-colors">
          <Eye className="w-3.5 h-3.5" />
          <span>Try the public demo</span>
        </Link>
      </div>
    </div>
  );
}
