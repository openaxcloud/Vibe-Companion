import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Folder, MoreVertical, LogOut, Settings as SettingsIcon, Trash, Copy,
  Loader2, Code2, Search, Eye, Zap, Sparkles, ArrowRight, Send,
  Globe, Database, Gamepad2, LayoutDashboard, Clock, FileCode, ChevronDown
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
import { useState } from "react";
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
    { name: "Web App", desc: "React + Express full-stack starter", prompt: "A modern web app with React frontend, Express backend, and a responsive dashboard", icon: Globe, gradient: "from-blue-500/20 to-cyan-500/20", iconColor: "text-blue-400", borderColor: "border-blue-500/20 hover:border-blue-500/40" },
    { name: "API Server", desc: "REST API with authentication", prompt: "A REST API server with user authentication, CRUD endpoints, and JSON responses", icon: Database, gradient: "from-green-500/20 to-emerald-500/20", iconColor: "text-green-400", borderColor: "border-green-500/20 hover:border-green-500/40" },
    { name: "Dashboard", desc: "Admin panel with charts", prompt: "An admin dashboard with sidebar navigation, data tables, charts, and user management", icon: LayoutDashboard, gradient: "from-purple-500/20 to-violet-500/20", iconColor: "text-purple-400", borderColor: "border-purple-500/20 hover:border-purple-500/40" },
    { name: "Game", desc: "Browser game with Canvas", prompt: "A simple browser-based snake game using HTML5 Canvas with score tracking", icon: Gamepad2, gradient: "from-orange-500/20 to-amber-500/20", iconColor: "text-orange-400", borderColor: "border-orange-500/20 hover:border-orange-500/40" },
  ];

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiPrompt.trim().length >= 3) generateProject.mutate(aiPrompt.trim());
  };

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-[#c9d1d9]">
      <header className="flex items-center justify-between px-4 sm:px-6 h-12 bg-[#010409] border-b border-[#21262d] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#58a6ff] to-[#a371f7] flex items-center justify-center">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">Vibe</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/demo">
            <Button variant="ghost" size="sm" className="h-8 text-[11px] text-[#8b949e] hover:text-white hover:bg-[#21262d] gap-1.5 hidden sm:flex" data-testid="button-demo">
              <Eye className="w-3.5 h-3.5" /> Demo
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 rounded-full bg-gradient-to-br from-[#58a6ff]/30 to-[#a371f7]/30 flex items-center justify-center border border-[#30363d] hover:border-[#484f58] transition-colors" data-testid="button-user-menu">
                <span className="text-[10px] font-bold text-white">{initials}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-[#1c2128] border-[#30363d]">
              <div className="px-3 py-2.5 border-b border-[#30363d]">
                <p className="text-xs font-medium text-white truncate">{user?.displayName || user?.email?.split("@")[0]}</p>
                <p className="text-[10px] text-[#8b949e] truncate mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => setLocation("/settings")}>
                <SettingsIcon className="w-3.5 h-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#30363d]" />
              <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-[#30363d] focus:text-red-400 cursor-pointer" onClick={() => logout.mutate()}>
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="pt-12 sm:pt-16 pb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">What do you want to create?</h1>
            <p className="text-sm text-[#8b949e]">Describe your idea and AI will build it for you</p>
          </div>

          <form onSubmit={handleGenerateSubmit} className="mb-10">
            <div className="relative rounded-xl border border-[#30363d] bg-[#161b22] glow-border overflow-hidden focus-within:border-[#58a6ff]/50 transition-colors">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Build me a todo app with drag-and-drop, dark mode, and local storage..."
                rows={3}
                className="w-full bg-transparent text-sm text-[#c9d1d9] placeholder:text-[#484f58] px-4 pt-4 pb-2 resize-none focus:outline-none"
                disabled={generateProject.isPending}
                data-testid="input-ai-prompt"
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Sparkles className="w-3 h-3" /> Claude Sonnet
                  </span>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-4 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg text-xs font-medium gap-1.5 shadow-sm"
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
              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-purple-400">
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
            <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-3">Templates</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  className={`flex flex-col items-start gap-3 p-4 rounded-xl bg-gradient-to-br ${tmpl.gradient} border ${tmpl.borderColor} transition-all text-left group active:scale-[0.98]`}
                  onClick={() => { setAiPrompt(tmpl.prompt); generateProject.mutate(tmpl.prompt); }}
                  disabled={generateProject.isPending}
                  data-testid={`template-${tmpl.name.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-[#0d1117]/60 flex items-center justify-center`}>
                    <tmpl.icon className={`w-4.5 h-4.5 ${tmpl.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#58a6ff] transition-colors">{tmpl.name}</p>
                    <p className="text-[10px] text-[#8b949e] mt-0.5 leading-relaxed">{tmpl.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">My Repls ({projects.length})</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#484f58]" />
                <Input
                  placeholder="Search..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-[#0d1117] border-[#21262d] h-8 w-44 text-xs rounded-lg text-[#c9d1d9] placeholder:text-[#484f58] focus-visible:ring-1 focus-visible:ring-[#58a6ff]/40"
                  data-testid="input-search"
                />
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 bg-[#238636] hover:bg-[#2ea043] text-white text-[11px] rounded-lg gap-1" data-testid="button-new-project">
                    <Plus className="w-3.5 h-3.5" /> Repl
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-[#c9d1d9]">Create Repl</DialogTitle>
                    <DialogDescription className="text-[#8b949e] text-xs">Start with an empty project</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); if (newProjectName.trim()) createProject.mutate({ name: newProjectName.trim(), language: newProjectLang }); }} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#8b949e]">Title</Label>
                      <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="my-awesome-app" className="bg-[#0d1117] border-[#30363d] h-10 rounded-lg text-[#c9d1d9]" required data-testid="input-project-name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#8b949e]">Language</Label>
                      <div className="flex gap-2">
                        {(["javascript", "typescript", "python"] as const).map((lang) => {
                          const info = LANG_ICONS[lang];
                          return (
                            <button key={lang} type="button" onClick={() => setNewProjectLang(lang)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${newProjectLang === lang ? `${info.bg} ${info.color}` : "bg-[#30363d]/50 text-[#8b949e] border-transparent hover:border-[#484f58]"}`} data-testid={`button-lang-${lang}`}>
                              <Code2 className="w-3 h-3" /> {info.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Button type="submit" className="w-full rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white" disabled={createProject.isPending} data-testid="button-create-project">
                      {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Repl"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {projectsQuery.isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#58a6ff]" /></div>
          ) : projects.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-[#161b22] border border-[#21262d] flex items-center justify-center mx-auto mb-4">
                <Folder className="w-8 h-8 text-[#30363d]" />
              </div>
              <p className="text-sm text-[#8b949e] mb-1">{searchQuery ? "No repls match your search" : "No repls yet"}</p>
              <p className="text-xs text-[#484f58]">Create your first repl or use AI to generate one</p>
            </div>
          ) : (
            <div className="space-y-1 pb-8">
              {projects.map((project) => {
                const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                return (
                  <div
                    key={project.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#161b22] cursor-pointer transition-colors group"
                    onClick={() => setLocation(`/project/${project.id}`)}
                    data-testid={`card-project-${project.id}`}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center border text-[10px] font-bold shrink-0 ${langInfo.bg} ${langInfo.color}`}>
                      {langInfo.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-[#e6edf3] truncate">{project.name}</h3>
                        {project.isPublished && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0">Live</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[#484f58]">{project.language}</span>
                        <span className="text-[10px] text-[#30363d]">&middot;</span>
                        <span className="text-[10px] text-[#484f58] flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 rounded-md text-[#484f58] hover:text-white hover:bg-[#30363d]">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 bg-[#1c2128] border-[#30363d]">
                          <DropdownMenuItem className="gap-2 text-xs text-[#c9d1d9] focus:bg-[#30363d] cursor-pointer" onClick={() => duplicateProject.mutate(project.id)}>
                            <Copy className="w-3.5 h-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-xs text-red-400 focus:bg-[#30363d] focus:text-red-400 cursor-pointer" onClick={() => deleteProject.mutate(project.id)}>
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

      <footer className="px-4 py-2 border-t border-[#21262d] bg-[#010409] flex items-center justify-center shrink-0">
        <div className="flex items-center gap-2 text-[10px] text-[#484f58]">
          <div className="w-4 h-4 rounded bg-gradient-to-br from-[#58a6ff]/40 to-[#a371f7]/40 flex items-center justify-center">
            <Code2 className="w-2.5 h-2.5 text-white/60" />
          </div>
          Vibe Platform
        </div>
      </footer>
    </div>
  );
}
