import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, Github } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #0079F2 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-[#0079F2]/8 via-[#0079F2]/2 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-gradient-radial from-[#7C65CB]/5 via-transparent to-transparent rounded-full blur-3xl" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const { login, register, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (isAuthenticated) setLocation("/dashboard");
  }, [isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0E1525]">
        <div className="w-8 h-8 border-2 border-[#2B3245] border-t-[#0079F2] rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login.mutateAsync({ email, password });
      } else {
        await register.mutateAsync({ email, password, displayName: displayName.trim() || undefined });
      }
    } catch (error: any) {
      toast({ title: isLogin ? "Login failed" : "Registration failed", description: error?.message || "Something went wrong", variant: "destructive" });
    }
  };

  const isSubmitting = login.isPending || register.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E1525] relative overflow-hidden">
      <AnimatedGrid />

      <div className="w-full max-w-[400px] px-6 z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-[#1C2333] border border-[#2B3245] shadow-[0_0_40px_rgba(242,101,34,0.12)]">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
              <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
              <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
            </svg>
          </div>
          <h1 className="text-[28px] font-bold text-[#F5F9FC] tracking-tight mb-2">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-[#9DA2B0] text-[14px]">
            {isLogin ? "Sign in to continue to Replit" : "Start building with Replit"}
          </p>
        </div>

        <div className="bg-[#1C2333]/80 backdrop-blur-md border border-[#2B3245] rounded-2xl p-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="space-y-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl font-medium bg-[#0E1525] border-[#2B3245] text-[#F5F9FC] hover:bg-[#323B4F] hover:border-[#323B4F] transition-all duration-200 gap-3"
              data-testid="button-github-login"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl font-medium bg-[#0E1525] border-[#2B3245] text-[#F5F9FC] hover:bg-[#323B4F] hover:border-[#323B4F] transition-all duration-200 gap-3"
              data-testid="button-google-login"
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2B3245]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#1C2333] px-3 text-[#676D7E] uppercase tracking-wider font-medium">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-xs font-medium text-[#9DA2B0]">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="How should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-[#0E1525] border-[#2B3245] h-11 rounded-xl text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-2 focus-visible:ring-[#0079F2]/40 focus-visible:border-[#0079F2] transition-all duration-200"
                  data-testid="input-display-name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-[#9DA2B0]">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0E1525] border-[#2B3245] h-11 rounded-xl text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-2 focus-visible:ring-[#0079F2]/40 focus-visible:border-[#0079F2] transition-all duration-200"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-[#9DA2B0]">Password</Label>
                {isLogin && (
                  <span className="text-xs text-[#0079F2] hover:text-[#0079F2]/80 cursor-pointer transition-colors" data-testid="link-forgot-password">
                    Forgot password?
                  </span>
                )}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? "Enter your password" : "Min. 6 characters"}
                className="bg-[#0E1525] border-[#2B3245] h-11 rounded-xl text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-2 focus-visible:ring-[#0079F2]/40 focus-visible:border-[#0079F2] transition-all duration-200"
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl font-semibold bg-[#0CCE6B] hover:bg-[#0CCE6B]/90 text-[#0E1525] shadow-[0_0_0_1px_rgba(12,206,107,0.4)] hover:shadow-[0_0_12px_rgba(12,206,107,0.3)] transition-all duration-200 mt-2"
              disabled={isSubmitting}
              data-testid="button-submit-auth"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-[#9DA2B0] mt-6 pt-5 border-t border-[#2B3245]">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span
              className="text-[#0079F2] font-medium cursor-pointer hover:text-[#0079F2]/80 transition-colors"
              onClick={() => setIsLogin(!isLogin)}
              data-testid="link-toggle-auth"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </span>
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6">
          <Link
            href="/demo"
            className="flex items-center gap-2 text-xs text-[#676D7E] hover:text-[#0079F2] transition-colors duration-200"
            data-testid="link-demo"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Try the demo</span>
          </Link>
          <span className="text-[#2B3245]">·</span>
          <span className="text-xs text-[#676D7E]">Terms</span>
          <span className="text-[#2B3245]">·</span>
          <span className="text-xs text-[#676D7E]">Privacy</span>
        </div>
      </div>
    </div>
  );
}
