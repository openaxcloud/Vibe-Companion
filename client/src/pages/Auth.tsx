import { useState, useEffect, useRef } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, Github, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.51-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.02 8.93 8.75c1.26.07 2.13.72 2.91.77.99-.2 1.95-.78 3.01-.71 1.28.1 2.24.6 2.87 1.5-2.63 1.57-2.01 5.01.33 5.97-.39 1.05-.9 2.09-1.01 4zm-4.72-15.27c.05 2.07-1.59 3.72-3.55 3.53-.22-1.89 1.64-3.73 3.55-3.53z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { login, register, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const [isLogin, setIsLogin] = useState(!params.get("signup"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const authConfigQuery = useQuery<{ recaptchaSiteKey: string | null; providers: Record<string, boolean> }>({
    queryKey: ["/api/auth/config"],
    queryFn: async () => {
      const res = await fetch("/api/auth/config");
      return res.json();
    },
    staleTime: 60000,
  });

  const providers = authConfigQuery.data?.providers || {};

  const promptHandled = useRef(false);

  useEffect(() => {
    const error = params.get("error");
    if (error) {
      const messages: Record<string, string> = {
        banned: "Your account has been suspended.",
        no_code: "Authentication failed - no authorization code received.",
        not_configured: "This login method is not configured yet.",
        token_failed: "Authentication failed - could not verify credentials.",
        github_failed: "GitHub authentication failed.",
        google_failed: "Google authentication failed.",
        apple_failed: "Apple authentication failed.",
        twitter_failed: "X/Twitter authentication failed.",
        replit_failed: "Replit authentication failed.",
        invalid_state: "Authentication failed - invalid security state. Please try again.",
      };
      toast({ title: "Authentication Error", description: messages[error] || "Authentication failed.", variant: "destructive" });
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const pendingPrompt = params.get("prompt");
    const pendingOutputType = params.get("outputType") || "web";
    if (pendingPrompt && !promptHandled.current) {
      promptHandled.current = true;
      (async () => {
        try {
          const res = await apiRequest("POST", "/api/projects", {
            name: pendingPrompt.slice(0, 50),
            language: "javascript",
            outputType: pendingOutputType,
          });
          const project = await res.json();
          setLocation(`/project/${project.id}?prompt=${encodeURIComponent(pendingPrompt)}&outputType=${pendingOutputType}`);
        } catch {
          setLocation("/dashboard");
        }
      })();
    } else {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
        <div className="w-8 h-8 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full animate-spin" />
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
        if (!acceptedTerms) {
          toast({ title: "Terms required", description: "You must accept the Terms of Service and Privacy Policy to create an account.", variant: "destructive" });
          return;
        }
        await register.mutateAsync({ email, password, displayName: displayName.trim() || undefined, acceptedTerms });
      }
    } catch (error: any) {
      toast({ title: isLogin ? "Login failed" : "Registration failed", description: error?.message || "Something went wrong", variant: "destructive" });
    }
  };

  const isSubmitting = login.isPending || register.isPending;

  const socialButtonClass = "w-full h-11 rounded-xl font-medium bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] hover:bg-[var(--ide-hover)] hover:border-[var(--ide-hover)] transition-all duration-200 gap-3";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ide-bg)] relative overflow-hidden">
      <AnimatedGrid />

      <div className="w-full max-w-[400px] px-6 z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-[var(--ide-panel)] border border-[var(--ide-border)]/80 shadow-[0_0_60px_rgba(242,101,34,0.15)]">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
              <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
              <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
            </svg>
          </div>
          <h1 className="text-[26px] font-bold text-[var(--ide-text)] tracking-tight mb-1.5">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-[var(--ide-text-secondary)] text-[13px]">
            {isLogin ? "Sign in to continue to E-Code" : "Start building on E-Code"}
          </p>
        </div>

        <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl p-7 shadow-lg">
          <div className="space-y-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className={socialButtonClass}
              data-testid="button-replit-login"
              onClick={() => {
                if (providers.replit) {
                  window.location.href = "/api/auth/replit";
                } else {
                  toast({ title: "Replit Sign-In", description: "Replit Sign-In is not available at this time. Please use another login method.", variant: "destructive" });
                }
              }}
            >
              <UserCheck className="w-5 h-5" />
              Continue with Replit
            </Button>
            <Button
              type="button"
              variant="outline"
              className={socialButtonClass}
              data-testid="button-github-login"
              onClick={() => {
                if (providers.github) {
                  window.location.href = "/api/auth/github/redirect";
                } else {
                  fetch("/api/auth/github", { method: "POST", headers: { "Content-Type": "application/json" } })
                    .then(r => r.json().then(data => {
                      if (r.ok && data.id) {
                        window.location.href = "/dashboard";
                      } else {
                        toast({ title: "GitHub Login", description: data.message || "Connect GitHub integration first", variant: "destructive" });
                      }
                    }))
                    .catch((err: any) => toast({ title: "GitHub Login Failed", description: err.message, variant: "destructive" }));
                }
              }}
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </Button>
            <Button
              type="button"
              variant="outline"
              className={socialButtonClass}
              data-testid="button-google-login"
              onClick={() => {
                if (providers.google) {
                  window.location.href = "/api/auth/google";
                } else {
                  toast({ title: "Google Sign-In", description: "Google Sign-In is not available at this time. Please use another login method.", variant: "destructive" });
                }
              }}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className={socialButtonClass}
              data-testid="button-apple-login"
              onClick={() => {
                if (providers.apple) {
                  window.location.href = "/api/auth/apple";
                } else {
                  toast({ title: "Apple Sign-In", description: "Apple Sign-In is not available at this time. Please use another login method.", variant: "destructive" });
                }
              }}
            >
              <AppleIcon />
              Continue with Apple
            </Button>
            <Button
              type="button"
              variant="outline"
              className={socialButtonClass}
              data-testid="button-twitter-login"
              onClick={() => {
                if (providers.twitter) {
                  window.location.href = "/api/auth/twitter";
                } else {
                  toast({ title: "X Sign-In", description: "X Sign-In is not available at this time. Please use another login method.", variant: "destructive" });
                }
              }}
            >
              <XIcon />
              Continue with X
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--ide-border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--ide-panel)] px-3 text-[var(--ide-text-muted)] uppercase tracking-wider font-medium">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-xs font-medium text-[var(--ide-text-secondary)]">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="How should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-11 rounded-xl text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-2 focus-visible:ring-[#0079F2]/40 focus-visible:border-[#0079F2] transition-all duration-200"
                  data-testid="input-display-name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-[var(--ide-text-secondary)]">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-11 rounded-xl text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-2 focus-visible:ring-[#0079F2]/40 focus-visible:border-[#0079F2] transition-all duration-200"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-[var(--ide-text-secondary)]">Password</Label>
                {isLogin && (
                  <Link href="/forgot-password" className="text-xs text-[#0079F2] hover:text-[#0079F2]/80 cursor-pointer transition-colors" data-testid="link-forgot-password">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? "Enter your password" : "Min. 8 chars, 1 uppercase, 1 number"}
                className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-11 rounded-xl text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-2 focus-visible:ring-[#0079F2]/40 focus-visible:border-[#0079F2] transition-all duration-200"
                data-testid="input-password"
              />
            </div>

            {!isLogin && (
              <label className="flex items-start gap-2 cursor-pointer mt-1" data-testid="checkbox-terms">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[var(--ide-border)] accent-[#0079F2]"
                />
                <span className="text-xs text-[var(--ide-text-secondary)] leading-relaxed">
                  I agree to the{" "}
                  <Link href="/terms" className="text-[#0079F2] hover:underline" target="_blank">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-[#0079F2] hover:underline" target="_blank">Privacy Policy</Link>
                </span>
              </label>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-xl font-semibold bg-[#0CCE6B] hover:bg-[#0CCE6B]/90 text-[#0E1525] shadow-[0_0_0_1px_rgba(12,206,107,0.4)] hover:shadow-[0_0_12px_rgba(12,206,107,0.3)] transition-all duration-200 mt-2"
              disabled={isSubmitting || (!isLogin && !acceptedTerms)}
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

          <p className="text-center text-sm text-[var(--ide-text-secondary)] mt-6 pt-5 border-t border-[var(--ide-border)]">
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
            className="flex items-center gap-2 text-xs text-[var(--ide-text-muted)] hover:text-[#0079F2] transition-colors duration-200"
            data-testid="link-demo"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Try the demo</span>
          </Link>
          <span className="text-[var(--ide-border)]">·</span>
          <Link href="/terms" className="text-xs text-[var(--ide-text-muted)] hover:text-[#0079F2] transition-colors" data-testid="link-terms">Terms</Link>
          <span className="text-[var(--ide-border)]">·</span>
          <Link href="/privacy" className="text-xs text-[var(--ide-text-muted)] hover:text-[#0079F2] transition-colors" data-testid="link-privacy">Privacy</Link>
        </div>
      </div>
    </div>
  );
}
