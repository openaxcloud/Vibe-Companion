import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Folder, MoreVertical, LogOut, Settings as SettingsIcon, Trash, Copy,
  Loader2, Code2, Search, Eye, Zap, Sparkles, Send,
  Globe, Database, Gamepad2, LayoutDashboard, Clock, FileCode, ChevronRight, ChevronLeft, Star, ExternalLink,
  Home, BookOpen, Users, Compass, HelpCircle, MessageSquare, GitBranch, ArrowUpDown, HardDrive,
  Bell, CreditCard, Menu, X
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
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
};

function ReplitLogo({ size = 22 }: { size?: number }) {
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
  const [generationStep, setGenerationStep] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const templatesRef = useRef<HTMLDivElement>(null);

  const projectsQuery = useQuery<Project[]>({ queryKey: ["/api/projects"], staleTime: 30000 });
  const usageQuery = useQuery<UsageData>({ queryKey: ["/api/user/usage"], staleTime: 60000 });

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

  const TEMPLATES = [
    { name: "Web App", desc: "React + Express full-stack starter", prompt: "A modern web app with React frontend, Express backend, and a responsive dashboard", icon: Globe, gradient: "from-[#0079F2] to-[#00B4D8]", iconColor: "text-[#0079F2]", borderColor: "border-[#0079F2]/30 hover:border-[#0079F2]/60" },
    { name: "API Server", desc: "REST API with authentication", prompt: "A REST API server with user authentication, CRUD endpoints, and JSON responses", icon: Database, gradient: "from-[#0CCE6B] to-[#00B4D8]", iconColor: "text-[#0CCE6B]", borderColor: "border-[#0CCE6B]/30 hover:border-[#0CCE6B]/60" },
    { name: "Dashboard", desc: "Admin panel with charts", prompt: "An admin dashboard with sidebar navigation, data tables, charts, and user management", icon: LayoutDashboard, gradient: "from-[#7C65CB] to-[#A371F7]", iconColor: "text-[#7C65CB]", borderColor: "border-[#7C65CB]/30 hover:border-[#7C65CB]/60" },
    { name: "Game", desc: "Browser game with Canvas", prompt: "A simple browser-based snake game using HTML5 Canvas with score tracking", icon: Gamepad2, gradient: "from-[#F59E0B] to-[#EF4444]", iconColor: "text-[#F59E0B]", borderColor: "border-[#F59E0B]/30 hover:border-[#F59E0B]/60" },
  ];

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

  return (
    <div className="h-screen flex flex-col bg-[#0E1525] text-[#F5F9FC]">
      <header className="flex items-center justify-between px-4 h-12 bg-[#0E1525] border-b border-[#2B3245]/60 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#1C2333] transition-colors"
            onClick={() => setMobileSidebarOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSidebarNav("home")}>
            <ReplitLogo />
            <span className="text-[15px] font-bold text-[#F5F9FC] tracking-tight hidden sm:block">Replit</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center flex-1 max-w-[400px] mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#676D7E]" />
            <Input
              placeholder="Search your Repls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#1C2333] border border-[#2B3245] h-9 w-full text-[12px] rounded-lg text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40"
              data-testid="input-header-search"
            />
          </div>
        </div>
        {mobileSearchOpen ? (
          <div className="flex sm:hidden items-center flex-1 mx-2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#676D7E]" />
              <Input
                placeholder="Search your Repls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 bg-[#1C2333] border border-[#2B3245] h-9 w-full text-[12px] rounded-lg text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40"
                data-testid="input-mobile-search"
                autoFocus
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#676D7E] hover:text-[#F5F9FC]"
                onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); }}
                data-testid="button-close-mobile-search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#1C2333] transition-colors"
            onClick={() => setMobileSearchOpen(true)}
            data-testid="button-mobile-search"
          >
            <Search className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[12px] rounded-lg gap-1.5 font-medium px-4 shadow-sm shadow-[#0079F2]/30" data-testid="button-new-project">
                <Plus className="w-3.5 h-3.5" /> Create Repl
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#1C2333] border-[#2B3245] rounded-xl shadow-xl shadow-black/30">
              <DropdownMenuItem className="gap-2 text-[11px] text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer mx-1 rounded-md" onClick={() => setDialogOpen(true)} data-testid="button-create-repl">
                <Plus className="w-3.5 h-3.5" /> New Repl
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[11px] text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer mx-1 rounded-md" data-testid="button-import-github">
                <GitBranch className="w-3.5 h-3.5" /> Import from GitHub
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#1C2333] transition-colors" data-testid="button-notifications">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#2B3245] text-[7px] font-bold text-[#676D7E] flex items-center justify-center" data-testid="badge-notification-count">0</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-[#1C2333] border-[#2B3245] rounded-xl shadow-xl shadow-black/30">
              <div className="px-3 py-2 border-b border-[#2B3245]">
                <p className="text-xs font-medium text-[#F5F9FC]">Notifications</p>
              </div>
              <div className="px-3 py-6 text-center">
                <Bell className="w-5 h-5 text-[#323B4F] mx-auto mb-2" />
                <p className="text-[11px] text-[#676D7E]" data-testid="text-no-notifications">No notifications</p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1C2333] border border-[#2B3245]/50 cursor-default" data-testid="badge-cycles">
                  <CreditCard className="w-3.5 h-3.5 text-[#676D7E]" />
                  <span className="text-[11px] font-medium text-[#9DA2B0]">Free</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#1C2333] border-[#2B3245] text-[#F5F9FC] text-[11px]">
                Your plan
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-[#F5F9FC] text-base">Create Repl</DialogTitle>
                <DialogDescription className="text-[#9DA2B0] text-xs">Start with an empty project</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (newProjectName.trim()) createProject.mutate({ name: newProjectName.trim(), language: newProjectLang }); }} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9DA2B0]">Title</Label>
                  <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="my-awesome-app" className="bg-[#0E1525] border-[#2B3245] h-10 rounded-lg text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-[#0079F2]/40" required data-testid="input-project-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9DA2B0]">Language</Label>
                  <div className="flex gap-2">
                    {(["javascript", "typescript", "python"] as const).map((lang) => {
                      const info = LANG_ICONS[lang];
                      return (
                        <button key={lang} type="button" onClick={() => setNewProjectLang(lang)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${newProjectLang === lang ? `${info.bg} ${info.color} ring-1 ring-current/20` : "bg-[#2B3245]/50 text-[#9DA2B0] border-transparent hover:border-[#323B4F]"}`} data-testid={`button-lang-${lang}`}>
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
            <DropdownMenuContent align="end" className="w-52 bg-[#1C2333] border-[#2B3245] rounded-xl shadow-xl shadow-black/30">
              <div className="px-3 py-2.5 border-b border-[#2B3245]">
                <p className="text-xs font-medium text-[#F5F9FC] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                <p className="text-[10px] text-[#676D7E] truncate mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer mx-1 rounded-md" onClick={() => setLocation("/settings")}>
                <SettingsIcon className="w-3.5 h-3.5" /> Account
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2B3245]" />
              <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => logout.mutate()}>
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden sm:flex w-[220px] bg-[#0E1525] border-r border-[#2B3245]/40 flex-col shrink-0">
          <nav className="flex-1 py-2 px-2 space-y-0.5">
            {sidebarLinks.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${sidebarNav === id ? "bg-[#1C2333] text-[#F5F9FC] font-medium" : "text-[#9DA2B0] hover:bg-[#1C2333]/50 hover:text-[#F5F9FC]"}`}
                onClick={() => setSidebarNav(id)}
                data-testid={`nav-${id}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            <Link href="/demo">
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#9DA2B0] hover:bg-[#1C2333]/50 hover:text-[#F5F9FC] transition-colors" data-testid="nav-demo">
                <Eye className="w-4 h-4" />
                Demo
              </button>
            </Link>
            <div className="!mt-4 pt-3 border-t border-[#2B3245]/40">
              <p className="px-3 text-[10px] font-semibold text-[#676D7E] uppercase tracking-wider mb-2">Resources</p>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[#676D7E] hover:bg-[#1C2333]/50 hover:text-[#9DA2B0] transition-colors" onClick={() => window.open("https://docs.replit.com", "_blank")} data-testid="nav-docs">
                <BookOpen className="w-3.5 h-3.5" /> Docs
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[#676D7E] hover:bg-[#1C2333]/50 hover:text-[#9DA2B0] transition-colors" onClick={() => window.open("https://ask.replit.com", "_blank")} data-testid="nav-community">
                <MessageSquare className="w-3.5 h-3.5" /> Community
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[#676D7E] hover:bg-[#1C2333]/50 hover:text-[#9DA2B0] transition-colors" onClick={() => toast({ title: "Help", description: "Help center coming soon." })} data-testid="nav-help">
                <HelpCircle className="w-3.5 h-3.5" /> Help
              </button>
            </div>
            <div className="!mt-4 pt-3 border-t border-[#2B3245]/40">
              <p className="px-3 text-[10px] font-semibold text-[#676D7E] uppercase tracking-wider mb-2">Teams</p>
              <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[#676D7E] hover:bg-[#1C2333]/50 hover:text-[#9DA2B0] transition-colors" data-testid="nav-teams">
                <Users className="w-3.5 h-3.5" /> Create a Team
              </button>
            </div>
          </nav>

          <div className="p-3 border-t border-[#2B3245]/40 space-y-3">
            {usageQuery.data && (
              <div className="px-2 space-y-2.5" data-testid="sidebar-usage">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#676D7E] flex items-center gap-1"><Zap className="w-3 h-3" /> Runs</span>
                    <span className="text-[10px] text-[#676D7E]" data-testid="text-runs-usage">{usageQuery.data.daily.executions.used}/{usageQuery.data.daily.executions.limit}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[#2B3245]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0CCE6B] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.daily.executions.used / usageQuery.data.daily.executions.limit) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#676D7E] flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI</span>
                    <span className="text-[10px] text-[#676D7E]" data-testid="text-ai-usage">{usageQuery.data.daily.aiCalls.used}/{usageQuery.data.daily.aiCalls.limit}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[#2B3245]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#7C65CB] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.daily.aiCalls.used / usageQuery.data.daily.aiCalls.limit) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#676D7E] flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</span>
                    <span className="text-[10px] text-[#676D7E]" data-testid="text-storage-usage">{usageQuery.data.storage.usedMb} / {usageQuery.data.storage.limitMb} MB</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[#2B3245]/50 overflow-hidden">
                    <div className="h-full rounded-full bg-[#0079F2] transition-all" style={{ width: `${Math.min(100, (usageQuery.data.storage.usedMb / usageQuery.data.storage.limitMb) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#676D7E] flex items-center gap-1"><Folder className="w-3 h-3" /> Projects</span>
                    <span className="text-[10px] text-[#676D7E]" data-testid="text-projects-usage">{usageQuery.data.projects.count}/{usageQuery.data.projects.limit}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[#2B3245]/50 overflow-hidden">
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
                <p className="text-[11px] font-medium text-[#F5F9FC] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                <p className="text-[9px] text-[#676D7E] truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </aside>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-[260px] p-0 bg-[#0E1525] border-r border-[#2B3245]/40 sm:hidden">
            <nav className="flex-1 py-2 px-2 space-y-0.5 mt-10">
              {sidebarLinks.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${sidebarNav === id ? "bg-[#1C2333] text-[#F5F9FC] font-medium" : "text-[#9DA2B0] hover:bg-[#1C2333]/50 hover:text-[#F5F9FC]"}`}
                  onClick={() => { setSidebarNav(id); setMobileSidebarOpen(false); }}
                  data-testid={`mobile-nav-${id}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
              <Link href="/demo">
                <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#9DA2B0] hover:bg-[#1C2333]/50 hover:text-[#F5F9FC] transition-colors" onClick={() => setMobileSidebarOpen(false)} data-testid="mobile-nav-demo">
                  <Eye className="w-4 h-4" />
                  Demo
                </button>
              </Link>
              <div className="!mt-4 pt-3 border-t border-[#2B3245]/40">
                <p className="px-3 text-[10px] font-semibold text-[#676D7E] uppercase tracking-wider mb-2">Resources</p>
                <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[#676D7E] hover:bg-[#1C2333]/50 hover:text-[#9DA2B0] transition-colors" onClick={() => { window.open("https://docs.replit.com", "_blank"); setMobileSidebarOpen(false); }} data-testid="mobile-nav-docs">
                  <BookOpen className="w-3.5 h-3.5" /> Docs
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[#676D7E] hover:bg-[#1C2333]/50 hover:text-[#9DA2B0] transition-colors" onClick={() => { window.open("https://ask.replit.com", "_blank"); setMobileSidebarOpen(false); }} data-testid="mobile-nav-community">
                  <MessageSquare className="w-3.5 h-3.5" /> Community
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[#676D7E] hover:bg-[#1C2333]/50 hover:text-[#9DA2B0] transition-colors" onClick={() => { toast({ title: "Help", description: "Help center coming soon." }); setMobileSidebarOpen(false); }} data-testid="mobile-nav-help">
                  <HelpCircle className="w-3.5 h-3.5" /> Help
                </button>
              </div>
              <div className="!mt-4 pt-3 border-t border-[#2B3245]/40">
                <p className="px-3 text-[10px] font-semibold text-[#676D7E] uppercase tracking-wider mb-2">Teams</p>
                <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-[#676D7E] hover:bg-[#1C2333]/50 hover:text-[#9DA2B0] transition-colors" data-testid="mobile-nav-teams">
                  <Users className="w-3.5 h-3.5" /> Create a Team
                </button>
              </div>
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[#2B3245]/40">
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-white">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-[#F5F9FC] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                  <p className="text-[9px] text-[#676D7E] truncate">{user?.email}</p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <main className="flex-1 overflow-y-auto bg-[#0E1525]">
          {sidebarNav === "home" ? (
            <div className="max-w-[680px] mx-auto px-4 sm:px-6">
              <div className="pt-12 sm:pt-20 pb-6 text-center relative">
                <div className="absolute inset-0 -top-12 -left-20 -right-20 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.08)_0%,_rgba(124,101,203,0.04)_40%,_transparent_70%)] animate-gradient-shift pointer-events-none" />
                <h1 className="relative text-[32px] sm:text-[40px] font-bold text-[#F5F9FC] mb-3 tracking-tight leading-tight" data-testid="text-hero-title">What do you want to create?</h1>
                <p className="relative text-[13px] text-[#676D7E] max-w-md mx-auto leading-relaxed">Describe your idea and AI will build it, or start from a template below</p>
              </div>

              <form onSubmit={handleGenerateSubmit} className="mb-10">
                <div className="relative rounded-xl border border-[#2B3245] bg-[#1C2333] overflow-hidden focus-within:border-[#0079F2]/40 focus-within:shadow-lg focus-within:shadow-[#0079F2]/5 transition-all">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Build me a todo app with drag-and-drop, dark mode, and local storage..."
                    rows={4}
                    className="w-full bg-transparent text-[13px] text-[#F5F9FC] placeholder:text-[#676D7E] px-4 pt-4 pb-2 resize-none focus:outline-none leading-relaxed"
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
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "claude" ? "bg-[#7C65CB]/15 text-[#A78BFA] border border-[#7C65CB]/30" : "text-[#676D7E] border border-transparent hover:text-[#9DA2B0] hover:bg-[#2B3245]/50"}`}
                        data-testid="button-model-claude"
                      >
                        <Sparkles className="w-3 h-3" /> Claude
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiModel("gpt")}
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "gpt" ? "bg-[#0CCE6B]/15 text-[#0CCE6B] border border-[#0CCE6B]/30" : "text-[#676D7E] border border-transparent hover:text-[#9DA2B0] hover:bg-[#2B3245]/50"}`}
                        data-testid="button-model-gpt"
                      >
                        <Zap className="w-3 h-3" /> GPT-4o
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiModel("gemini")}
                        className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md transition-all font-medium ${aiModel === "gemini" ? "bg-[#4285F4]/15 text-[#4285F4] border border-[#4285F4]/30" : "text-[#676D7E] border border-transparent hover:text-[#9DA2B0] hover:bg-[#2B3245]/50"}`}
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
                        <p className="text-[13px] font-semibold text-[#F5F9FC]" data-testid="text-generation-title">Building your app...</p>
                        <p className="text-[11px] text-[#9DA2B0] mt-0.5">This usually takes 15-30 seconds</p>
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
                            <div className="w-4 h-4 rounded-full border border-[#2B3245] shrink-0" />
                          )}
                          <span className={`text-[11px] transition-colors ${i < generationStep ? "text-[#0CCE6B]" : i === generationStep ? "text-[#F5F9FC] font-medium" : "text-[#676D7E]"}`}>{step}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 w-full h-1.5 rounded-full bg-[#2B3245]/50 overflow-hidden">
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
                        <p className="text-[11px] text-[#9DA2B0] mb-3 leading-relaxed">{generationError}</p>
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
                            className="h-7 px-3 text-[#9DA2B0] hover:text-[#F5F9FC] text-[11px] rounded-lg"
                            onClick={() => setGenerationError(null)}
                            data-testid="button-dismiss-error"
                          >
                            Dismiss
                          </Button>
                        </div>
                        <p className="text-[10px] text-[#676D7E] mt-2.5">Tip: Try simplifying your prompt or choosing a different AI model</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10px] text-[#676D7E]">
                    <Sparkles className="w-3 h-3 text-[#7C65CB]" />
                    Powered by AI
                  </div>
                )}
              </form>

              <div className="mb-10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-semibold text-[#676D7E] uppercase tracking-wider">Templates</h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => scrollTemplates("left")} className="w-6 h-6 rounded-md flex items-center justify-center text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]/50 transition-colors" data-testid="button-templates-left">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => scrollTemplates("right")} className="w-6 h-6 rounded-md flex items-center justify-center text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]/50 transition-colors" data-testid="button-templates-right">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1" ref={templatesRef}>
                  {TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      className={`relative flex flex-col items-start gap-3 p-3.5 rounded-xl border ${tmpl.borderColor} bg-[#1C2333] transition-all text-left group active:scale-[0.98] overflow-hidden hover:scale-[1.02] hover:-translate-y-0.5 min-w-[160px] shrink-0`}
                      onClick={() => { setAiPrompt(tmpl.prompt); generateProject.mutate({ prompt: tmpl.prompt, model: aiModel }); }}
                      disabled={generateProject.isPending}
                      data-testid={`template-${tmpl.name.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${tmpl.gradient} opacity-[0.06] group-hover:opacity-[0.12] transition-opacity`} />
                      <div className="relative w-8 h-8 rounded-lg bg-[#0E1525]/80 flex items-center justify-center border border-[#2B3245]/50">
                        <tmpl.icon className={`w-4 h-4 ${tmpl.iconColor}`} />
                      </div>
                      <div className="relative">
                        <p className="text-[12px] font-semibold text-[#F5F9FC] group-hover:text-white transition-colors">{tmpl.name}</p>
                        <p className="text-[10px] text-[#676D7E] mt-0.5 leading-relaxed">{tmpl.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {projectsQuery.isLoading && (
                <div className="pb-8" data-testid="skeleton-recent-repls">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-3 w-20 rounded bg-[#2B3245]" />
                    <Skeleton className="h-3 w-16 rounded bg-[#2B3245]" />
                  </div>
                  <div className="border border-[#2B3245]/50 rounded-xl overflow-hidden bg-[#1C2333]/20">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className={`flex items-center gap-3 px-3.5 py-2.5 ${idx !== 0 ? "border-t border-[#2B3245]/30" : ""}`}>
                        <Skeleton className="w-8 h-8 rounded-lg bg-[#2B3245] shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <Skeleton className="h-3.5 w-32 rounded bg-[#2B3245]" />
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-2.5 w-16 rounded bg-[#2B3245]" />
                            <Skeleton className="h-2.5 w-12 rounded bg-[#2B3245]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!projectsQuery.isLoading && projects.length === 0 && (
                <div className="pb-8 animate-fade-in">
                  <div className="text-center py-14 px-6 border border-[#2B3245]/50 rounded-xl bg-[#1C2333]/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.04)_0%,_transparent_70%)] pointer-events-none" />
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2]/20 to-[#7C65CB]/20 border border-[#0079F2]/20 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-7 h-7 text-[#0079F2]" />
                      </div>
                      <p className="text-[15px] text-[#F5F9FC] mb-1.5 font-semibold" data-testid="text-empty-home">Start building something amazing</p>
                      <p className="text-[12px] text-[#676D7E] max-w-xs mx-auto mb-5 leading-relaxed">Describe your idea above and let AI build it, or create an empty project to start coding from scratch</p>
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
                          className="h-9 px-4 text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245]/50 text-[12px] rounded-lg gap-1.5"
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
                    <h3 className="text-[11px] font-semibold text-[#676D7E] uppercase tracking-wider" data-testid="text-my-repls">Recent Repls</h3>
                    <div className="flex items-center gap-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-1 text-[10px] text-[#676D7E] hover:text-[#9DA2B0] transition-colors" data-testid="button-sort-by">
                            <ArrowUpDown className="w-3 h-3" />
                            {sortBy === "modified" ? "Last modified" : "Name"}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 bg-[#1C2333] border-[#2B3245] rounded-xl shadow-xl shadow-black/30">
                          <DropdownMenuItem className={`text-[11px] cursor-pointer mx-1 rounded-md ${sortBy === "modified" ? "text-[#0079F2]" : "text-[#9DA2B0]"} focus:bg-[#2B3245] focus:text-[#F5F9FC]`} onClick={() => setSortBy("modified")} data-testid="sort-modified">
                            Last modified
                          </DropdownMenuItem>
                          <DropdownMenuItem className={`text-[11px] cursor-pointer mx-1 rounded-md ${sortBy === "name" ? "text-[#0079F2]" : "text-[#9DA2B0]"} focus:bg-[#2B3245] focus:text-[#F5F9FC]`} onClick={() => setSortBy("name")} data-testid="sort-name">
                            Name
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button className="text-[11px] text-[#0079F2] hover:text-[#0079F2]/80 transition-colors" onClick={() => setSidebarNav("repls")}>
                        View all <ChevronRight className="w-3 h-3 inline" />
                      </button>
                    </div>
                  </div>
                  <div className="border border-[#2B3245]/50 rounded-xl overflow-hidden bg-[#1C2333]/20">
                    {projects.slice(0, 5).map((project, idx) => {
                      const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                      return (
                        <div
                          key={project.id}
                          className={`flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#1C2333]/80 cursor-pointer transition-all group even:bg-[#1C2333]/30 ${idx !== 0 ? "border-t border-[#2B3245]/30" : ""}`}
                          onClick={() => setLocation(`/project/${project.id}`)}
                          data-testid={`card-project-${project.id}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-[10px] font-bold shrink-0 ${langInfo.bg} ${langInfo.color}`}>
                            {langInfo.label}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-[13px] text-[#F5F9FC] truncate group-hover:text-white transition-colors">{project.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[#676D7E] capitalize">{project.language}</span>
                              <span className="text-[8px] text-[#323B4F]">&middot;</span>
                              <span className="text-[10px] text-[#676D7E] flex items-center gap-1">
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
                                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]">
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 bg-[#1C2333] border-[#2B3245] rounded-xl shadow-xl shadow-black/30">
                                <DropdownMenuItem className="gap-2 text-[11px] text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                                  <Copy className="w-3 h-3" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[#2B3245]/50" />
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
            <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#F5F9FC]" data-testid="text-my-repls">My Repls</h2>
                <div className="flex items-center gap-2">
                  <div className="relative sm:hidden">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#676D7E]" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7.5 bg-[#1C2333] border-[#2B3245] h-8 w-40 text-[11px] rounded-lg text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40"
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
                    <div key={i} className="flex flex-col p-4 rounded-xl border border-[#2B3245]/50 bg-[#1C2333]/40">
                      <div className="flex items-start justify-between mb-3">
                        <Skeleton className="w-9 h-9 rounded-lg bg-[#2B3245]" />
                        <Skeleton className="w-6 h-6 rounded-md bg-[#2B3245]" />
                      </div>
                      <Skeleton className="h-4 w-28 rounded bg-[#2B3245] mb-2" />
                      <div className="flex items-center gap-2 mt-auto">
                        <Skeleton className="h-3 w-16 rounded bg-[#2B3245]" />
                        <Skeleton className="h-3 w-12 rounded bg-[#2B3245]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 px-6 border border-[#2B3245]/50 rounded-xl bg-[#1C2333]/30 animate-fade-in relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,121,242,0.04)_0%,_transparent_70%)] pointer-events-none" />
                  <div className="relative">
                    {searchQuery ? (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-[#1C2333] border border-[#2B3245] flex items-center justify-center mx-auto mb-4">
                          <Search className="w-6 h-6 text-[#323B4F]" />
                        </div>
                        <p className="text-[13px] text-[#9DA2B0] mb-1 font-medium" data-testid="text-empty-state">No repls match your search</p>
                        <p className="text-[11px] text-[#676D7E]">Try a different search term</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0079F2]/20 to-[#7C65CB]/20 border border-[#0079F2]/20 flex items-center justify-center mx-auto mb-4">
                          <Code2 className="w-7 h-7 text-[#0079F2]" />
                        </div>
                        <p className="text-[15px] text-[#F5F9FC] mb-1.5 font-semibold" data-testid="text-empty-state">No repls yet</p>
                        <p className="text-[12px] text-[#676D7E] max-w-sm mx-auto mb-5 leading-relaxed">Create your first project to start coding. Use AI to generate one or start from scratch.</p>
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
                            className="h-9 px-4 text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245]/50 text-[12px] rounded-lg gap-1.5"
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
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-[#2B3245] bg-[#1C2333]/20 hover:bg-[#1C2333]/50 hover:border-[#0079F2]/40 cursor-pointer transition-all group min-h-[120px]"
                    onClick={() => setDialogOpen(true)}
                    data-testid="card-create-new-repl"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#0079F2]/10 border border-[#0079F2]/20 flex items-center justify-center mb-2.5 group-hover:bg-[#0079F2]/20 transition-colors">
                      <Plus className="w-5 h-5 text-[#0079F2]" />
                    </div>
                    <p className="text-[12px] font-medium text-[#9DA2B0] group-hover:text-[#F5F9FC] transition-colors">Create New Repl</p>
                  </button>
                  {projects.map((project) => {
                    const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                    return (
                      <div
                        key={project.id}
                        className={`flex flex-col p-4 rounded-xl border border-[#2B3245]/50 border-l-2 ${langInfo.borderAccent} bg-[#1C2333]/40 hover:bg-[#1C2333]/80 hover:border-[#2B3245] hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all group`}
                        onClick={() => setLocation(`/project/${project.id}`)}
                        data-testid={`card-project-${project.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border text-[10px] font-bold ${langInfo.bg} ${langInfo.color}`}>
                            {langInfo.label}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-6 h-6 rounded-md text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]">
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 bg-[#1C2333] border-[#2B3245] rounded-xl shadow-xl shadow-black/30">
                                <DropdownMenuItem className="gap-2 text-[11px] text-[#9DA2B0] focus:bg-[#2B3245] focus:text-[#F5F9FC] cursor-pointer mx-1 rounded-md" onClick={() => duplicateProject.mutate(project.id)}>
                                  <Copy className="w-3 h-3" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-[#2B3245]/50" />
                                <DropdownMenuItem className="gap-2 text-[11px] text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer mx-1 rounded-md" onClick={() => { setDeleteTargetProject({ id: project.id, name: project.name }); setDeleteConfirmDialogOpen(true); }}>
                                  <Trash className="w-3 h-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <h3 className="font-medium text-[13px] text-[#F5F9FC] truncate group-hover:text-white transition-colors mb-1">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-auto">
                          <span className="text-[10px] text-[#676D7E] capitalize">{project.language}</span>
                          <span className="text-[8px] text-[#323B4F]">&middot;</span>
                          <span className="text-[10px] text-[#676D7E] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}
                          </span>
                          <span className="text-[8px] text-[#323B4F]">&middot;</span>
                          <span className="text-[10px] text-[#676D7E] flex items-center gap-1" data-testid={`text-file-count-${project.id}`}>
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

      <Dialog open={deleteConfirmDialogOpen} onOpenChange={(open) => { setDeleteConfirmDialogOpen(open); if (!open) setDeleteTargetProject(null); }}>
        <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#F5F9FC] text-base">Delete Project</DialogTitle>
            <DialogDescription className="text-[#9DA2B0] text-xs">
              Are you sure you want to delete <span className="text-[#F5F9FC] font-medium">{deleteTargetProject?.name}</span>? This action cannot be undone and all files will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" className="flex-1 h-9 text-xs text-[#9DA2B0] hover:text-white hover:bg-[#2B3245] rounded-lg" onClick={() => { setDeleteConfirmDialogOpen(false); setDeleteTargetProject(null); }} data-testid="button-cancel-delete-project">
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
    </div>
  );
}
