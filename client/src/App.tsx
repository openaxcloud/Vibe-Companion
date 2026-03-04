import { Switch, Route, useLocation, Redirect } from "wouter";
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
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "framer-motion";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0d1117]">
        <div className="w-8 h-8 border-2 border-[#30363d] border-t-[#58a6ff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-[#0d1117] shadow-2xl overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.15 }}
          className="flex-1 overflow-hidden"
        >
          <Switch>
            <Route path="/" component={Auth} />
            <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
            <Route path="/project/:id">{() => <ProtectedRoute component={Project} />}</Route>
            <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
            <Route path="/demo" component={DemoProject} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-black sm:p-4 md:p-8 flex items-center justify-center">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="w-full h-[100dvh] sm:h-[812px] max-w-md bg-[#0d1117] sm:rounded-[2.5rem] sm:border-[8px] sm:border-[#1a1a1a] shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden relative ring-1 ring-white/5">
            <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#1a1a1a] rounded-b-2xl z-50" />
            <Router />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
