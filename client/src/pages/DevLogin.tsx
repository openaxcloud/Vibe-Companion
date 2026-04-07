import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useLocation } from "wouter";

export default function DevLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/dev-auth/login');
      if (res.ok) {
        toast({
          title: "Logged in successfully",
          description: "Welcome to E-Code!",
        });
        // Reload to update auth state
        window.location.href = '/projects';
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBypassAuth = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('GET', '/api/debug/bypass-auth/enable');
      if (res.ok) {
        toast({
          title: "Auth bypass enabled",
          description: "You can now access protected routes",
        });
        // Reload to update auth state
        window.location.href = '/projects';
      }
    } catch (error) {
      toast({
        title: "Failed to enable auth bypass",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Development Login</CardTitle>
          <CardDescription>
            This is a development-only login page. In production, use the proper authentication flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleDevLogin} 
            className="w-full" 
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login as Test User"}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button 
            onClick={handleBypassAuth} 
            className="w-full" 
            variant="outline"
            disabled={loading}
          >
            Enable Auth Bypass (Dev Only)
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Note: This page is only available in development mode
          </p>
        </CardContent>
      </Card>
    </div>
  );
}