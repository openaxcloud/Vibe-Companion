import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Project from "@/pages/Project";
import Settings from "@/pages/Settings";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

function Router() {
  const [location] = useLocation();
  const [isAuth, setIsAuth] = useState(false);

  // Simple mock auth state logic
  useEffect(() => {
    const hasToken = localStorage.getItem('mock_token');
    if (hasToken && location === '/') {
      window.location.href = '/dashboard';
    } else if (!hasToken && location !== '/') {
      window.location.href = '/';
    }
    setIsAuth(!!hasToken);
  }, [location]);

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background shadow-2xl overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-hidden"
        >
          <Switch>
            <Route path="/" component={Auth}/>
            <Route path="/dashboard" component={Dashboard}/>
            <Route path="/project/:id" component={Project}/>
            <Route path="/settings" component={Settings}/>
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
      <Toaster />
    </div>
  );
}

function App() {
  // Center app layout to simulate mobile on desktop, but be full screen on actual mobile
  return (
    <div className="min-h-screen bg-black/20 sm:p-4 md:p-8 flex items-center justify-center">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="w-full h-[100dvh] sm:h-[800px] max-w-md bg-background sm:rounded-[2.5rem] sm:border-[8px] sm:border-gray-900 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative ring-1 ring-white/10">
            {/* Dynamic Island / Notch Mock for Desktop View */}
            <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-3xl z-50"></div>
            
            <Router />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
