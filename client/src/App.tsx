import { Switch, Route, Redirect, useParams } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
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
import VerifyEmail from "@/pages/VerifyEmail";
import AcceptInvite from "@/pages/AcceptInvite";
import { useAuth } from "@/hooks/use-auth";
import { Component, type ReactNode } from "react";
import Project from "@/pages/Project";
import UnifiedIDELayout from "@/pages/UnifiedIDELayout";
import Frameworks from "@/pages/Frameworks";
import ThemeEditor from "@/pages/ThemeEditor";
import ThemesExplore from "@/pages/ThemesExplore";
import Import from "@/pages/Import";
import AccountCLI from "@/pages/AccountCLI";
import Desktop from "@/pages/Desktop";
import McpDirectory from "@/pages/McpDirectory";
import McpInstallLink from "@/pages/McpInstallLink";
import OpenInReplit from "@/pages/OpenInReplit";
import Documentation from "@/pages/Documentation";
import Community from "@/pages/Community";
import HelpCenter from "@/pages/HelpCenter";
import { ThemeProvider } from "@/components/ThemeProvider";
import GlobalShortcuts from "@/components/GlobalShortcuts";
import CookieConsent from "@/components/CookieConsent";

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
        <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)] text-[var(--ide-text)]">
          <div className="text-center max-w-md px-6" data-testid="error-boundary">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-[var(--ide-text-secondary)] mb-4">{this.state.error?.message || "An unexpected error occurred."}</p>
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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
        <div className="w-8 h-8 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function ProjectRoute() {
  return <Project />;
}

function UnifiedProjectRoute() {
  const params = useParams<{ id: string }>();
  return <UnifiedIDELayout projectId={params.id || ''} />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <a href="#main-content" className="skip-to-main">Skip to main content</a>
            <div id="main-content" className="h-screen w-screen bg-[var(--ide-bg)] text-[var(--ide-text)]" role="application" aria-label="E-Code IDE">
              <Switch>
                <Route path="/" component={Landing} />
                <Route path="/login" component={Auth} />
                <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
                <Route path="/project/:id">{() => <ProtectedRoute component={UnifiedProjectRoute} />}</Route>
                <Route path="/ide/:id">{() => <ProtectedRoute component={UnifiedProjectRoute} />}</Route>
                <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
                <Route path="/teams">{() => <ProtectedRoute component={Teams} />}</Route>
                <Route path="/admin">{() => <ProtectedRoute component={Admin} />}</Route>
                <Route path="/frameworks">{() => <ProtectedRoute component={Frameworks} />}</Route>
                <Route path="/frameworks/:id">{() => <ProtectedRoute component={Frameworks} />}</Route>
                <Route path="/themes">{() => <ProtectedRoute component={ThemesExplore} />}</Route>
                <Route path="/themes/editor">{() => <ProtectedRoute component={ThemeEditor} />}</Route>
                <Route path="/themes/editor/:id">{() => <ProtectedRoute component={ThemeEditor} />}</Route>
                <Route path="/import">{() => <ProtectedRoute component={Import} />}</Route>
                <Route path="/cli">{() => <ProtectedRoute component={AccountCLI} />}</Route>
                <Route path="/mcp-directory" component={McpDirectory} />
                <Route path="/mcp-install-link">{() => <ProtectedRoute component={McpInstallLink} />}</Route>
                <Route path="/open" component={OpenInReplit} />
                <Route path="/desktop" component={Desktop} />
                <Route path="/docs">{() => <ProtectedRoute component={Documentation} />}</Route>
                <Route path="/community">{() => <ProtectedRoute component={Community} />}</Route>
                <Route path="/help">{() => <ProtectedRoute component={HelpCenter} />}</Route>
                <Route path="/pricing" component={Pricing} />
                <Route path="/demo" component={DemoProject} />
                <Route path="/shared/:id" component={SharedProject} />
                <Route path="/invite/:token" component={AcceptInvite} />
                <Route path="/forgot-password" component={ForgotPassword} />
                <Route path="/reset-password" component={ResetPassword} />
                <Route path="/terms" component={Terms} />
                <Route path="/privacy" component={Privacy} />
                <Route path="/verify-email" component={VerifyEmail} />
                <Route component={NotFound} />
              </Switch>
            </div>
            <GlobalShortcuts />
            <CookieConsent />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
