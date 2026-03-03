import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Zap, Eye } from "lucide-react";
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
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
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
      toast({
        title: isLogin ? "Login failed" : "Registration failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const isSubmitting = login.isPending || register.isPending;

  return (
    <div className="h-full flex flex-col p-6 bg-gradient-to-br from-background via-background to-primary/5 relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Vibe Platform</h1>
          <p className="text-muted-foreground">Code from anywhere. Build everything.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="glass-panel rounded-3xl p-6 shadow-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="developer@vibe.co" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-white/10 h-12 rounded-xl focus-visible:ring-primary/50"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 border-white/10 h-12 rounded-xl focus-visible:ring-primary/50"
                data-testid="input-password"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-md font-semibold bg-primary hover:bg-primary/90 mt-2 shadow-[0_0_20px_rgba(139,92,246,0.4)]"
              disabled={isSubmitting}
              data-testid="button-submit-auth"
            >
              {isSubmitting ? (
                <Sparkles className="w-5 h-5 animate-spin" />
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span 
              className="text-primary font-medium cursor-pointer hover:underline"
              onClick={() => setIsLogin(!isLogin)}
              data-testid="link-toggle-auth"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </span>
          </p>
        </motion.div>

        <Link href="/demo" className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <Eye className="w-4 h-4" />
          <span>Try the public demo</span>
        </Link>
      </div>
    </div>
  );
}
