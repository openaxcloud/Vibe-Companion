import { useLocation, useRoute, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Project from "@/pages/Project";
import Settings from "@/pages/Settings";
import DemoProject from "@/pages/DemoProject";
import SharedProject from "@/pages/SharedProject";
import Pricing from "@/pages/Pricing";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Teams from "@/pages/Teams";
import Admin from "@/pages/Admin";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import { useAuth } from "@/hooks/use-auth";
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    try {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "frontend_error", properties: { message: error.message, stack: error.stack?.slice(0, 500) } }),
      }).catch(() => {});
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-[#0E1525] text-[#F5F9FC]">
          <div className="text-center max-w-md px-6" data-testid="error-boundary">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-[#9DA2B0] mb-4">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-4 py-2 bg-[#0079F2] hover:bg-[#0066CC] text-white text-sm rounded-lg transition-colors"
              data-testid="button-reload"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedPage({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0E1525]">
        <div className="w-8 h-8 border-2 border-[#2B3245] border-t-[#0079F2] rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/" />;
  return <>{children}</>;
}

function ProtectedDashboard() {
  return <ProtectedPage><Dashboard /></ProtectedPage>;
}

function ProtectedProject() {
  return <ProtectedPage><Project /></ProtectedPage>;
}

function ProtectedSettings() {
  return <ProtectedPage><Settings /></ProtectedPage>;
}

function ProtectedTeams() {
  return <ProtectedPage><Teams /></ProtectedPage>;
}

function ProtectedAdmin() {
  return <ProtectedPage><Admin /></ProtectedPage>;
}

function AppRoutes() {
  const [location] = useLocation();

  const [isHome] = useRoute("/");
  const [isDashboard] = useRoute("/dashboard");
  const [isProject, projectParams] = useRoute("/project/:id");
  const [isSettings] = useRoute("/settings");
  const [isTeams] = useRoute("/teams");
  const [isAdmin] = useRoute("/admin");
  const [isPricing] = useRoute("/pricing");
  const [isDemo] = useRoute("/demo");
  const [isShared] = useRoute("/shared/:id");
  const [isForgot] = useRoute("/forgot-password");
  const [isReset] = useRoute("/reset-password");
  const [isTerms] = useRoute("/terms");
  const [isPrivacy] = useRoute("/privacy");

  if (isHome) return <Auth />;
  if (isDashboard) return <ProtectedDashboard key="dashboard" />;
  if (isProject) return <ProtectedProject key={`project-${projectParams?.id}`} />;
  if (isSettings) return <ProtectedSettings key="settings" />;
  if (isTeams) return <ProtectedTeams key="teams" />;
  if (isAdmin) return <ProtectedAdmin key="admin" />;
  if (isPricing) return <Pricing />;
  if (isDemo) return <DemoProject />;
  if (isShared) return <SharedProject />;
  if (isForgot) return <ForgotPassword />;
  if (isReset) return <ResetPassword />;
  if (isTerms) return <Terms />;
  if (isPrivacy) return <Privacy />;
  return <NotFound />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="h-screen w-screen overflow-hidden bg-[#0E1525]">
            <AppRoutes />
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
