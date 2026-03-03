import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Folder, MoreVertical, LogOut, Settings as SettingsIcon, Trash, Copy, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectLang, setNewProjectLang] = useState("javascript");
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectsQuery = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    staleTime: 30000,
  });

  const createProject = useMutation({
    mutationFn: async (data: { name: string; language: string }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDialogOpen(false);
      setNewProjectName("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted" });
    },
  });

  const duplicateProject = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/projects/${id}/duplicate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project duplicated" });
    },
  });

  const timeAgo = (date: string | Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const projects = projectsQuery.data || [];
  const initials = user?.displayName?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="h-full flex flex-col bg-background relative pb-safe">
      <div className="flex items-center justify-between p-4 pt-12 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="font-bold text-primary text-sm">{initials}</span>
          </div>
          <div>
            <h2 className="text-sm font-medium">{user?.displayName || user?.email}</h2>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full border-white/5 bg-white/5 hover:bg-white/10" onClick={() => setLocation("/settings")} data-testid="button-settings">
            <SettingsIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full border-white/5 bg-white/5 hover:bg-white/10" onClick={() => logout.mutate()} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(139,92,246,0.3)]" data-testid="button-new-project">
                <Plus className="w-4 h-4 mr-1" /> New
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10 rounded-2xl max-w-sm">
              <DialogHeader>
                <DialogTitle>New Project</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newProjectName.trim()) {
                    createProject.mutate({ name: newProjectName.trim(), language: newProjectLang });
                  }
                }}
                className="space-y-4 mt-2"
              >
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Project Name</Label>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="my-awesome-app"
                    className="bg-background/50 border-white/10 h-11 rounded-xl"
                    required
                    data-testid="input-project-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Language</Label>
                  <div className="flex gap-2">
                    {["javascript", "typescript", "python"].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setNewProjectLang(lang)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${newProjectLang === lang ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
                        data-testid={`button-lang-${lang}`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-xl bg-primary" disabled={createProject.isPending} data-testid="button-create-project">
                  {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {projectsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No projects yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-panel p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/5 active:scale-[0.98] transition-all"
                onClick={() => setLocation(`/project/${project.id}`)}
                data-testid={`card-project-${project.id}`}
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/30 flex items-center justify-center shrink-0">
                  <Folder className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{project.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <p className="text-xs text-muted-foreground truncate">{project.language} • {timeAgo(project.updatedAt)}</p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-white/10 rounded-xl">
                      <DropdownMenuItem className="gap-2 cursor-pointer py-3 rounded-lg" onClick={() => duplicateProject.mutate(project.id)}>
                        <Copy className="w-4 h-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer py-3 text-destructive focus:text-destructive rounded-lg" onClick={() => deleteProject.mutate(project.id)}>
                        <Trash className="w-4 h-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
