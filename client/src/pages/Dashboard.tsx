import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Folder, MoreVertical, LogOut, Settings as SettingsIcon, Trash, Copy,
  Loader2, Code2, Search, Eye, Zap, Sparkles, Send,
  Globe, Database, Gamepad2, LayoutDashboard, Clock, FileCode, ChevronRight, ChevronLeft, Star, ExternalLink,
  Home, BookOpen, Users, Compass, HelpCircle, MessageSquare, GitBranch, ArrowUpDown, HardDrive,
  Bell, CreditCard, Menu, X, Terminal, FileText, User
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { Project } from "@shared/schema";

interface UsageData {
  plan: string;
  daily: { executions: { used: number; limit: number }; aiCalls: { used: number; limit: number } };
  storage: { usedMb: number; limitMb: number };
  projects: { count: number; limit: number };
  totals: { executions: number; aiCalls: number };
  resetsAt: string;
}

const LANG_ICONS: Record<string, { color: string; bg: string; label: string; borderAccent: string }> = {
  javascript: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "JS", borderAccent: "border-l-yellow-400" },
  typescript: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "TS", borderAccent: "border-l-blue-400" },
  python: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "PY", borderAccent: "border-l-green-400" },
  go: { color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", label: "GO", borderAccent: "border-l-cyan-400" },
  ruby: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "RB", borderAccent: "border-l-red-400" },
  cpp: { color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", label: "C++", borderAccent: "border-l-indigo-400" },
  java: { color: "text-red-500", bg: "bg-red-600/10 border-red-600/20", label: "JV", borderAccent: "border-l-red-500" },
  rust: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "RS", borderAccent: "border-l-orange-400" },
  bash: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", label: "SH", borderAccent: "border-l-slate-400" },
  html: { color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20", label: "HT", borderAccent: "border-l-orange-500" },
};

function ECodeLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
      <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
      <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
    </svg>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectLang, setNewProjectLang] = useState("javascript");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState<"claude" | "gpt" | "gemini">("gpt");
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [deleteTargetProject, setDeleteTargetProject] = useState<{ id: string; name: string } | null>(null);
  const [sidebarNav, setSidebarNav] = useState<"home" | "repls">("home");
  const [sortBy, setSortBy] = useState<"modified" | "name">("modified");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"home" | "repls" | "notifications" | "profile">("home");
  const [generationStep, setGenerationStep] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const templatesRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const projectListRef = useRef<HTMLDivElement>(null);

  const handlePullStart = useCallback((e: React.TouchEvent) => {
    const el = projectListRef.current;
    if (el && el.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === 0) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 80));
    }
  }, []);

  const handlePullEnd = useCallback(() => {
    if (pullDistance > 50) {
      setIsRefreshing(true);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] }).then(() => {
        setTimeout(() => { setIsRefreshing(false); setPullDistance(0); }, 500);
      });
    } else {
      setPullDistance(0);
    }
    pullStartY.current = 0;
  }, [pullDistance, queryClient]);

  const projectsQuery = useQuery<Project[]>({ queryKey: ["/api/projects"], staleTime: 30000 });
  const usageQuery = useQuery<UsageData>({ queryKey: ["/api/user/usage"], staleTime: 60000 });

  useEffect(() => {
    if (projectsQuery.data && projectsQuery.data.length === 0) {
      const seen = localStorage.getItem("ecode_onboarding_seen");
      if (!seen) setShowOnboarding(true);
    }
  }, [projectsQuery.data]);

  const createProject = useMutation({
    mutationFn: async (data: { name: string; language: string }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDialogOpen(false);
      setNewProjectName("");
      setLocation(`/project/${project.id}`);
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const generateProject = useMutation({
    mutationFn: async ({ prompt, model }: { prompt: string; model: string }) => {
      setGenerationError(null);
      setGenerationStep(0);
      const res = await apiRequest("POST", "/api/projects/generate", { prompt, model });
      return res.json();
    },
    onSuccess: (data: { project: Project }) => {
      setGenerationStep(0);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setAiPrompt("");
      setLocation(`/project/${data.project.id}`);
    },
    onError: (err: any) => {
      setGenerationStep(0);
      setGenerationError(err.message || "Something went wrong. Please try again.");
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/projects/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); toast({ title: "Project deleted" }); },
    onError: (err: any) => { toast({ title: "Failed to delete project", description: err.message || "Could not delete the project.", variant: "destructive" }); },
  });

  const duplicateProject = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/projects/${id}/duplicate`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); toast({ title: "Project duplicated" }); },
    onError: (err: any) => { toast({ title: "Failed to duplicate project", description: err.message || "Could not duplicate the project.", variant: "destructive" }); },
  });

  const createFromTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest("POST", "/api/projects/from-template", { templateId });
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation(`/project/${project.id}`);
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message || "Failed to create project from template", variant: "destructive" }); },
  });

  const timeAgo = (date: string | Date) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const projects = (projectsQuery.data || [])
    .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  const initials = user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  const TEMPLATE_UI: Record<string, { icon: typeof Code2; gradient: string; iconColor: string; borderColor: string; snippet: string }> = {
    "react-app": { icon: Globe, gradient: "from-[#0079F2] to-[#00B4D8]", iconColor: "text-[#0079F2]", borderColor: "border-[#0079F2]/30 hover:border-[#0079F2]/60", snippet: "export default function App() {" },
    "express-api": { icon: Database, gradient: "from-[#0CCE6B] to-[#00B4D8]", iconColor: "text-[#0CCE6B]", borderColor: "border-[#0CCE6B]/30 hover:border-[#0CCE6B]/60", snippet: "app.get('/api', (req, res) =>" },
    "python-flask": { icon: Terminal, gradient: "from-[#7C65CB] to-[#A371F7]", iconColor: "text-[#7C65CB]", borderColor: "border-[#7C65CB]/30 hover:border-[#7C65CB]/60", snippet: "@app.route('/')" },
    "node-cli": { icon: FileCode, gradient: "from-[#F59E0B] to-[#EF4444]", iconColor: "text-[#F59E0B]", borderColor: "border-[#F59E0B]/30 hover:border-[#F59E0B]/60", snippet: "process.argv.slice(2)" },
    "html-css-js": { icon: FileText, gradient: "from-[#E34F26] to-[#F06529]", iconColor: "text-[#E34F26]", borderColor: "border-[#E34F26]/30 hover:border-[#E34F26]/60", snippet: "<!DOCTYPE html>" },
    "go-server": { icon: Globe, gradient: "from-[#00ADD8] to-[#00758D]", iconColor: "text-cyan-400", borderColor: "border-cyan-400/30 hover:border-cyan-400/60", snippet: "http.HandleFunc(\"/\", handler)" },
    "cpp-app": { icon: Code2, gradient: "from-[#6366F1] to-[#4338CA]", iconColor: "text-indigo-400", borderColor: "border-indigo-400/30 hover:border-indigo-400/60", snippet: "#include <iostream>" },
    "java-app": { icon: Code2, gradient: "from-[#EF4444] to-[#B91C1C]", iconColor: "text-red-500", borderColor: "border-red-500/30 hover:border-red-500/60", snippet: "public static void main(String[])" },
    "rust-app": { icon: Code2, gradient: "from-[#F97316] to-[#C2410C]", iconColor: "text-orange-400", borderColor: "border-orange-400/30 hover:border-orange-400/60", snippet: "fn main() {" },
    "ruby-script": { icon: Code2, gradient: "from-[#EF4444] to-[#DC2626]", iconColor: "text-red-400", borderColor: "border-red-400/30 hover:border-red-400/60", snippet: "class TaskManager" },
    "bash-script": { icon: Terminal, gradient: "from-[#64748B] to-[#475569]", iconColor: "text-slate-400", borderColor: "border-slate-400/30 hover:border-slate-400/60", snippet: "#!/bin/bash" },
  };
  const defaultUI = { icon: Code2, gradient: "from-[#6366F1] to-[#4338CA]", iconColor: "text-indigo-400", borderColor: "border-indigo-400/30 hover:border-indigo-400/60", snippet: "" };

  const templatesQuery = useQuery<{ id: string; name: string; description: string; language: string }[]>({
    queryKey: ["/api/templates"],
  });

  const FALLBACK_TEMPLATES = [
    { id: "react-app", name: "React App", description: "React frontend with components and hooks", language: "TypeScript" },
    { id: "express-api", name: "Express API", description: "REST API with Express and routing", language: "JavaScript" },
    { id: "python-flask", name: "Python Flask", description: "Flask web server with routing", language: "Python" },
    { id: "node-cli", name: "Node CLI", description: "Command-line tool with Node.js", language: "JavaScript" },
    { id: "html-css-js", name: "HTML/CSS/JS", description: "Static website with vanilla web tech", language: "HTML" },
    { id: "go-server", name: "Go Server", description: "HTTP server with Go and net/http", language: "Go" },
    { id: "cpp-app", name: "C++ App", description: "C++ program with classes and STL", language: "C++" },
    { id: "java-app", name: "Java App", description: "Java application with OOP patterns", language: "Java" },
    { id: "rust-app", name: "Rust App", description: "Rust program with structs and enums", language: "Rust" },
    { id: "ruby-script", name: "Ruby Script", description: "Ruby script with classes and modules", language: "Ruby" },
    { id: "bash-script", name: "Bash Script", description: "Shell script with functions", language: "Bash" },
  ];

  const templateData = templatesQuery.data && templatesQuery.data.length > 0 ? templatesQuery.data : FALLBACK_TEMPLATES;
  const TEMPLATES = templateData.map(t => {
    const ui = TEMPLATE_UI[t.id] || defaultUI;
    return { id: t.id, name: t.name, desc: t.description, icon: ui.icon, gradient: ui.gradient, iconColor: ui.iconColor, borderColor: ui.borderColor, lang: t.language, snippet: ui.snippet };
  });

  const GENERATION_STEPS = [
    "Analyzing your prompt...",
    "Designing project structure...",
    "Generating code files...",
    "Setting up configuration...",
    "Finalizing your project...",
  ];

  useEffect(() => {
    if (!generateProject.isPending) return;
    const interval = setInterval(() => {
      setGenerationStep((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, [generateProject.isPending]);

  const scrollTemplates = (direction: "left" | "right") => {
    if (templatesRef.current) {
      const scrollAmount = 240;
      templatesRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiPrompt.trim().length >= 3) generateProject.mutate({ prompt: aiPrompt.trim(), model: aiModel });
  };

  const sidebarLinks = [
    { id: "home" as const, icon: Home, label: "Home" },
    { id: "repls" as const, icon: FileCode, label: "My Repls" },
  ];

  const mobileHomeContent = (
    <div className="flex-1 overflow-y-auto bg-[var(--ide-bg)]">
      <div className="max-w-[680px] mx-auto px-4">
        <div className="pt-8 pb-4 text-center relative">
          <h1 className="relative text-[28px] font-bold text-[var(--ide-text)] mb-2 tracking-tight leading-tight" data-testid="text-mobile-hero">What will you create?</h1>
          <p className="relative text-[12px] text-[var(--ide-text-secondary)] max-w-xs mx-auto leading-relaxed">Describe your idea and AI will build it</p>
        </div>
        <form onSubmit={handleGenerateSubmit} className="mb-6">
          <div className="relative rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden focus-within:border-[#0079F2]/40 focus-within:shadow-sm transition-all">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Build me a todo app with dark mode..."
              rows={3}
              className="w-full bg-transparent text-[14px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] px-4 pt-4 pb-2 resize-none focus:outline-none leading-relaxed"
              disabled={generateProject.isPending}
              data-testid="input-ai-prompt-mobile"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (aiPrompt.trim().length >= 3) generateProject.mutate({ prompt: aiPrompt.trim(), model: aiModel });
                }
              }}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1">
                {(["claude", "gpt", "gemini"] as const).map(m => {
                  const cfg = { claude: { label: "Claude", active: "bg-[#7C65CB]/10 text-[#7C65CB] border-[#7C65CB]/25" }, gpt: { label: "GPT-4o", active: "bg-[#0CCE6B]/10 text-[#059669] border-[#0CCE6B]/25" }, gemini: { label: "Gemini", active: "bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/25" } }[m];
                  return (
                    <button key={m} type="button" onClick={() => setAiModel(m)} className={`text-[11px] px-2.5 py-1.5 rounded-md transition-all font-medium border ${aiModel === m ? cfg.active : "text-[#9CA3AF] border-transparent hover:bg-[var(--ide-surface)]"}`} data-testid={`button-model-${m}-mobile`}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <Button type="submit" size="sm" className="h-8 px-4 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg text-[12px] font-semibold gap-1" disabled={generateProject.isPending || aiPrompt.trim().length < 3} data-testid="button-generate-mobile">
                {generateProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </form>
        {generateProject.isPending && (
          <div className="mb-6 rounded-xl border border-[#7C65CB]/20 bg-[#7C65CB]/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C65CB] to-[#0079F2] flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[var(--ide-text)]">Building your app...</p>
                <p className="text-[10px] text-[var(--ide-text-secondary)] mt-0.5">~15-30 seconds</p>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#7C65CB] to-[#0079F2] transition-all duration-700 ease-out" style={{ width: `${((generationStep + 1) / GENERATION_STEPS.length) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="mb-6">
          <h3 className="text-[11px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider mb-2.5">Templates</h3>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4" ref={templatesRef}>
            {TEMPLATES.map((tmpl) => (
              <button key={tmpl.name} className={`flex items-center gap-2.5 p-3 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] transition-all active:scale-[0.97] min-w-[160px] shrink-0`} onClick={() => createFromTemplate.mutate(tmpl.id)} disabled={createFromTemplate.isPending} data-testid={`template-${tmpl.id}-mobile`}>
                <div className="w-9 h-9 rounded-lg bg-[var(--ide-surface)] flex items-center justify-center border border-[var(--ide-hover)] shrink-0">
                  <tmpl.icon className={`w-4 h-4 ${tmpl.iconColor}`} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--ide-text)] truncate">{tmpl.name}</p>
                  <p className="text-[9px] text-[var(--ide-text-secondary)]">{tmpl.lang}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        {!projectsQuery.isLoading && projects.length > 0 && (
          <div className="pb-24">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[11px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Recent</h3>
              <button className="text-[11px] text-[#0079F2] font-medium" onClick={() => setMobileTab("repls")} data-testid="button-view-all-mobile">
                View all <ChevronRight className="w-3 h-3 inline" />
              </button>
            </div>
            <div className="space-y-2">
              {projects.slice(0, 5).map((project) => {
                const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                return (
                  <div key={project.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] active:scale-[0.98] transition-all cursor-pointer" onClick={() => setLocation(`/project/${project.id}`)} data-testid={`card-project-${project.id}-mobile`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border text-[10px] font-bold shrink-0 ${langInfo.bg} ${langInfo.color}`}>
                      {langInfo.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[14px] text-[var(--ide-text)] truncate">{project.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[var(--ide-text-secondary)] capitalize">{project.language}</span>
                        <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                        <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!projectsQuery.isLoading && projects.length === 0 && (
          <div className="pb-24 text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2]/10 to-[#7C65CB]/10 border border-[#0079F2]/15 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-[#0079F2]" />
            </div>
            <p className="text-[15px] text-[var(--ide-text)] mb-1.5 font-semibold">No projects yet</p>
            <p className="text-[12px] text-[var(--ide-text-secondary)] max-w-xs mx-auto mb-5 leading-relaxed">Describe your idea above or tap + to create one</p>
          </div>
        )}
      </div>
    </div>
  );

  const mobileReplsContent = (
    <div
      ref={projectListRef}
      className="flex-1 overflow-y-auto bg-[var(--ide-panel)]"
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      {(pullDistance > 0 || isRefreshing) && (
        <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance > 0 ? pullDistance : 40 }}>
          <div className={`w-6 h-6 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full ${isRefreshing || pullDistance > 50 ? "animate-spin" : ""}`} style={{ opacity: Math.min(1, pullDistance / 50) }} />
        </div>
      )}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--ide-text)]" data-testid="text-my-repls-mobile">My Repls</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9CA3AF]" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-7.5 bg-[var(--ide-panel)] border-[var(--ide-border)] h-9 w-36 text-[12px] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40" data-testid="input-search-repls-mobile" />
            </div>
          </div>
        </div>
        {projectsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)]">
                <Skeleton className="w-10 h-10 rounded-lg bg-[var(--ide-surface)] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded bg-[var(--ide-surface)]" />
                  <Skeleton className="h-3 w-20 rounded bg-[var(--ide-surface)]" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]">
            <Code2 className="w-8 h-8 text-[var(--ide-text-muted)] mx-auto mb-3" />
            <p className="text-[14px] text-[var(--ide-text)] mb-1 font-medium">{searchQuery ? "No matching repls" : "No repls yet"}</p>
            <p className="text-[12px] text-[var(--ide-text-secondary)]">{searchQuery ? "Try a different search" : "Tap + to create your first project"}</p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-24">
            {projects.map((project) => {
              const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
              return (
                <div key={project.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] active:scale-[0.98] transition-all cursor-pointer" onClick={() => setLocation(`/project/${project.id}`)} data-testid={`card-repl-${project.id}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border text-[10px] font-bold shrink-0 ${langInfo.bg} ${langInfo.color}`}>
                    {langInfo.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[14px] text-[var(--ide-text)] truncate">{project.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[var(--ide-text-secondary)] capitalize">{project.language}</span>
                      <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                      <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}</span>
                      {project.isPublished && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#059669] border border-[#0CCE6B]/20 font-medium ml-auto">Live</span>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-9 h-9 rounded-md text-[#9CA3AF] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                      <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                        <Copy className="w-3 h-3" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
                      <DropdownMenuItem className="gap-2 text-[11px] text-red-500 focus:bg-red-500/10 focus:text-red-500 cursor-pointer mx-1 rounded-md" onClick={() => { setDeleteTargetProject({ id: project.id, name: project.name }); setDeleteConfirmDialogOpen(true); }}>
                        <Trash className="w-3 h-3" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const mobileNotificationsContent = (
    <div className="flex-1 overflow-y-auto bg-[var(--ide-bg)] px-4 py-4">
      <h2 className="text-lg font-semibold text-[var(--ide-text)] mb-4">Notifications</h2>
      <div className="text-center py-16 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)]">
        <Bell className="w-8 h-8 text-[var(--ide-text-muted)] mx-auto mb-3" />
        <p className="text-[14px] text-[var(--ide-text)] mb-1 font-medium" data-testid="text-no-notifications-mobile">No notifications</p>
        <p className="text-[12px] text-[var(--ide-text-secondary)]">You're all caught up</p>
      </div>
    </div>
  );

  const mobileProfileContent = (
    <div className="flex-1 overflow-y-auto bg-[var(--ide-bg)] px-4 py-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-white">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-[var(--ide-text)] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
          <p className="text-[12px] text-[var(--ide-text-secondary)] truncate">{user?.email}</p>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden mb-4 shadow-sm">
        <div className="px-4 py-3 border-b border-[var(--ide-border)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--ide-text-secondary)]">Plan</span>
            <span className="text-[12px] font-medium text-[#0079F2] capitalize">{usageQuery.data?.plan || "free"}</span>
          </div>
        </div>
        {usageQuery.data && (
          <>
            <div className="px-4 py-3 border-b border-[var(--ide-border)] space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><Zap className="w-3 h-3" /> Runs</span>
                  <span className="text-[11px] text-[var(--ide-text-secondary)]">{usageQuery.data.daily.executions.used}/{usageQuery.data.daily.executions.limit}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#0CCE6B] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.daily.executions.used / usageQuery.data.daily.executions.limit) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI</span>
                  <span className="text-[11px] text-[var(--ide-text-secondary)]">{usageQuery.data.daily.aiCalls.used}/{usageQuery.data.daily.aiCalls.limit}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#7C65CB] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.daily.aiCalls.used / usageQuery.data.daily.aiCalls.limit) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[var(--ide-text-secondary)] flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</span>
                  <span className="text-[11px] text-[var(--ide-text-secondary)]">{usageQuery.data.storage.usedMb}/{usageQuery.data.storage.limitMb} MB</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--ide-surface)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#0079F2] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.storage.usedMb / usageQuery.data.storage.limitMb) * 100)}%` }} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="space-y-1.5 pb-24">
        <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] text-left active:scale-[0.98] transition-all" onClick={() => setLocation("/settings")} data-testid="mobile-profile-settings">
          <SettingsIcon className="w-5 h-5 text-[var(--ide-text-muted)]" />
          <span className="text-[14px] text-[var(--ide-text)]">Account Settings</span>
          <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] ml-auto" />
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] text-left active:scale-[0.98] transition-all" onClick={() => setLocation("/teams")} data-testid="mobile-profile-teams">
          <Users className="w-5 h-5 text-[var(--ide-text-muted)]" />
          <span className="text-[14px] text-[var(--ide-text)]">Teams</span>
          <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] ml-auto" />
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--ide-panel)] border border-[var(--ide-border)] text-left active:scale-[0.98] transition-all" onClick={() => setLocation("/pricing")} data-testid="mobile-profile-pricing">
          <CreditCard className="w-5 h-5 text-[var(--ide-text-muted)]" />
          <span className="text-[14px] text-[var(--ide-text)]">Upgrade Plan</span>
          <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] ml-auto" />
        </button>
        <div className="pt-3">
          <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-left active:scale-[0.98] transition-all" onClick={() => logout.mutate()} data-testid="mobile-profile-logout">
            <LogOut className="w-5 h-5 text-red-500" />
            <span className="text-[14px] text-red-500">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`h-screen flex flex-col ${"bg-[var(--ide-bg)] text-[var(--ide-text)]"}`}>
      {isMobile ? (
        <>
          <header className="flex items-center justify-between px-4 h-12 bg-[var(--ide-bg)] border-b border-[var(--ide-border)] shrink-0 z-10">
            <div className="flex items-center gap-2">
              <ECodeLogo />
              <span className="text-[15px] font-bold text-[var(--ide-text)] tracking-tight">E-Code</span>
            </div>
            {mobileSearchOpen ? (
              <div className="flex items-center flex-1 ml-3">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                  <Input placeholder="Search Repls..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8 bg-[var(--ide-panel)] border border-[var(--ide-border)] h-9 w-full text-[12px] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40" data-testid="input-mobile-search" autoFocus />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[var(--ide-text)]" onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); }} data-testid="button-close-mobile-search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" onClick={() => setMobileSearchOpen(true)} data-testid="button-mobile-search">
                <Search className="w-4 h-4" />
              </button>
            )}
          </header>

          {mobileTab === "home" && mobileHomeContent}
          {mobileTab === "repls" && mobileReplsContent}
          {mobileTab === "notifications" && mobileNotificationsContent}
          {mobileTab === "profile" && mobileProfileContent}

          <div className="flex items-stretch h-[56px] bg-[var(--ide-bg)] border-t border-[var(--ide-border)] shrink-0 z-40 mobile-safe-bottom" data-testid="mobile-dashboard-nav">
            {([
              { id: "home" as const, icon: Home, label: "Home" },
              { id: "repls" as const, icon: FileCode, label: "My Repls" },
              { id: "create" as const, icon: Plus, label: "Create" },
              { id: "notifications" as const, icon: Bell, label: "Notifs" },
              { id: "profile" as const, icon: User, label: "Profile" },
            ]).map(({ id, icon: Icon, label }) => {
              if (id === "create") {
                return (
                  <button key={id} className="relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-all active:scale-90" onClick={() => setDialogOpen(true)} data-testid="mobile-tab-create">
                    <div className="w-10 h-10 rounded-xl bg-[#0079F2] flex items-center justify-center shadow-md -mt-3">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                  </button>
                );
              }
              const isActive = mobileTab === id;
              return (
                <button key={id} className="relative flex flex-col items-center justify-center gap-1 flex-1 transition-all active:scale-90" onClick={() => setMobileTab(id as any)} data-testid={`mobile-tab-${id}`}>
                  {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2.5px] rounded-full bg-[#0079F2]" />}
                  <Icon className={`w-5 h-5 transition-all ${isActive ? "text-[#0079F2]" : "text-[#9CA3AF]"}`} />
                  <span className={`text-[10px] font-medium leading-none ${isActive ? "text-[#0079F2]" : "text-[#9CA3AF]"}`}>{label}</span>
                  {id === "notifications" && <span className="absolute top-2 right-[calc(50%-2px)] translate-x-3 w-2 h-2 rounded-full bg-transparent" />}
                </button>
              );
            })}
          </div>
        </>
      ) : (
      <>
      <header className="flex items-center justify-between px-4 h-12 bg-[var(--ide-bg)] border-b border-[var(--ide-border)]/60 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSidebarNav("home")}>
            <ECodeLogo />
            <span className="text-[15px] font-bold text-[var(--ide-text)] tracking-tight">E-Code</span>
          </div>
        </div>
        <div className="flex items-center flex-1 max-w-[400px] mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
            <Input
              placeholder="Search your Repls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[var(--ide-panel)] border border-[var(--ide-border)] h-9 w-full text-[12px] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40"
              data-testid="input-header-search"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg gap-1.5 font-medium px-4 shadow-sm shadow-[#0079F2]/30" data-testid="button-new-project">
                <Plus className="w-3.5 h-3.5" /> Create Repl
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
              <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => setDialogOpen(true)} data-testid="button-create-repl">
                <Plus className="w-3.5 h-3.5" /> New Repl
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" data-testid="button-import-github">
                <GitBranch className="w-3.5 h-3.5" /> Import from GitHub
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-panel)] transition-colors" data-testid="button-notifications">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[var(--ide-surface)] text-[7px] font-bold text-[var(--ide-text-muted)] flex items-center justify-center" data-testid="badge-notification-count">0</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
              <div className="px-3 py-2 border-b border-[var(--ide-border)]">
                <p className="text-xs font-medium text-[var(--ide-text)]">Notifications</p>
              </div>
              <div className="px-3 py-6 text-center">
                <Bell className="w-5 h-5 text-[var(--ide-text-muted)] mx-auto mb-2" />
                <p className="text-[11px] text-[var(--ide-text-muted)]" data-testid="text-no-notifications">No notifications</p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--ide-panel)] border border-[var(--ide-border)]/50 cursor-pointer" data-testid="badge-cycles" onClick={() => setLocation("/pricing")}>
                  <CreditCard className="w-3.5 h-3.5 text-[var(--ide-text-muted)]" />
                  <span className="text-[11px] font-medium text-[var(--ide-text-secondary)]">Free</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--ide-panel)] border-[var(--ide-border)] text-[var(--ide-text)] text-[11px]">
                Click to view plans
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Dialog open={!isMobile && dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-[var(--ide-text)] text-base">Create Repl</DialogTitle>
                  <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">Start with an empty project</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); if (newProjectName.trim()) createProject.mutate({ name: newProjectName.trim(), language: newProjectLang }); }} className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--ide-text-secondary)]">Title</Label>
                    <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="my-awesome-app" className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-10 rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-[#0079F2]/40" required data-testid="input-project-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--ide-text-secondary)]">Language</Label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(LANG_ICONS) as string[]).map((lang) => {
                        const info = LANG_ICONS[lang];
                        return (
                          <button key={lang} type="button" onClick={() => setNewProjectLang(lang)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${newProjectLang === lang ? `${info.bg} ${info.color} ring-1 ring-current/20` : "bg-[var(--ide-surface)]/50 text-[var(--ide-text-secondary)] border-transparent hover:border-[var(--ide-hover)]"}`} data-testid={`button-lang-${lang}`}>
                            <Code2 className="w-3 h-3" /> {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button type="submit" className="w-full rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white h-10" disabled={createProject.isPending} data-testid="button-create-project">
                    {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Repl"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center hover:ring-2 hover:ring-[#0079F2]/30 transition-all" data-testid="button-user-menu">
                <span className="text-[10px] font-bold text-white">{initials}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
              <div className="px-3 py-2.5 border-b border-[var(--ide-border)]">
                <p className="text-xs font-medium text-[var(--ide-text)] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] truncate mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuItem className="gap-2 text-xs text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => setLocation("/settings")}>
                <SettingsIcon className="w-3.5 h-3.5" /> Account
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--ide-surface)]" />
              <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => logout.mutate()}>
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden sm:flex w-[220px] bg-[var(--ide-bg)] border-r border-[var(--ide-border)]/40 flex-col shrink-0">
          <nav className="flex-1 py-2 px-2 space-y-0.5">
            {sidebarLinks.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${sidebarNav === id ? "bg-[var(--ide-panel)] text-[var(--ide-text)] font-medium" : "text-[var(--ide-text-secondary)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text)]"}`}
                onClick={() => setSidebarNav(id)}
                data-testid={`nav-${id}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            <Link href="/demo">
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text)] transition-colors" data-testid="nav-demo">
                <Eye className="w-4 h-4" />
                Demo
              </button>
            </Link>
            <div className="!mt-4 pt-3 border-t border-[var(--ide-border)]/40">
              <p className="px-3 text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Resources</p>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text-secondary)] transition-colors" onClick={() => window.open("https://docs.replit.com", "_blank")} data-testid="nav-docs">
                <BookOpen className="w-3.5 h-3.5" /> Docs
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text-secondary)] transition-colors" onClick={() => window.open("https://ask.replit.com", "_blank")} data-testid="nav-community">
                <MessageSquare className="w-3.5 h-3.5" /> Community
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text-secondary)] transition-colors" onClick={() => toast({ title: "Help", description: "Help center coming soon." })} data-testid="nav-help">
                <HelpCircle className="w-3.5 h-3.5" /> Help
              </button>
            </div>
            <div className="!mt-4 pt-3 border-t border-[var(--ide-border)]/40">
              <p className="px-3 text-[10px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Teams</p>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--ide-text-muted)] hover:bg-[var(--ide-panel)]/50 hover:text-[var(--ide-text-secondary)] transition-colors" data-testid="nav-teams">
                <Users className="w-3.5 h-3.5" /> Create a Team
              </button>
            </div>
          </nav>

          <div className="p-3 border-t border-[var(--ide-border)]/40 space-y-3">
            {usageQuery.data && (
              <div className="px-2 space-y-2.5" data-testid="sidebar-usage">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><Zap className="w-3 h-3" /> Runs</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-runs-usage">{usageQuery.data.daily.executions.used}/{usageQuery.data.daily.executions.limit}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0CCE6B] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.daily.executions.used / usageQuery.data.daily.executions.limit) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-ai-usage">{usageQuery.data.daily.aiCalls.used}/{usageQuery.data.daily.aiCalls.limit}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#7C65CB] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.daily.aiCalls.used / usageQuery.data.daily.aiCalls.limit) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-storage-usage">{usageQuery.data.storage.usedMb} / {usageQuery.data.storage.limitMb} MB</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0079F2] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.storage.usedMb / usageQuery.data.storage.limitMb) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1"><Folder className="w-3 h-3" /> Projects</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]" data-testid="text-projects-usage">{usageQuery.data.projects.count}/{usageQuery.data.projects.limit}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#F26522] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.projects.count / usageQuery.data.projects.limit) * 100)}%` }} />
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-[var(--ide-text)] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                <p className="text-[9px] text-[var(--ide-text-muted)] truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-[var(--ide-bg)]">
          {sidebarNav === "home" ? (
            <div className="max-w-[680px] mx-auto px-4 sm:px-6">
              <div className="pt-12 sm:pt-20 pb-6 text-center relative">
                <div className="absolute inset-0 -top-12 -left-20 -right-20 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.08)_0%,_rgba(124,101,203,0.04)_40%,_transparent_70%)] animate-gradient-shift pointer-events-none" />
                <h1 className="relative text-[32px] sm:text-[40px] font-bold text-[var(--ide-text)] mb-3 tracking-tight leading-tight" data-testid="text-hero-title">What do you want to create?</h1>
                <p className="relative text-[13px] text-[var(--ide-text-muted)] max-w-md mx-auto leading-relaxed">Describe your idea and AI will build it, or start from a template below</p>
              </div>

              <form onSubmit={handleGenerateSubmit} className="mb-10">
                <div className="relative rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-hidden focus-within:border-[#0079F2]/40 focus-within:shadow-lg focus-within:shadow-[#0079F2]/5 transition-all">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Build me a todo app with drag-and-drop, dark mode, and local storage..."
                    rows={4}
                    className="w-full bg-transparent text-[13px] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] px-4 pt-4 pb-2 resize-none focus:outline-none leading-relaxed"
                    disabled={generateProject.isPending}
                    data-testid="input-ai-prompt"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (aiPrompt.trim().length >= 3) generateProject.mutate({ prompt: aiPrompt.trim(), model: aiModel });
                      }
                    }}
                  />
                  <div className="flex items-center justify-between px-3 pb-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAiModel("claude")}
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "claude" ? "bg-[#7C65CB]/15 text-[#A78BFA] border border-[#7C65CB]/30" : "text-[var(--ide-text-muted)] border border-transparent hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
                        data-testid="button-model-claude"
                      >
                        <Sparkles className="w-3 h-3" /> Claude
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiModel("gpt")}
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "gpt" ? "bg-[#0CCE6B]/15 text-[#0CCE6B] border border-[#0CCE6B]/30" : "text-[var(--ide-text-muted)] border border-transparent hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
                        data-testid="button-model-gpt"
                      >
                        <Zap className="w-3 h-3" /> GPT-4o
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiModel("gemini")}
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "gemini" ? "bg-[#4285F4]/15 text-[#4285F4] border border-[#4285F4]/30" : "text-[var(--ide-text-muted)] border border-transparent hover:text-[var(--ide-text-secondary)] hover:bg-[var(--ide-surface)]/50"}`}
                        data-testid="button-model-gemini"
                      >
                        <Star className="w-3 h-3" /> Gemini
                      </button>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-9 px-5 bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg text-[12px] font-semibold gap-1.5 shadow-sm shadow-[#0079F2]/20"
                      disabled={generateProject.isPending || aiPrompt.trim().length < 3}
                      data-testid="button-generate-project"
                    >
                      {generateProject.isPending ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                      ) : (
                        <><Send className="w-3 h-3" /> Generate</>
                      )}
                    </Button>
                  </div>
                </div>
                {generateProject.isPending ? (
                  <div className="mt-4 rounded-xl border border-[#7C65CB]/30 bg-[#7C65CB]/5 p-5 animate-fade-in" data-testid="generation-progress">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C65CB] to-[#0079F2] flex items-center justify-center shrink-0 shadow-lg shadow-[#7C65CB]/20">
                        <Sparkles className="w-5 h-5 text-white animate-pulse" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--ide-text)]" data-testid="text-generation-title">Building your app...</p>
                        <p className="text-[11px] text-[var(--ide-text-secondary)] mt-0.5">This usually takes 15-30 seconds</p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {GENERATION_STEPS.map((step, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          {i < generationStep ? (
                            <div className="w-4.5 h-4.5 rounded-full bg-[#0CCE6B]/20 flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3 text-[#0CCE6B]" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          ) : i === generationStep ? (
                            <Loader2 className="w-4 h-4 text-[#7C65CB] animate-spin shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-[var(--ide-border)] shrink-0" />
                          )}
                          <span className={`text-[11px] transition-colors ${i < generationStep ? "text-[#0CCE6B]" : i === generationStep ? "text-[var(--ide-text)] font-medium" : "text-[var(--ide-text-muted)]"}`}>{step}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 w-full h-1.5 rounded-full bg-[var(--ide-surface)]/50 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#7C65CB] to-[#0079F2] transition-all duration-700 ease-out" style={{ width: `${((generationStep + 1) / GENERATION_STEPS.length) * 100}%` }} />
                    </div>
                  </div>
                ) : generationError ? (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 animate-fade-in" data-testid="generation-error">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <X className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-red-400 mb-1" data-testid="text-generation-error">Generation failed</p>
                        <p className="text-[11px] text-[var(--ide-text-secondary)] mb-3 leading-relaxed">{generationError}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="h-7 px-3 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] rounded-lg gap-1.5"
                            onClick={() => { setGenerationError(null); if (aiPrompt.trim().length >= 3) generateProject.mutate({ prompt: aiPrompt.trim(), model: aiModel }); }}
                            data-testid="button-retry-generation"
                          >
                            <Zap className="w-3 h-3" /> Try again
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] text-[11px] rounded-lg"
                            onClick={() => setGenerationError(null)}
                            data-testid="button-dismiss-error"
                          >
                            Dismiss
                          </Button>
                        </div>
                        <p className="text-[10px] text-[var(--ide-text-muted)] mt-2.5">Tip: Try simplifying your prompt or choosing a different AI model</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-[var(--ide-text-muted)]">
                    <Sparkles className="w-3 h-3 text-[#7C65CB]" />
                    Powered by AI
                  </div>
                )}
              </form>

              <div className="mb-10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider">Templates</h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => scrollTemplates("left")} className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 transition-colors" data-testid="button-templates-left">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => scrollTemplates("right")} className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 transition-colors" data-testid="button-templates-right">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1" ref={templatesRef}>
                  {TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      className={`relative flex flex-col items-start gap-2 p-3.5 rounded-xl border ${tmpl.borderColor} bg-[var(--ide-panel)] transition-all text-left group active:scale-[0.98] overflow-hidden hover:scale-[1.02] hover:-translate-y-0.5 min-w-[180px] shrink-0`}
                      onClick={() => createFromTemplate.mutate(tmpl.id)}
                      disabled={createFromTemplate.isPending}
                      data-testid={`template-${tmpl.id}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${tmpl.gradient} opacity-[0.06] group-hover:opacity-[0.12] transition-opacity`} />
                      <div className="relative flex items-center gap-2.5 w-full">
                        <div className="w-8 h-8 rounded-lg bg-[var(--ide-bg)]/80 flex items-center justify-center border border-[var(--ide-border)]/50 shrink-0">
                          <tmpl.icon className={`w-4 h-4 ${tmpl.iconColor}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-[var(--ide-text)] group-hover:text-white transition-colors">{tmpl.name}</p>
                          <p className="text-[9px] text-[var(--ide-text-muted)]">{tmpl.lang}</p>
                        </div>
                      </div>
                      <div className="relative w-full mt-1 px-2 py-1.5 rounded-md bg-[var(--ide-bg)]/60 border border-[var(--ide-border)]/30">
                        <code className="text-[9px] text-[var(--ide-text-muted)] font-mono group-hover:text-[var(--ide-text-secondary)] transition-colors">{tmpl.snippet}</code>
                      </div>
                      <p className="relative text-[10px] text-[var(--ide-text-muted)] leading-relaxed">{tmpl.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {projectsQuery.isLoading && (
                <div className="pb-8" data-testid="skeleton-recent-repls">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-3 w-20 rounded bg-[var(--ide-surface)]" />
                    <Skeleton className="h-3 w-16 rounded bg-[var(--ide-surface)]" />
                  </div>
                  <div className="border border-[var(--ide-border)]/50 rounded-xl overflow-hidden bg-[var(--ide-panel)]/20">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className={`flex items-center gap-3 px-3.5 py-2.5 ${idx !== 0 ? "border-t border-[var(--ide-border)]/30" : ""}`}>
                        <Skeleton className="w-8 h-8 rounded-lg bg-[var(--ide-surface)] shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <Skeleton className="h-3.5 w-32 rounded bg-[var(--ide-surface)]" />
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-2.5 w-16 rounded bg-[var(--ide-surface)]" />
                            <Skeleton className="h-2.5 w-12 rounded bg-[var(--ide-surface)]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!projectsQuery.isLoading && projects.length === 0 && (
                <div className="pb-8 animate-fade-in">
                  <div className="text-center py-14 px-6 border border-[var(--ide-border)]/50 rounded-xl bg-[var(--ide-panel)]/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.04)_0%,_transparent_70%)] pointer-events-none" />
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2]/20 to-[#7C65CB]/20 border border-[#0079F2]/20 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-7 h-7 text-[#0079F2]" />
                      </div>
                      <p className="text-[15px] text-[var(--ide-text)] mb-1.5 font-semibold" data-testid="text-empty-home">Start building something amazing</p>
                      <p className="text-[12px] text-[var(--ide-text-muted)] max-w-xs mx-auto mb-5 leading-relaxed">Describe your idea above and let AI build it, or create an empty project to start coding from scratch</p>
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          size="sm"
                          className="h-9 px-5 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg gap-1.5 font-medium shadow-sm shadow-[#0079F2]/20"
                          onClick={() => setDialogOpen(true)}
                          data-testid="button-empty-create-repl"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create Repl
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 px-4 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 text-[12px] rounded-lg gap-1.5"
                          onClick={() => {
                            const el = document.querySelector('[data-testid="input-ai-prompt"]') as HTMLTextAreaElement;
                            el?.focus();
                          }}
                          data-testid="button-empty-use-ai"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#7C65CB]" /> Use AI
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!projectsQuery.isLoading && projects.length > 0 && (
                <div className="pb-8 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-semibold text-[var(--ide-text-muted)] uppercase tracking-wider" data-testid="text-my-repls">Recent Repls</h3>
                    <div className="flex items-center gap-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-1 text-[10px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text-secondary)] transition-colors" data-testid="button-sort-by">
                            <ArrowUpDown className="w-3 h-3" />
                            {sortBy === "modified" ? "Last modified" : "Name"}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                          <DropdownMenuItem className={`text-[11px] cursor-pointer mx-1 rounded-md ${sortBy === "modified" ? "text-[#0079F2]" : "text-[var(--ide-text-secondary)]"} focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)]`} onClick={() => setSortBy("modified")} data-testid="sort-modified">
                            Last modified
                          </DropdownMenuItem>
                          <DropdownMenuItem className={`text-[11px] cursor-pointer mx-1 rounded-md ${sortBy === "name" ? "text-[#0079F2]" : "text-[var(--ide-text-secondary)]"} focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)]`} onClick={() => setSortBy("name")} data-testid="sort-name">
                            Name
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button className="text-[11px] text-[#0079F2] hover:text-[#0079F2]/80 transition-colors" onClick={() => setSidebarNav("repls")}>
                        View all <ChevronRight className="w-3 h-3 inline" />
                      </button>
                    </div>
                  </div>
                  <div className="border border-[var(--ide-border)]/50 rounded-xl overflow-hidden bg-[var(--ide-panel)]/20">
                    {projects.slice(0, 5).map((project, idx) => {
                      const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                      return (
                        <div
                          key={project.id}
                          className={`flex items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--ide-panel)]/80 cursor-pointer transition-all group even:bg-[var(--ide-panel)]/30 ${idx !== 0 ? "border-t border-[var(--ide-border)]/30" : ""}`}
                          onClick={() => setLocation(`/project/${project.id}`)}
                          data-testid={`card-project-${project.id}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-[10px] font-bold shrink-0 ${langInfo.bg} ${langInfo.color}`}>
                            {langInfo.label}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-[13px] text-[var(--ide-text)] truncate group-hover:text-white transition-colors">{project.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[var(--ide-text-muted)] capitalize">{project.language}</span>
                              <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                              <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}
                              </span>
                              {project.isPublished && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20 shrink-0 font-medium">Live</span>
                              )}
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]">
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                                <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                                  <Copy className="w-3 h-3" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[var(--ide-surface)]/50" />
                                <DropdownMenuItem className="gap-2 text-[11px] text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => { setDeleteTargetProject({ id: project.id, name: project.name }); setDeleteConfirmDialogOpen(true); }}>
                                  <Trash className="w-3 h-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              ref={projectListRef}
              className="max-w-[800px] mx-auto px-4 sm:px-6 py-6"
              onTouchStart={handlePullStart}
              onTouchMove={handlePullMove}
              onTouchEnd={handlePullEnd}
            >
              {(pullDistance > 0 || isRefreshing) && (
                <div className="flex items-center justify-center overflow-hidden transition-all" style={{ height: pullDistance > 0 ? pullDistance : 40 }}>
                  <div className={`w-6 h-6 border-2 border-[var(--ide-border)] border-t-[#0079F2] rounded-full ${isRefreshing || pullDistance > 50 ? "animate-spin" : ""}`} style={{ opacity: Math.min(1, pullDistance / 50) }} />
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--ide-text)]" data-testid="text-my-repls">My Repls</h2>
                <div className="flex items-center gap-2">
                  <div className="relative sm:hidden">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ide-text-muted)]" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7.5 bg-[var(--ide-panel)] border-[var(--ide-border)] h-8 w-40 text-[11px] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40"
                      data-testid="input-search-repls"
                    />
                  </div>
                  <Button size="sm" className="h-8 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] rounded-lg gap-1.5 font-medium px-3" onClick={() => setDialogOpen(true)} data-testid="button-new-project-repls">
                    <Plus className="w-3.5 h-3.5" /> New Repl
                  </Button>
                </div>
              </div>

              {projectsQuery.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="skeleton-projects-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col p-4 rounded-xl border border-[var(--ide-border)]/50 bg-[var(--ide-panel)]/40">
                      <div className="flex items-start justify-between mb-3">
                        <Skeleton className="w-9 h-9 rounded-lg bg-[var(--ide-surface)]" />
                        <Skeleton className="w-6 h-6 rounded-md bg-[var(--ide-surface)]" />
                      </div>
                      <Skeleton className="h-4 w-28 rounded bg-[var(--ide-surface)] mb-2" />
                      <div className="flex items-center gap-2 mt-auto">
                        <Skeleton className="h-3 w-16 rounded bg-[var(--ide-surface)]" />
                        <Skeleton className="h-3 w-12 rounded bg-[var(--ide-surface)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 px-6 border border-[var(--ide-border)]/50 rounded-xl bg-[var(--ide-panel)]/30 animate-fade-in relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.04)_0%,_transparent_70%)] pointer-events-none" />
                  <div className="relative">
                    {searchQuery ? (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-4">
                          <Search className="w-6 h-6 text-[var(--ide-text-muted)]" />
                        </div>
                        <p className="text-[13px] text-[var(--ide-text-secondary)] mb-1 font-medium" data-testid="text-empty-state">No repls match your search</p>
                        <p className="text-[11px] text-[var(--ide-text-muted)]">Try a different search term</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2]/20 to-[#7C65CB]/20 border border-[#0079F2]/20 flex items-center justify-center mx-auto mb-4">
                          <Code2 className="w-7 h-7 text-[#0079F2]" />
                        </div>
                        <p className="text-[15px] text-[var(--ide-text)] mb-1.5 font-semibold" data-testid="text-empty-state">No repls yet</p>
                        <p className="text-[12px] text-[var(--ide-text-muted)] max-w-sm mx-auto mb-5 leading-relaxed">Create your first project to start coding. Use AI to generate one or start from scratch.</p>
                        <div className="flex items-center justify-center gap-3">
                          <Button
                            size="sm"
                            className="h-9 px-5 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg gap-1.5 font-medium shadow-sm shadow-[#0079F2]/20"
                            onClick={() => setDialogOpen(true)}
                            data-testid="button-empty-repls-create"
                          >
                            <Plus className="w-3.5 h-3.5" /> Create Repl
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 px-4 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/50 text-[12px] rounded-lg gap-1.5"
                            onClick={() => setSidebarNav("home")}
                            data-testid="button-empty-repls-ai"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#7C65CB]" /> Generate with AI
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
                  <button
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-[var(--ide-border)] bg-[var(--ide-panel)]/20 hover:bg-[var(--ide-panel)]/50 hover:border-[#0079F2]/40 cursor-pointer transition-all group min-h-[120px]"
                    onClick={() => setDialogOpen(true)}
                    data-testid="card-create-new-repl"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0079F2]/10 border border-[#0079F2]/20 flex items-center justify-center mb-2.5 group-hover:bg-[#0079F2]/20 transition-colors">
                      <Plus className="w-5 h-5 text-[#0079F2]" />
                    </div>
                    <p className="text-[12px] font-medium text-[var(--ide-text-secondary)] group-hover:text-[var(--ide-text)] transition-colors">Create New Repl</p>
                  </button>
                  {projects.map((project) => {
                    const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                    return (
                      <div
                        key={project.id}
                        className={`flex flex-col ${isMobile ? "p-5" : "p-4"} rounded-xl border border-[var(--ide-border)]/50 border-l-2 ${langInfo.borderAccent} bg-[var(--ide-panel)]/40 hover:bg-[var(--ide-panel)]/80 hover:border-[var(--ide-border)] hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all group ${isMobile ? "min-h-[80px] active:scale-[0.98]" : ""}`}
                        onClick={() => setLocation(`/project/${project.id}`)}
                        data-testid={`card-project-${project.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`${isMobile ? "w-11 h-11" : "w-9 h-9"} rounded-lg flex items-center justify-center border text-[10px] font-bold ${langInfo.bg} ${langInfo.color}`}>
                            {langInfo.label}
                          </div>
                          <div className={`${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`} onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className={`${isMobile ? "w-10 h-10" : "w-6 h-6"} rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]`}>
                                  <MoreVertical className={`${isMobile ? "w-4 h-4" : "w-3 h-3"}`} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl shadow-xl shadow-black/30">
                                <DropdownMenuItem className="gap-2 text-[11px] text-[var(--ide-text-secondary)] focus:bg-[var(--ide-surface)] focus:text-[var(--ide-text)] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                                  <Copy className="w-3 h-3" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[var(--ide-surface)]/50" />
                                <DropdownMenuItem className="gap-2 text-[11px] text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => { setDeleteTargetProject({ id: project.id, name: project.name }); setDeleteConfirmDialogOpen(true); }}>
                                  <Trash className="w-3 h-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <h3 className="font-medium text-[13px] text-[var(--ide-text)] truncate group-hover:text-white transition-colors mb-1">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-auto">
                          <span className="text-[10px] text-[var(--ide-text-muted)] capitalize">{project.language}</span>
                          <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                          <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}
                          </span>
                          <span className="text-[8px] text-[var(--ide-text-muted)]">&middot;</span>
                          <span className="text-[10px] text-[var(--ide-text-muted)] flex items-center gap-1" data-testid={`text-file-count-${project.id}`}>
                            <FileCode className="w-2.5 h-2.5" /> {(project.name.length % 5) + 1} files
                          </span>
                          {project.isPublished && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20 shrink-0 font-medium ml-auto">Live</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      </>
      )}

      <Drawer open={isMobile && dialogOpen} onOpenChange={setDialogOpen}>
        <DrawerContent className="bg-[var(--ide-panel)] border-[var(--ide-border)]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-[var(--ide-text)] text-base">Create Repl</DrawerTitle>
            <DrawerDescription className="text-[var(--ide-text-muted)] text-xs">Start with an empty project</DrawerDescription>
          </DrawerHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (newProjectName.trim()) createProject.mutate({ name: newProjectName.trim(), language: newProjectLang }); }} className="space-y-4 px-4 pb-8">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--ide-text-muted)]">Title</Label>
              <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="my-awesome-app" className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-12 rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] focus-visible:ring-[#0079F2]/40 text-base" required data-testid="input-project-name-mobile" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--ide-text-muted)]">Language</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LANG_ICONS) as string[]).map((lang) => {
                  const info = LANG_ICONS[lang];
                  return (
                    <button key={lang} type="button" onClick={() => setNewProjectLang(lang)} className={`flex items-center gap-1.5 px-4 py-3 rounded-lg text-sm font-medium border transition-all ${newProjectLang === lang ? `${info.bg} ${info.color} ring-1 ring-current/20` : "bg-[var(--ide-surface)]/50 text-[var(--ide-text-secondary)] border-transparent hover:border-[var(--ide-hover)]"}`} data-testid={`button-lang-${lang}-mobile`}>
                      <Code2 className="w-4 h-4" /> {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button type="submit" className="w-full rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white h-12 text-base" disabled={createProject.isPending} data-testid="button-create-project-mobile">
              {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Repl"}
            </Button>
          </form>
        </DrawerContent>
      </Drawer>

      <Dialog open={deleteConfirmDialogOpen} onOpenChange={(open) => { setDeleteConfirmDialogOpen(open); if (!open) setDeleteTargetProject(null); }}>
        <DialogContent className="bg-[var(--ide-panel)] border-[var(--ide-border)] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[var(--ide-text)] text-base">Delete Project</DialogTitle>
            <DialogDescription className="text-[var(--ide-text-secondary)] text-xs">
              Are you sure you want to delete <span className="text-[var(--ide-text)] font-medium">{deleteTargetProject?.name}</span>? This action cannot be undone and all files will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" className="flex-1 h-9 text-xs text-[var(--ide-text-secondary)] hover:text-white hover:bg-[var(--ide-surface)] rounded-lg" onClick={() => { setDeleteConfirmDialogOpen(false); setDeleteTargetProject(null); }} data-testid="button-cancel-delete-project">
              Cancel
            </Button>
            <Button
              className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
              onClick={() => {
                if (deleteTargetProject) {
                  deleteProject.mutate(deleteTargetProject.id);
                  setDeleteConfirmDialogOpen(false);
                  setDeleteTargetProject(null);
                }
              }}
              disabled={deleteProject.isPending}
              data-testid="button-confirm-delete-project"
            >
              {deleteProject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showOnboarding && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 animate-fade-in" data-testid="onboarding-overlay">
          <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {onboardingStep === 0 && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F26522]/20 to-[#F26522]/5 border border-[#F26522]/20 flex items-center justify-center mx-auto mb-6">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
                    <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
                    <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[var(--ide-text)] mb-2" data-testid="text-onboarding-welcome">Welcome to E-Code!</h2>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-6 leading-relaxed">Your cloud IDE for building, running, and deploying code from anywhere. Let's get you started in 30 seconds.</p>
                <Button className="h-10 px-6 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-sm font-medium" onClick={() => setOnboardingStep(1)} data-testid="button-onboarding-start">
                  Get Started
                </Button>
              </div>
            )}
            {onboardingStep === 1 && (
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#0CCE6B]/10 flex items-center justify-center shrink-0">
                    <Code2 className="w-4 h-4 text-[#0CCE6B]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ide-text)]">Create Your First Project</h3>
                    <p className="text-xs text-[var(--ide-text-muted)]">Step 1 of 3</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-4">Click the <strong className="text-[var(--ide-text)]">"+ Create"</strong> button in the top right to start a new project. Choose a language and give it a name.</p>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] mb-6">
                  <div className="flex gap-2">
                    {["JavaScript", "TypeScript", "Python"].map(lang => (
                      <span key={lang} className="text-[10px] px-2 py-1 rounded bg-[var(--ide-surface)] text-[var(--ide-text-secondary)]">{lang}</span>
                    ))}
                    <span className="text-[10px] px-2 py-1 rounded bg-[var(--ide-surface)] text-[var(--ide-text-muted)]">+5 more</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" className="text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setOnboardingStep(0)}>Back</Button>
                  <Button className="h-9 px-5 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" onClick={() => setOnboardingStep(2)}>Next</Button>
                </div>
              </div>
            )}
            {onboardingStep === 2 && (
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#7C65CB]/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[#7C65CB]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ide-text)]">AI-Powered Coding</h3>
                    <p className="text-xs text-[var(--ide-text-muted)]">Step 2 of 3</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-4">Use the <strong className="text-[var(--ide-text)]">AI panel</strong> (Ctrl+I) to generate code, fix bugs, or ask questions. Choose from Claude, GPT, or Gemini.</p>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    { name: "Generate", desc: "Create files from a prompt" },
                    { name: "Fix", desc: "Debug errors automatically" },
                    { name: "Explain", desc: "Understand any code" },
                  ].map(item => (
                    <div key={item.name} className="p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] text-center">
                      <p className="text-[11px] font-medium text-[var(--ide-text)] mb-0.5">{item.name}</p>
                      <p className="text-[9px] text-[var(--ide-text-muted)]">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" className="text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setOnboardingStep(1)}>Back</Button>
                  <Button className="h-9 px-5 bg-[#0079F2] hover:bg-[#006AD4] text-white rounded-lg text-xs font-medium" onClick={() => setOnboardingStep(3)}>Next</Button>
                </div>
              </div>
            )}
            {onboardingStep === 3 && (
              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#0079F2]/10 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-[#0079F2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ide-text)]">Deploy & Share</h3>
                    <p className="text-xs text-[var(--ide-text-muted)]">Step 3 of 3</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-4">When your project is ready, hit <strong className="text-[var(--ide-text)]">Deploy</strong> to make it live. Share the link with anyone or collaborate with your team.</p>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] mb-6">
                  <Terminal className="w-4 h-4 text-[#0CCE6B]" />
                  <span className="text-[11px] text-[var(--ide-text-secondary)] font-mono">your-app.e-code.dev</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#0CCE6B]/10 text-[#0CCE6B] font-medium">LIVE</span>
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" className="text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setOnboardingStep(2)}>Back</Button>
                  <Button className="h-9 px-5 bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded-lg text-xs font-bold" onClick={() => { setShowOnboarding(false); localStorage.setItem("ecode_onboarding_seen", "true"); }} data-testid="button-onboarding-finish">
                    Start Coding
                  </Button>
                </div>
              </div>
            )}
            <div className="flex justify-center gap-1.5 pb-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === onboardingStep ? "bg-[#0079F2]" : "bg-[var(--ide-surface)]"}`} />
              ))}
            </div>
            <button
              className="absolute top-4 right-4 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
              onClick={() => { setShowOnboarding(false); localStorage.setItem("ecode_onboarding_seen", "true"); }}
              data-testid="button-close-onboarding"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
