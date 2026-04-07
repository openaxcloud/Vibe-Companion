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
import SharedSnippet from "@/pages/SharedSnippet";
import Pricing from "@/pages/Pricing";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Teams from "@/pages/Teams";
import AdminDashboard from "@/pages/AdminDashboard";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import VerifyEmail from "@/pages/VerifyEmail";
import AcceptInvite from "@/pages/AcceptInvite";
import { useAuth } from "@/hooks/use-auth";
import { useAsyncBrowserLocation } from "@/hooks/use-async-location";
import { Component, lazy, Suspense, startTransition, useState, useEffect, type ReactNode } from "react";
import UnifiedIDELayout from "@/pages/UnifiedIDELayout";
import Themes from "@/pages/Themes";
import GitHubImport from "@/pages/GitHubImport";
import Account from "@/pages/Account";
import Desktop from "@/pages/Desktop";
import McpDirectory from "@/pages/McpDirectory";
import McpInstallLink from "@/pages/McpInstallLink";
import OpenInReplit from "@/pages/OpenInReplit";
import Docs from "@/pages/Docs";
import Community from "@/pages/Community";
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
const AIPlatform = lazy(() => import("@/pages/AI"));
const MobilePage = lazy(() => import("@/pages/mobile"));
const Deployments = lazy(() => import("@/pages/Deployments"));
const TeamsOverview = lazy(() => import("@/pages/Teams"));
const ReportAbuse = lazy(() => import("@/pages/ReportAbuse"));
const Tutorials = lazy(() => import("@/pages/resources/Tutorials"));
const Changelog = lazy(() => import("@/pages/resources/Changelog"));
const CaseStudies = lazy(() => import("@/pages/resources/CaseStudies"));
const HelpCenterPage = lazy(() => import("@/pages/resources/HelpCenter"));

function LazyPage({ component: C }: { component: React.LazyExoticComponent<React.ComponentType> }) {
  return (
    <Suspense fallback={<IDELoadingScreen />}>
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
        <div className="h-screen flex items-center justify-center bg-[var(--ecode-background,#0E1525)] text-[var(--ecode-text,#F5F9FC)]">
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

function IDELoadingScreen() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[var(--ecode-background,#0E1525)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--ecode-accent,#F26207)] to-[var(--ecode-accent-hover,#D04E00)] flex items-center justify-center shadow-lg shadow-[var(--ecode-accent,#F26207)]/20">
            <svg className="w-5 h-5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
        </div>
        <p className="text-[13px] text-[var(--ecode-text-muted,#9BA3B3)] font-medium">Loading workspace...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !ready) {
      startTransition(() => {
        setReady(true);
      });
    }
    if (!isAuthenticated && ready) {
      setReady(false);
    }
  }, [isLoading, isAuthenticated, ready]);

  if (isLoading || (isAuthenticated && !ready)) {
    return <IDELoadingScreen />;
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <Suspense fallback={<IDELoadingScreen />}>
      <Component />
    </Suspense>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function UnifiedProjectRoute() {
  const params = useParams<{ id: string }>();
  const rawId = params.id || '';
  const isUUID = UUID_RE.test(rawId);
  const [resolvedId, setResolvedId] = useState<string | null>(isUUID ? rawId : null);
  const [noProjects, setNoProjects] = useState(false);

  useEffect(() => {
    if (isUUID) { setResolvedId(rawId); return; }
    let cancelled = false;
    fetch('/api/projects', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((projects: any[]) => {
        if (cancelled) return;
        if (projects.length > 0) {
          const target = projects[0].id;
          setResolvedId(target);
          window.history.replaceState(null, '', `/project/${target}`);
        } else {
          setNoProjects(true);
        }
      })
      .catch(() => { if (!cancelled) setNoProjects(true); });
    return () => { cancelled = true; };
  }, [rawId, isUUID]);

  if (noProjects) {
    return <Redirect to="/dashboard" />;
  }
  if (!resolvedId) {
    return <IDELoadingScreen />;
  }
  const searchParams = new URLSearchParams(window.location.search);
  const bootstrapToken = searchParams.get('bootstrap') || null;
  return <Suspense fallback={<IDELoadingScreen />}><UnifiedIDELayout projectId={resolvedId} bootstrapToken={bootstrapToken} /></Suspense>;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--ecode-background)] focus:text-[var(--ecode-text)] focus:border focus:border-[var(--ecode-border)] focus:rounded">Skip to main content</a>
            <div id="main-content" className="h-screen w-screen bg-[var(--ecode-background)] text-[var(--ecode-text)]" role="application" aria-label="E-Code IDE">
              <Router hook={useAsyncBrowserLocation}>
              <Switch>
                <Route path="/" component={Landing} />
                <Route path="/login" component={Auth} />
                <Route path="/register" component={Auth} />
                <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
                <Route path="/project/:id">{() => <ProtectedRoute component={UnifiedProjectRoute} />}</Route>
                <Route path="/ide/:id">{() => <ProtectedRoute component={UnifiedProjectRoute} />}</Route>
                <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
                <Route path="/teams">{() => <ProtectedRoute component={Teams} />}</Route>
                <Route path="/admin">{() => <ProtectedRoute component={AdminDashboard} />}</Route>
                <Route path="/frameworks">{() => <LazyPage component={Languages} />}</Route>
                <Route path="/frameworks/:id">{() => <LazyPage component={Languages} />}</Route>
                <Route path="/themes">{() => <ProtectedRoute component={Themes} />}</Route>
                <Route path="/themes/editor">{() => <ProtectedRoute component={Themes} />}</Route>
                <Route path="/themes/editor/:id">{() => <ProtectedRoute component={Themes} />}</Route>
                <Route path="/import">{() => <ProtectedRoute component={GitHubImport} />}</Route>
                <Route path="/cli">{() => <ProtectedRoute component={Account} />}</Route>
                <Route path="/mcp-directory" component={McpDirectory} />
                <Route path="/mcp-install-link">{() => <ProtectedRoute component={McpInstallLink} />}</Route>
                <Route path="/open" component={OpenInReplit} />
                <Route path="/desktop" component={Desktop} />
                <Route path="/docs" component={Docs} />
                <Route path="/community">{() => <ProtectedRoute component={Community} />}</Route>
                <Route path="/help">{() => <LazyPage component={HelpCenterPage} />}</Route>
                <Route path="/pricing" component={Pricing} />
                <Route path="/demo">{() => <Redirect to="/dashboard" />}</Route>
                <Route path="/shared/:id" component={SharedSnippet} />
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
