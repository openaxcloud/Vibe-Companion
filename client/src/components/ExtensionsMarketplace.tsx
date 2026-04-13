import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Puzzle, Search, Download, CheckCircle, Star, Package,
  Code, Database, Globe, Shield, Palette, Zap, Terminal,
  FileCode, GitBranch, Layers, RefreshCw, Trash2, Loader2,
  AlertTriangle, Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ExtensionsMarketplaceProps {
  projectId: string | number;
  className?: string;
}

interface CatalogExtension {
  extensionId: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  icon: string;
  npmPackage: string | null;
  type: 'npm' | 'native' | 'unavailable';
  nativeFeature?: string;
}

interface InstalledExtension {
  id: string;
  extensionId: string;
  name: string;
  version: string;
  enabled: boolean;
  category: string;
  npmPackage: string | null;
}

const ICON_MAP: Record<string, typeof Code> = {
  "file-code": FileCode,
  "shield": Shield,
  "palette": Palette,
  "git-branch": GitBranch,
  "layers": Layers,
  "globe": Globe,
  "database": Database,
  "zap": Zap,
  "terminal": Terminal,
  "package": Package,
  "code": Code,
};

const CATEGORY_COLORS: Record<string, string> = {
  Formatting: "#56B3B4",
  Linting: "#4B32C3",
  CSS: "#38BDF8",
  Git: "#F05033",
  DevOps: "#2496ED",
  Tools: "#41B883",
  Database: "#336791",
  API: "#A855F7",
  Performance: "#E11D48",
  HTML: "#E34F26",
};

export function ExtensionsMarketplace({ projectId, className }: ExtensionsMarketplaceProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: catalog = [], isLoading: catalogLoading } = useQuery<CatalogExtension[]>({
    queryKey: ["/api/extensions/marketplace"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/extensions/marketplace");
        const data = await res.json();
        return data.extensions || [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: installed = [], isLoading: installedLoading } = useQuery<InstalledExtension[]>({
    queryKey: ["/api/extensions", projectId, "installed"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/extensions/${projectId}/installed`);
        return res.json();
      } catch {
        return [];
      }
    },
  });

  const installedIds = useMemo(() => new Set(installed.map(e => e.extensionId)), [installed]);

  const installMutation = useMutation({
    mutationFn: async (extensionId: string) => {
      setInstallingId(extensionId);
      const res = await apiRequest("POST", `/api/extensions/${projectId}/install`, { extensionId });
      return res.json();
    },
    onSuccess: (_, extensionId) => {
      setInstallingId(null);
      qc.invalidateQueries({ queryKey: ["/api/extensions", projectId, "installed"] });
      const ext = catalog.find(e => e.extensionId === extensionId);
      toast({ title: `${ext?.name || extensionId} installed`, description: ext?.npmPackage ? `npm package "${ext.npmPackage}" added to devDependencies` : "Extension activated" });
    },
    onError: (err: any, extensionId) => {
      setInstallingId(null);
      toast({ title: "Install failed", description: err.message || "Unknown error", variant: "destructive" });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async (extensionId: string) => {
      setUninstallingId(extensionId);
      const res = await apiRequest("POST", `/api/extensions/${projectId}/uninstall`, { extensionId });
      return res.json();
    },
    onSuccess: (_, extensionId) => {
      setUninstallingId(null);
      qc.invalidateQueries({ queryKey: ["/api/extensions", projectId, "installed"] });
      const ext = catalog.find(e => e.extensionId === extensionId);
      toast({ title: `${ext?.name || extensionId} uninstalled` });
    },
    onError: (err: any) => {
      setUninstallingId(null);
      toast({ title: "Uninstall failed", description: err.message, variant: "destructive" });
    },
  });

  const categories = useMemo(() => {
    const cats = [...new Set(catalog.map(e => e.category))];
    return ["All", ...cats];
  }, [catalog]);

  const filtered = useMemo(() => {
    return catalog.filter(ext => {
      const matchesSearch = !search || ext.name.toLowerCase().includes(search.toLowerCase()) || ext.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || ext.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [catalog, search, activeCategory]);

  const installedExts = filtered.filter(e => installedIds.has(e.extensionId));
  const availableExts = filtered.filter(e => !installedIds.has(e.extensionId));
  const isLoading = catalogLoading || installedLoading;

  return (
    <div className={cn("h-full flex flex-col overflow-hidden", className)}>
      <div className="p-3 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Puzzle className="w-4 h-4 text-[#0CCE6B]" />
          <h2 className="text-[13px] font-semibold text-[var(--ide-text)]" data-testid="text-extensions-title">Extensions</h2>
          <span className="ml-auto text-[10px] text-[var(--ide-text-muted)]" data-testid="text-installed-count">{installed.length} installed</span>
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
                      key={ext.extensionId}
                      ext={ext}
                      installed
                      onUninstall={() => uninstallMutation.mutate(ext.extensionId)}
                      loading={uninstallingId === ext.extensionId}
                      installingId={null}
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
                    key={ext.extensionId}
                    ext={ext}
                    installed={false}
                    onInstall={() => installMutation.mutate(ext.extensionId)}
                    loading={false}
                    installingId={installingId}
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

function ExtensionCard({ ext, installed, onInstall, onUninstall, loading, installingId }: {
  ext: CatalogExtension;
  installed: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  loading: boolean;
  installingId: string | null;
}) {
  const Icon = ICON_MAP[ext.icon] || Code;
  const color = CATEGORY_COLORS[ext.category] || "#888";
  const isInstalling = installingId === ext.extensionId;
  const isUnavailable = ext.type === 'unavailable';
  const isNative = ext.type === 'native';

  return (
    <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-[var(--ide-surface)] transition-colors group" data-testid={`card-extension-${ext.extensionId}`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[var(--ide-text)] truncate">{ext.name}</span>
          <span className="text-[9px] text-[var(--ide-text-muted)]">v{ext.version}</span>
          {ext.npmPackage && (
            <span className="text-[8px] px-1 py-0 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">npm</span>
          )}
          {isNative && (
            <span className="text-[8px] px-1 py-0 rounded bg-green-500/10 text-green-400 border border-green-500/20">built-in</span>
          )}
          {isUnavailable && (
            <span className="text-[8px] px-1 py-0 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">N/A</span>
          )}
        </div>
        <p className="text-[10px] text-[var(--ide-text-muted)] line-clamp-2 mt-0.5">{ext.description}</p>
        {isNative && ext.nativeFeature && (
          <p className="text-[9px] text-green-400/70 mt-0.5 flex items-center gap-1">
            <Info className="w-2.5 h-2.5" />
            {ext.nativeFeature}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[9px] text-[var(--ide-text-muted)]">{ext.author}</span>
        </div>
      </div>
      <div className="shrink-0">
        {installed ? (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-[#0CCE6B]" />
            <button
              onClick={onUninstall}
              disabled={loading}
              className="opacity-0 group-hover:opacity-100 text-[var(--ide-text-muted)] hover:text-red-400 transition-all disabled:opacity-50"
              data-testid={`button-uninstall-${ext.extensionId}`}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
          </div>
        ) : isUnavailable ? (
          <Button
            size="sm"
            disabled
            className="h-6 px-2 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded cursor-not-allowed"
            data-testid={`button-unavailable-${ext.extensionId}`}
          >
            <AlertTriangle className="w-2.5 h-2.5 mr-1" />
            N/A
          </Button>
        ) : isInstalling ? (
          <Button
            size="sm"
            disabled
            className="h-6 px-2 text-[10px] bg-[#0CCE6B]/15 text-[#0CCE6B] border border-[#0CCE6B]/30 rounded"
            data-testid={`button-installing-${ext.extensionId}`}
          >
            <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
            Installing...
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onInstall}
            className="h-6 px-2 text-[10px] bg-[#0CCE6B]/15 hover:bg-[#0CCE6B]/25 text-[#0CCE6B] border border-[#0CCE6B]/30 rounded"
            data-testid={`button-install-${ext.extensionId}`}
          >
            <Download className="w-2.5 h-2.5 mr-1" />
            Install
          </Button>
        )}
      </div>
    </div>
  );
}
