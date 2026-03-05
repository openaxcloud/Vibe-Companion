import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Folder, MoreVertical, LogOut, Settings as SettingsIcon, Trash, Copy,
  Loader2, Code2, Search, Eye, Zap, Sparkles, ArrowRight, Send,
  Globe, Database, Gamepad2, LayoutDashboard, Clock, FileCode, ChevronDown, ChevronRight
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import type { Project } from "@shared/schema";

const LANG_ICONS: Record<string, { color: string; bg: string; label: string }> = {
  javascript: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "JS" },
  typescript: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "TS" },
  python: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "PY" },
};

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
  const templatesRef = useRef<HTMLDivElement>(null);

  const projectsQuery = useQuery<Project[]>({ queryKey: ["/api/projects"], staleTime: 30000 });

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
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/projects/generate", { prompt });
      return res.json();
    },
    onSuccess: (data: { project: Project }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setAiPrompt("");
      setLocation(`/project/${data.project.id}`);
    },
    onError: (err: any) => { toast({ title: "Generation failed", description: err.message, variant: "destructive" }); },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/projects/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); toast({ title: "Project deleted" }); },
  });

  const duplicateProject = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/projects/${id}/duplicate`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/projects"] }); toast({ title: "Project duplicated" }); },
  });

  const timeAgo = (date: string | Date) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const projects = (projectsQuery.data || []).filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const initials = user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  const TEMPLATES = [
    { name: "Web App", desc: "React + Express full-stack starter", prompt: "A modern web app with React frontend, Express backend, and a responsive dashboard", icon: Globe, gradient: "from-[#0079F2]/20 to-[#00B4D8]/20", iconColor: "text-[#0079F2]", borderColor: "border-[#0079F2]/20 hover:border-[#0079F2]/50" },
    { name: "API Server", desc: "REST API with authentication", prompt: "A REST API server with user authentication, CRUD endpoints, and JSON responses", icon: Database, gradient: "from-[#0CCE6B]/20 to-[#00B4D8]/20", iconColor: "text-[#0CCE6B]", borderColor: "border-[#0CCE6B]/20 hover:border-[#0CCE6B]/50" },
    { name: "Dashboard", desc: "Admin panel with charts", prompt: "An admin dashboard with sidebar navigation, data tables, charts, and user management", icon: LayoutDashboard, gradient: "from-[#7C65CB]/20 to-[#A371F7]/20", iconColor: "text-[#7C65CB]", borderColor: "border-[#7C65CB]/20 hover:border-[#7C65CB]/50" },
    { name: "Game", desc: "Browser game with Canvas", prompt: "A simple browser-based snake game using HTML5 Canvas with score tracking", icon: Gamepad2, gradient: "from-[#F59E0B]/20 to-[#EF4444]/20", iconColor: "text-[#F59E0B]", borderColor: "border-[#F59E0B]/20 hover:border-[#F59E0B]/50" },
  ];

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiPrompt.trim().length >= 3) generateProject.mutate(aiPrompt.trim());
  };

  return (
    <div className="h-screen flex flex-col bg-[#0E1525] text-[#F5F9FC]">
      <header className="flex items-center justify-between px-4 sm:px-6 h-12 bg-[#0E1525] border-b border-[#2B3245] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0079F2] to-[#7C65CB] flex items-center justify-center">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-[#F5F9FC] tracking-tight">Replit</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/demo">
            <Button variant="ghost" size="sm" className="h-8 text-[11px] text-[#9DA2B0] hover:text-[#F5F9FC] hover:bg-[#2B3245] gap-1.5 hidden sm:flex" data-testid="button-demo">
              <Eye className="w-3.5 h-3.5" /> Demo
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] rounded-lg gap-1 font-medium" data-testid="button-new-project">
                <Plus className="w-3.5 h-3.5" /> Create Repl
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1C2333] border-[#2B3245] rounded-xl sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-[#F5F9FC]">Create Repl</DialogTitle>
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
                        <button key={lang} type="button" onClick={() => setNewProjectLang(lang)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${newProjectLang === lang ? `${info.bg} ${info.color}` : "bg-[#2B3245]/50 text-[#9DA2B0] border-transparent hover:border-[#323B4F]"}`} data-testid={`button-lang-${lang}`}>
                          <Code2 className="w-3 h-3" /> {info.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white" disabled={createProject.isPending} data-testid="button-create-project">
                  {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Repl"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0079F2]/30 to-[#7C65CB]/30 flex items-center justify-center border border-[#2B3245] hover:border-[#323B4F] transition-colors" data-testid="button-user-menu">
                <span className="text-[10px] font-bold text-[#F5F9FC]">{initials}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-[#1C2333] border-[#2B3245]">
              <div className="px-3 py-2.5 border-b border-[#2B3245]">
                <p className="text-xs font-medium text-[#F5F9FC] truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                <p className="text-[10px] text-[#676D7E] truncate mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] cursor-pointer" onClick={() => setLocation("/settings")}>
                <SettingsIcon className="w-3.5 h-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2B3245]" />
              <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-[#2B3245] focus:text-red-400 cursor-pointer" onClick={() => logout.mutate()}>
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="pt-12 sm:pt-16 pb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F9FC] mb-2 tracking-tight" data-testid="text-hero-title">What will you create?</h1>
            <p className="text-sm text-[#676D7E]">Describe your idea and AI will build it for you</p>
          </div>

          <form onSubmit={handleGenerateSubmit} className="mb-10">
            <div className="relative rounded-xl border border-[#2B3245] bg-[#1C2333] overflow-hidden focus-within:border-[#0079F2]/50 transition-colors">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Build me a todo app with drag-and-drop, dark mode, and local storage..."
                rows={3}
                className="w-full bg-transparent text-sm text-[#F5F9FC] placeholder:text-[#676D7E] px-4 pt-4 pb-2 resize-none focus:outline-none"
                disabled={generateProject.isPending}
                data-testid="input-ai-prompt"
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#7C65CB]/10 text-[#7C65CB] border border-[#7C65CB]/20">
                    <Sparkles className="w-3 h-3" /> Claude Sonnet
                  </span>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-4 bg-[#0CCE6B] hover:bg-[#0AB85E] text-[#0E1525] rounded-lg text-xs font-semibold gap-1.5 shadow-sm"
                  disabled={generateProject.isPending || aiPrompt.trim().length < 3}
                  data-testid="button-generate-project"
                >
                  {generateProject.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Create</>
                  )}
                </Button>
              </div>
            </div>
            {generateProject.isPending && (
              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-[#7C65CB]">
                <div className="flex gap-1">
                  <span className="bouncing-dot"></span>
                  <span className="bouncing-dot"></span>
                  <span className="bouncing-dot"></span>
                </div>
                AI is generating your project...
              </div>
            )}
          </form>

          <div className="mb-10">
            <h3 className="text-xs font-semibold text-[#676D7E] uppercase tracking-wider mb-3">Templates</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" ref={templatesRef}>
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  className={`flex flex-col items-start gap-3 p-4 rounded-xl bg-gradient-to-br ${tmpl.gradient} border ${tmpl.borderColor} transition-all text-left group active:scale-[0.98] min-w-[160px] sm:min-w-[180px] shrink-0`}
                  onClick={() => { setAiPrompt(tmpl.prompt); generateProject.mutate(tmpl.prompt); }}
                  disabled={generateProject.isPending}
                  data-testid={`template-${tmpl.name.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#0E1525]/60 flex items-center justify-center">
                    <tmpl.icon className={`w-4.5 h-4.5 ${tmpl.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#F5F9FC] group-hover:text-[#0079F2] transition-colors">{tmpl.name}</p>
                    <p className="text-[10px] text-[#676D7E] mt-0.5 leading-relaxed">{tmpl.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-[#676D7E] uppercase tracking-wider" data-testid="text-my-repls">My Repls ({projects.length})</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#676D7E]" />
                <Input
                  placeholder="Search..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-[#0E1525] border-[#2B3245] h-8 w-44 text-xs rounded-lg text-[#F5F9FC] placeholder:text-[#676D7E] focus-visible:ring-1 focus-visible:ring-[#0079F2]/40"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>

          {projectsQuery.isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#0079F2]" /></div>
          ) : projects.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-[#1C2333] border border-[#2B3245] flex items-center justify-center mx-auto mb-4">
                <Folder className="w-8 h-8 text-[#2B3245]" />
              </div>
              <p className="text-sm text-[#9DA2B0] mb-1" data-testid="text-empty-state">{searchQuery ? "No repls match your search" : "No repls yet"}</p>
              <p className="text-xs text-[#676D7E]">Create your first repl or use AI to generate one</p>
            </div>
          ) : (
            <div className="space-y-0.5 pb-8">
              {projects.map((project) => {
                const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                return (
                  <div
                    key={project.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1C2333] cursor-pointer transition-colors group border border-transparent hover:border-[#2B3245]"
                    onClick={() => setLocation(`/project/${project.id}`)}
                    data-testid={`card-project-${project.id}`}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center border text-[10px] font-bold shrink-0 ${langInfo.bg} ${langInfo.color}`}>
                      {langInfo.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-[#F5F9FC] truncate">{project.name}</h3>
                        {project.isPublished && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0CCE6B]/10 text-[#0CCE6B] border border-[#0CCE6B]/20 shrink-0">Live</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#676D7E]">{project.language}</span>
                        <span className="text-[10px] text-[#2B3245]">&middot;</span>
                        <span className="text-[10px] text-[#676D7E] flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 bg-[#1C2333] border-[#2B3245]">
                          <DropdownMenuItem className="gap-2 text-xs text-[#9DA2B0] focus:bg-[#2B3245] cursor-pointer" onClick={() => duplicateProject.mutate(project.id)}>
                            <Copy className="w-3.5 h-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-[#2B3245] focus:text-red-400 cursor-pointer" onClick={() => deleteProject.mutate(project.id)}>
                            <Trash className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <footer className="px-4 py-2 border-t border-[#2B3245] bg-[#0E1525] flex items-center justify-center shrink-0">
        <div className="flex items-center gap-2 text-[10px] text-[#676D7E]">
          <div className="w-4 h-4 rounded bg-gradient-to-br from-[#0079F2]/40 to-[#7C65CB]/40 flex items-center justify-center">
            <Code2 className="w-2.5 h-2.5 text-white/60" />
          </div>
          Replit
        </div>
      </footer>
    </div>
  );
}
