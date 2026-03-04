import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Folder, MoreVertical, LogOut, Settings as SettingsIcon, Trash, Copy,
  Loader2, Code2, Search, Eye, Zap
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Project } from "@shared/schema";

const LANG_ICONS: Record<string, { color: string; label: string }> = {
  javascript: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "JS" },
  typescript: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "TS" },
  python: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "PY" },
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

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-[#c9d1d9]">
      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 pb-4 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#58a6ff]/20 flex items-center justify-center border border-[#58a6ff]/30">
                <span className="font-bold text-[#58a6ff] text-xs">{initials}</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">{user?.displayName || user?.email?.split("@")[0]}</h2>
                <p className="text-[11px] text-[#8b949e]">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => setLocation("/settings")} data-testid="button-settings">
                <SettingsIcon className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#30363d]" onClick={() => logout.mutate()} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#484f58]" />
            <Input
              placeholder="Search projects..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#0d1117] border-[#30363d] h-9 text-sm rounded-lg text-[#c9d1d9] placeholder:text-[#484f58]"
              data-testid="input-search"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6">
          {/* Quick Actions */}
          <div className="flex gap-3 mb-6">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-[#58a6ff]/50 transition-colors" data-testid="button-new-project">
                  <div className="w-9 h-9 rounded-lg bg-green-600/20 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-medium text-white">New Project</p>
                    <p className="text-[10px] text-[#8b949e]">Start coding</p>
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#1c2128] border-[#30363d] rounded-xl sm:max-w-sm">
                <DialogHeader><DialogTitle className="text-[#c9d1d9]">Create Project</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); if (newProjectName.trim()) createProject.mutate({ name: newProjectName.trim(), language: newProjectLang }); }} className="space-y-4 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-[#8b949e]">Project Name</Label>
                    <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="my-awesome-app" className="bg-[#0d1117] border-[#30363d] h-10 rounded-lg text-[#c9d1d9]" required data-testid="input-project-name" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[#8b949e]">Language</Label>
                    <div className="flex gap-2">
                      {(["javascript", "typescript", "python"] as const).map((lang) => {
                        const info = LANG_ICONS[lang];
                        return (
                          <button key={lang} type="button" onClick={() => setNewProjectLang(lang)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${newProjectLang === lang ? info.color : "bg-[#30363d]/50 text-[#8b949e] border-transparent hover:border-[#484f58]"}`} data-testid={`button-lang-${lang}`}>
                            <Code2 className="w-3 h-3" /> {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button type="submit" className="w-full rounded-lg bg-green-600 hover:bg-green-700 text-white" disabled={createProject.isPending} data-testid="button-create-project">
                    {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Project"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Link href="/demo">
              <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-[#58a6ff]/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium text-white">Demo</p>
                  <p className="text-[10px] text-[#8b949e]">Try it out</p>
                </div>
              </button>
            </Link>
          </div>

          {/* Projects */}
          <div className="mb-4">
            <h3 className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider mb-3">My Projects ({projects.length})</h3>
          </div>

          {projectsQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#58a6ff]" /></div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16">
              <Folder className="w-12 h-12 mx-auto mb-3 text-[#30363d]" />
              <p className="text-sm text-[#484f58]">{searchQuery ? "No projects match your search" : "No projects yet. Create one to get started!"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project) => {
                const langInfo = LANG_ICONS[project.language] || LANG_ICONS.javascript;
                return (
                  <div
                    key={project.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-[#484f58] cursor-pointer transition-all active:scale-[0.99]"
                    onClick={() => setLocation(`/project/${project.id}`)}
                    data-testid={`card-project-${project.id}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border text-xs font-bold shrink-0 ${langInfo.color}`}>
                      {langInfo.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-white truncate">{project.name}</h3>
                      <p className="text-[11px] text-[#8b949e] mt-0.5">{project.language} · {timeAgo(project.updatedAt)}</p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg text-[#484f58] hover:text-white hover:bg-[#30363d]">
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

      <div className="px-4 py-2 border-t border-[#30363d] bg-[#161b22] flex items-center justify-center shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] text-[#484f58]">
          <Zap className="w-3 h-3" /> Vibe Platform v1.0
        </div>
      </div>
    </div>
  );
}
