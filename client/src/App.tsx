import { Switch, Route, Redirect, useParams, Router } from "wouter";
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
import { useAsyncBrowserLocation } from "@/hooks/use-async-location";
import { Component, lazy, Suspense, startTransition, useState, useEffect, type ReactNode } from "react";
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

const Compare = lazy(() => import("@/pages/marketing/Compare"));
const VsAwsCloud9 = lazy(() => import("@/pages/marketing/VsAwsCloud9"));
const VsCodeSandbox = lazy(() => import("@/pages/marketing/VsCodeSandbox"));
const VsGitHubCodespaces = lazy(() => import("@/pages/marketing/VsGitHubCodespaces"));
const VsGlitch = lazy(() => import("@/pages/marketing/VsGlitch"));
const VsHeroku = lazy(() => import("@/pages/marketing/VsHeroku"));
const ComparePage = lazy(() => import("@/pages/compare/ComparePage"));
const Bounties = lazy(() => import("@/pages/marketing/Bounties"));

const AppBuilder = lazy(() => import("@/pages/solutions/AppBuilder"));
const ChatbotBuilder = lazy(() => import("@/pages/solutions/ChatbotBuilder"));
const DashboardBuilder = lazy(() => import("@/pages/solutions/DashboardBuilder"));
const Enterprise = lazy(() => import("@/pages/solutions/Enterprise"));
const Freelancers = lazy(() => import("@/pages/solutions/Freelancers"));
const GameBuilder = lazy(() => import("@/pages/solutions/GameBuilder"));
const InternalAIBuilder = lazy(() => import("@/pages/solutions/InternalAIBuilder"));
const Startups = lazy(() => import("@/pages/solutions/Startups"));
const WebsiteBuilder = lazy(() => import("@/pages/solutions/WebsiteBuilder"));

const About = lazy(() => import("@/pages/About"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogDetail = lazy(() => import("@/pages/BlogDetail"));
const Careers = lazy(() => import("@/pages/Careers"));
const Contact = lazy(() => import("@/pages/Contact"));
const ContactSales = lazy(() => import("@/pages/ContactSales"));
const Education = lazy(() => import("@/pages/Education"));
const Features = lazy(() => import("@/pages/Features"));
const Partners = lazy(() => import("@/pages/Partners"));
const Press = lazy(() => import("@/pages/Press"));
const Status = lazy(() => import("@/pages/Status"));
const Support = lazy(() => import("@/pages/Support"));
const Explore = lazy(() => import("@/pages/Explore"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const TemplateMarketplace = lazy(() => import("@/pages/TemplateMarketplace"));
const Languages = lazy(() => import("@/pages/Languages"));
const Learn = lazy(() => import("@/pages/Learn"));
const Security = lazy(() => import("@/pages/Security"));
const Scalability = lazy(() => import("@/pages/Scalability"));
const DPA = lazy(() => import("@/pages/DPA"));
const CommercialAgreement = lazy(() => import("@/pages/CommercialAgreement"));
const StudentDPA = lazy(() => import("@/pages/StudentDPA"));
const Subprocessors = lazy(() => import("@/pages/Subprocessors"));
const Accessibility = lazy(() => import("@/pages/Accessibility"));
const NewsletterConfirm = lazy(() => import("@/pages/NewsletterConfirm"));
const NewsletterConfirmed = lazy(() => import("@/pages/NewsletterConfirmed"));
const NewsletterUnsubscribe = lazy(() => import("@/pages/NewsletterUnsubscribe"));
const AIAgent = lazy(() => import("@/pages/AIAgent"));
const AIPlatform = lazy(() => import("@/pages/AIPlatform"));
const MobilePage = lazy(() => import("@/pages/Mobile"));
const Deployments = lazy(() => import("@/pages/Deployments"));
const TeamsOverview = lazy(() => import("@/pages/TeamsOverview"));
const ReportAbuse = lazy(() => import("@/pages/ReportAbuse"));
const Tutorials = lazy(() => import("@/pages/resources/Tutorials"));
const Changelog = lazy(() => import("@/pages/resources/Changelog"));
const CaseStudies = lazy(() => import("@/pages/resources/CaseStudies"));
const HelpCenterPage = lazy(() => import("@/pages/resources/HelpCenter"));

function LazyPage({ component: C }: { component: React.LazyExoticComponent<React.ComponentType> }) {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]"><div className="w-8 h-8 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full animate-spin" /></div>}>
      <C />
    </Suspense>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; retryCount: number }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // React 19 Error #310: "A component suspended while responding to synchronous input"
    // This is a TRANSIENT error — it only happens when lazy chunks haven't loaded yet.
    // By the time we retry, the chunks are cached and the render succeeds.
    const isSyncSuspenseError =
      error.message?.includes('#310') ||
      error.message?.includes('synchronous input') ||
      error.message?.includes('suspended while responding');

    if (isSyncSuspenseError && this.state.retryCount < 3) {
      console.warn(`[ErrorBoundary] Transient sync suspension error, auto-retrying (attempt ${this.state.retryCount + 1}/3)...`);
      setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 100);
      return;
    }

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
              onClick={() => { this.setState({ hasError: false, error: null, retryCount: 0 }); window.location.reload(); }}
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
  // Use startTransition to decouple react-query's useSyncExternalStore from
  // rendering the component tree. Without this, when the auth query resolves,
  // react-query triggers a synchronous re-render via useSyncExternalStore,
  // and any lazy component in the tree would cause React 19 Error #310.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !ready) {
      startTransition(() => {
        setReady(true);
      });
    }
    // Reset if user logs out
    if (!isAuthenticated && ready) {
      setReady(false);
    }
  }, [isLoading, isAuthenticated, ready]);

  if (isLoading || (isAuthenticated && !ready)) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]">
        <div className="w-8 h-8 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[var(--ide-bg)]"><div className="w-8 h-8 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full animate-spin" /></div>}>
      <Component />
    </Suspense>
  );
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
            <div id="main-content" className="h-screen w-screen bg-[var(--ide-bg)] text-[var(--ide-text)]" role="application" aria-label="Vibe Companion IDE">
              <Router hook={useAsyncBrowserLocation}>
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
                <Route path="/docs" component={Documentation} />
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

                {/* Marketing: Compare */}
                <Route path="/compare">{() => <LazyPage component={Compare} />}</Route>
                <Route path="/compare/vs-aws-cloud9">{() => <LazyPage component={VsAwsCloud9} />}</Route>
                <Route path="/compare/vs-codesandbox">{() => <LazyPage component={VsCodeSandbox} />}</Route>
                <Route path="/compare/vs-github-codespaces">{() => <LazyPage component={VsGitHubCodespaces} />}</Route>
                <Route path="/compare/vs-glitch">{() => <LazyPage component={VsGlitch} />}</Route>
                <Route path="/compare/vs-heroku">{() => <LazyPage component={VsHeroku} />}</Route>
                <Route path="/compare/:slug">{() => <LazyPage component={ComparePage} />}</Route>
                <Route path="/bounties">{() => <LazyPage component={Bounties} />}</Route>

                {/* Solutions */}
                <Route path="/solutions/app-builder">{() => <LazyPage component={AppBuilder} />}</Route>
                <Route path="/solutions/chatbot-builder">{() => <LazyPage component={ChatbotBuilder} />}</Route>
                <Route path="/solutions/dashboard-builder">{() => <LazyPage component={DashboardBuilder} />}</Route>
                <Route path="/solutions/enterprise">{() => <LazyPage component={Enterprise} />}</Route>
                <Route path="/solutions/freelancers">{() => <LazyPage component={Freelancers} />}</Route>
                <Route path="/solutions/game-builder">{() => <LazyPage component={GameBuilder} />}</Route>
                <Route path="/solutions/internal-ai">{() => <LazyPage component={InternalAIBuilder} />}</Route>
                <Route path="/solutions/startups">{() => <LazyPage component={Startups} />}</Route>
                <Route path="/solutions/website-builder">{() => <LazyPage component={WebsiteBuilder} />}</Route>

                {/* Standalone Marketing Pages */}
                <Route path="/about">{() => <LazyPage component={About} />}</Route>
                <Route path="/blog">{() => <LazyPage component={Blog} />}</Route>
                <Route path="/blog/:slug">{() => <LazyPage component={BlogDetail} />}</Route>
                <Route path="/careers">{() => <LazyPage component={Careers} />}</Route>
                <Route path="/contact">{() => <LazyPage component={Contact} />}</Route>
                <Route path="/contact-sales">{() => <LazyPage component={ContactSales} />}</Route>
                <Route path="/education">{() => <LazyPage component={Education} />}</Route>
                <Route path="/features">{() => <LazyPage component={Features} />}</Route>
                <Route path="/partners">{() => <LazyPage component={Partners} />}</Route>
                <Route path="/press">{() => <LazyPage component={Press} />}</Route>
                <Route path="/status">{() => <LazyPage component={Status} />}</Route>
                <Route path="/support">{() => <LazyPage component={Support} />}</Route>
                <Route path="/explore">{() => <LazyPage component={Explore} />}</Route>
                <Route path="/marketplace">{() => <LazyPage component={Marketplace} />}</Route>
                <Route path="/templates">{() => <LazyPage component={TemplateMarketplace} />}</Route>
                <Route path="/languages">{() => <LazyPage component={Languages} />}</Route>
                <Route path="/learn">{() => <LazyPage component={Learn} />}</Route>
                <Route path="/security">{() => <LazyPage component={Security} />}</Route>
                <Route path="/scalability">{() => <LazyPage component={Scalability} />}</Route>
                <Route path="/dpa">{() => <LazyPage component={DPA} />}</Route>
                <Route path="/commercial-agreement">{() => <LazyPage component={CommercialAgreement} />}</Route>
                <Route path="/student-dpa">{() => <LazyPage component={StudentDPA} />}</Route>
                <Route path="/subprocessors">{() => <LazyPage component={Subprocessors} />}</Route>
                <Route path="/accessibility">{() => <LazyPage component={Accessibility} />}</Route>
                <Route path="/newsletter/confirm">{() => <LazyPage component={NewsletterConfirm} />}</Route>
                <Route path="/newsletter/confirmed">{() => <LazyPage component={NewsletterConfirmed} />}</Route>
                <Route path="/newsletter/unsubscribe">{() => <LazyPage component={NewsletterUnsubscribe} />}</Route>

                {/* Product pages */}
                <Route path="/ai-agent">{() => <LazyPage component={AIAgent} />}</Route>
                <Route path="/ai">{() => <LazyPage component={AIPlatform} />}</Route>
                <Route path="/mobile">{() => <LazyPage component={MobilePage} />}</Route>
                <Route path="/deployments">{() => <LazyPage component={Deployments} />}</Route>
                <Route path="/teams-overview">{() => <LazyPage component={TeamsOverview} />}</Route>
                <Route path="/report-abuse">{() => <LazyPage component={ReportAbuse} />}</Route>

                {/* Resources */}
                <Route path="/tutorials">{() => <LazyPage component={Tutorials} />}</Route>
                <Route path="/changelog">{() => <LazyPage component={Changelog} />}</Route>
                <Route path="/case-studies">{() => <LazyPage component={CaseStudies} />}</Route>
                <Route path="/help-center">{() => <LazyPage component={HelpCenterPage} />}</Route>
                <Route path="/ai-documentation">{() => <Redirect to="/docs" />}</Route>

                <Route component={NotFound} />
              </Switch>
              </Router>
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
