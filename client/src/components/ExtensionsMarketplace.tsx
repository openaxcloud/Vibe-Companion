import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Puzzle, Search, Download, CheckCircle, Star, Package,
  Code, Database, Globe, Shield, Palette, Zap, Terminal,
  FileCode, GitBranch, Layers, RefreshCw, Trash2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ExtensionsMarketplaceProps {
  projectId: number;
  className?: string;
}

interface Extension {
  id: string;
  name: string;
  description: string;
  icon: typeof Code;
  category: string;
  version: string;
  author: string;
  downloads: string;
  rating: number;
  color: string;
}

const AVAILABLE_EXTENSIONS: Extension[] = [
  { id: "prettier", name: "Prettier", description: "Automatic code formatting for JS, TS, CSS, HTML, JSON, and more", icon: FileCode, category: "Formatting", version: "3.2.5", author: "Prettier", downloads: "42M", rating: 4.8, color: "#56B3B4" },
  { id: "eslint", name: "ESLint", description: "Find and fix problems in your JavaScript/TypeScript code", icon: Shield, category: "Linting", version: "9.1.0", author: "ESLint", downloads: "38M", rating: 4.7, color: "#4B32C3" },
  { id: "tailwind-intellisense", name: "Tailwind CSS IntelliSense", description: "Intelligent autocomplete for Tailwind CSS classes", icon: Palette, category: "CSS", version: "0.12.0", author: "Tailwind Labs", downloads: "18M", rating: 4.9, color: "#38BDF8" },
  { id: "git-lens", name: "GitLens", description: "Supercharge Git - visualize code authorship, history, and changes", icon: GitBranch, category: "Git", version: "15.0.4", author: "GitKraken", downloads: "32M", rating: 4.6, color: "#F05033" },
  { id: "docker", name: "Docker", description: "Build, manage and deploy containerized applications", icon: Layers, category: "DevOps", version: "1.29.0", author: "Microsoft", downloads: "25M", rating: 4.5, color: "#2496ED" },
  { id: "live-server", name: "Live Server", description: "Launch a local development server with hot reload for static pages", icon: Globe, category: "Tools", version: "5.7.9", author: "Ritwick Dey", downloads: "45M", rating: 4.4, color: "#41B883" },
  { id: "db-client", name: "Database Client", description: "Browse and query PostgreSQL, MySQL, SQLite databases", icon: Database, category: "Database", version: "4.5.2", author: "cweijan", downloads: "8M", rating: 4.3, color: "#336791" },
  { id: "thunder-client", name: "Thunder Client", description: "Lightweight REST API client for testing HTTP requests", icon: Zap, category: "API", version: "2.22.0", author: "Thunder Client", downloads: "12M", rating: 4.7, color: "#A855F7" },
  { id: "terminal-tabs", name: "Terminal Tabs", description: "Enhanced terminal with tabs, split panes, and custom profiles", icon: Terminal, category: "Tools", version: "1.8.0", author: "Vibe Companion", downloads: "5M", rating: 4.2, color: "#22C55E" },
  { id: "import-cost", name: "Import Cost", description: "Display size of imported packages inline in the editor", icon: Package, category: "Performance", version: "3.3.0", author: "Wix", downloads: "6M", rating: 4.1, color: "#E11D48" },
  { id: "code-runner", name: "Code Runner", description: "Run code snippets in any language with a single click", icon: Code, category: "Tools", version: "0.12.1", author: "Jun Han", downloads: "28M", rating: 4.6, color: "#F59E0B" },
  { id: "auto-rename", name: "Auto Rename Tag", description: "Automatically rename paired HTML/XML tags", icon: FileCode, category: "HTML", version: "0.1.10", author: "Jun Han", downloads: "15M", rating: 4.5, color: "#E34F26" },
];

const categories = ["All", ...new Set(AVAILABLE_EXTENSIONS.map(e => e.category))];

export function ExtensionsMarketplace({ projectId, className }: ExtensionsMarketplaceProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: installed = [], isLoading } = useQuery<string[]>({
    queryKey: ["/api/projects", projectId, "extensions"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/projects/${projectId}/extensions`);
        return res.json();
      } catch {
        return [];
      }
    },
  });

  const installMutation = useMutation({
    mutationFn: async (extId: string) => {
      const csrf = getCsrfToken();
      const res = await apiRequest("POST", `/api/projects/${projectId}/extensions`, { extensionId: extId });
      return res.json();
    },
    onSuccess: (_, extId) => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "extensions"] });
      const ext = AVAILABLE_EXTENSIONS.find(e => e.id === extId);
      toast({ title: `${ext?.name || extId} installed` });
    },
    onError: (err: any) => {
      toast({ title: "Install failed", description: err.message, variant: "destructive" });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async (extId: string) => {
      const csrf = getCsrfToken();
      await apiRequest("DELETE", `/api/projects/${projectId}/extensions/${extId}`);
    },
    onSuccess: (_, extId) => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "extensions"] });
      const ext = AVAILABLE_EXTENSIONS.find(e => e.id === extId);
      toast({ title: `${ext?.name || extId} uninstalled` });
    },
  });

  const filtered = useMemo(() => {
    return AVAILABLE_EXTENSIONS.filter(ext => {
      const matchesSearch = !search || ext.name.toLowerCase().includes(search.toLowerCase()) || ext.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || ext.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const installedExts = filtered.filter(e => installed.includes(e.id));
  const availableExts = filtered.filter(e => !installed.includes(e.id));

  return (
    <div className={cn("h-full flex flex-col overflow-hidden", className)}>
      <div className="p-3 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Puzzle className="w-4 h-4 text-[#0CCE6B]" />
          <h2 className="text-[13px] font-semibold text-[var(--ide-text)]" data-testid="text-extensions-title">Extensions</h2>
          <span className="ml-auto text-[10px] text-[var(--ide-text-muted)]">{installed.length} installed</span>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ide-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search extensions..."
            className="h-7 pl-7 text-[11px] bg-[var(--ide-surface)] border-[var(--ide-border)] text-[var(--ide-text)] rounded-md"
            data-testid="input-search-extensions"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-2 py-0.5 text-[9px] rounded-full border transition-colors",
                activeCategory === cat
                  ? "bg-[#0CCE6B]/15 border-[#0CCE6B]/40 text-[#0CCE6B]"
                  : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
              )}
              data-testid={`button-category-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
          </div>
        ) : (
          <>
            {installedExts.length > 0 && (
              <div>
                <h3 className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Installed</h3>
                <div className="space-y-1.5">
                  {installedExts.map(ext => (
                    <ExtensionCard
                      key={ext.id}
                      ext={ext}
                      installed
                      onUninstall={() => uninstallMutation.mutate(ext.id)}
                      loading={uninstallMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              {installedExts.length > 0 && (
                <h3 className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider mb-2">Available</h3>
              )}
              <div className="space-y-1.5">
                {availableExts.map(ext => (
                  <ExtensionCard
                    key={ext.id}
                    ext={ext}
                    installed={false}
                    onInstall={() => installMutation.mutate(ext.id)}
                    loading={installMutation.isPending}
                  />
                ))}
              </div>
              {availableExts.length === 0 && installedExts.length === 0 && (
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-6">No extensions match your search</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExtensionCard({ ext, installed, onInstall, onUninstall, loading }: {
  ext: Extension;
  installed: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  loading: boolean;
}) {
  const Icon = ext.icon;
  return (
    <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-[var(--ide-surface)] transition-colors group" data-testid={`card-extension-${ext.id}`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${ext.color}15` }}>
        <Icon className="w-4 h-4" style={{ color: ext.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[var(--ide-text)] truncate">{ext.name}</span>
          <span className="text-[9px] text-[var(--ide-text-muted)]">v{ext.version}</span>
        </div>
        <p className="text-[10px] text-[var(--ide-text-muted)] line-clamp-2 mt-0.5">{ext.description}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[9px] text-[var(--ide-text-muted)]">{ext.author}</span>
          <div className="flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
            <span className="text-[9px] text-[var(--ide-text-muted)]">{ext.rating}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Download className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
            <span className="text-[9px] text-[var(--ide-text-muted)]">{ext.downloads}</span>
          </div>
        </div>
      </div>
      <div className="shrink-0">
        {installed ? (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-[#0CCE6B]" />
            <button
              onClick={onUninstall}
              className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
              data-testid={`button-uninstall-${ext.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onInstall}
            disabled={loading}
            className="h-6 px-2 text-[10px] bg-[#0CCE6B]/15 hover:bg-[#0CCE6B]/25 text-[#0CCE6B] border border-[#0CCE6B]/30 rounded"
            data-testid={`button-install-${ext.id}`}
          >
            <Download className="w-2.5 h-2.5 mr-1" />
            Install
          </Button>
        )}
      </div>
    </div>
  );
}
