import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Code2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isRegister = location === "/register";

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((user) => {
        if (user) redirectAfterLogin();
      })
      .catch(() => {});
  }, []);

  function redirectAfterLogin() {
    const pendingBuild = sessionStorage.getItem("pendingAppDescription");
    const triggerBuild = sessionStorage.getItem("triggerBuildOnLanding");
    if (pendingBuild || triggerBuild === "true") {
      navigate("/");
      return;
    }
    navigate("/dashboard");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isRegister && !username) return;
    setLoading(true);
    try {
      let csrfToken: string | undefined;
      try {
        const csrfRes = await fetch("/api/csrf-token", { credentials: "include" });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          csrfToken = csrfData.csrfToken;
        }
      } catch {}

      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? JSON.stringify({ email, username, password })
        : JSON.stringify({ email, password });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        credentials: "include",
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (isRegister ? "Registration failed" : "Login failed"));
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });

      toast({
        title: isRegister ? "Account created!" : "Welcome back!",
        description: isRegister ? "Your account is ready." : "Logged in successfully.",
      });
      redirectAfterLogin();
    } catch (err: any) {
      toast({
        title: isRegister ? "Registration failed" : "Login failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ide-bg)] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #0079F2 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-[#0079F2]/8 via-[#0079F2]/2 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[400px] px-6 z-10">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-[#0079F2] flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-[var(--ide-text)]">E-Code</span>
        </div>

        <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl p-7 shadow-lg">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-1">
              {isRegister ? "Create your account" : "Sign in to E-Code"}
            </h2>
            <p className="text-sm text-[var(--ide-text-secondary)]">
              {isRegister ? "Start building apps with AI" : "Build apps with AI — faster than ever"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-[var(--ide-text-secondary)] text-[13px]">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] placeholder:text-[var(--ide-text-secondary)]/50 h-10"
                  data-testid="input-username"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[var(--ide-text-secondary)] text-[13px]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={!isRegister}
                className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] placeholder:text-[var(--ide-text-secondary)]/50 h-10"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[var(--ide-text-secondary)] text-[13px]">
                  Password
                </Label>
                {!isRegister && (
                  <Link
                    href="/forgot-password"
                    className="text-[12px] text-[#0079F2] hover:underline"
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isRegister ? 6 : undefined}
                  className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] placeholder:text-[var(--ide-text-secondary)]/50 h-10 pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password || (isRegister && !username)}
              className="w-full bg-[#0079F2] hover:bg-[#0068D6] text-white h-10 font-medium"
              data-testid={isRegister ? "button-register" : "button-login"}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isRegister ? "Creating account…" : "Signing in…"}
                </>
              ) : (
                isRegister ? "Create account" : "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-[13px] text-[var(--ide-text-secondary)]">
              {isRegister ? (
                <>
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#0079F2] hover:underline font-medium" data-testid="link-login">
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  Don't have an account?{" "}
                  <Link href="/register" className="text-[#0079F2] hover:underline font-medium" data-testid="link-register">
                    Sign up free
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
