import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Folder, MoreVertical, LogOut, Settings as SettingsIcon, Play, Trash, Copy } from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MOCK_PROJECTS = [
  { id: "1", name: "vibe-mobile-app", language: "typescript", updated: "2h ago", status: "stopped" },
  { id: "2", name: "next-portfolio", language: "javascript", updated: "5h ago", status: "running" },
  { id: "3", name: "api-backend", language: "python", updated: "1d ago", status: "stopped" },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("mock_token");
    setLocation("/");
  };

  return (
    <div className="h-full flex flex-col bg-background relative pb-safe">
      <div className="flex items-center justify-between p-4 pt-12 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="font-bold text-primary">DV</span>
          </div>
          <div>
            <h2 className="text-sm font-medium">Developer</h2>
            <p className="text-xs text-muted-foreground">Free Plan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full border-white/5 bg-white/5 hover:bg-white/10" onClick={() => setLocation("/settings")}>
            <SettingsIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full border-white/5 bg-white/5 hover:bg-white/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Button size="sm" className="rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>

        <div className="grid gap-3">
          {MOCK_PROJECTS.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
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
                  <span className={`w-2 h-2 rounded-full ${project.status === 'running' ? 'bg-green-400' : 'bg-blue-400'}`}></span>
                  <p className="text-xs text-muted-foreground truncate">{project.language} • {project.updated}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2" onClick={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-muted-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-white/10 rounded-xl">
                    <DropdownMenuItem className="gap-2 cursor-pointer py-3 rounded-lg"><Play className="w-4 h-4" /> Run Project</DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer py-3 rounded-lg"><Copy className="w-4 h-4" /> Duplicate</DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer py-3 text-destructive focus:text-destructive rounded-lg"><Trash className="w-4 h-4" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {project.status === 'running' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">Running</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}