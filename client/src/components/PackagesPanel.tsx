import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Package, Plus, RefreshCw, X, Terminal, ChevronDown, ChevronRight,
  Search, AlertTriangle, Settings2, Cpu, Box, ExternalLink, Download, ArrowUpCircle
} from "lucide-react";

async function packageRequest(method: string, url: string, data?: unknown) {
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  const token = getCsrfToken();
  if (token) headers["X-CSRF-Token"] = token;
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.message || "Request failed") as any;
    err.output = json.output || null;
    throw err;
  }
  return json;
}

async function sseRequest(
  url: string,
  data: unknown,
  onOutput: (line: string, fullOutput: string) => void,
): Promise<{ success: boolean; output?: string; command?: string; exitCode?: number }> {
  const token = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-CSRF-Token"] = token;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Operation failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream") && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullOutput = "";
    let result: any = { success: false };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        const dataMatch = event.match(/data:\s*(.*)/);
        const eventMatch = event.match(/event:\s*(.*)/);
        if (dataMatch) {
          try {
            const parsed = JSON.parse(dataMatch[1]);
            const eventType = eventMatch?.[1] || "output";
            if (eventType === "output") {
              fullOutput += (fullOutput ? "\n" : "") + parsed.line;
              onOutput(parsed.line, fullOutput);
            } else if (eventType === "done") {
              result = parsed;
            } else if (eventType === "error") {
              throw new Error(parsed.message);
            }
          } catch (e: any) {
            if (e.message && e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }
    }
    return result;
  }

  return response.json();
}

interface PackagesPanelProps {
  projectId: string;
  onClose: () => void;
  onOpenFile?: (filename: string) => void;
}

type ActiveTab = "imports" | "system";

interface SearchResult {
  name: string;
  description: string;
  version: string;
  versions?: string[];
  downloads: number;
}

interface NixSearchResult {
  name: string;
  pname: string;
  version: string;
  description: string;
}

function NixDepsSection({ newDepName, setNewDepName, addSystemDepMutation, removeSystemDepMutation, systemDepsQuery, projectId }: {
  newDepName: string;
  setNewDepName: (v: string) => void;
  addSystemDepMutation: any;
  removeSystemDepMutation: any;
  systemDepsQuery: any;
  projectId: string;
}) {
  const [nixSearchQuery, setNixSearchQuery] = useState("");
  const [showNixSearch, setShowNixSearch] = useState(false);

  const nixSearchResults = useQuery<{ results: NixSearchResult[] }>({
    queryKey: ["/api/nix/search", nixSearchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/nix/search?q=${encodeURIComponent(nixSearchQuery)}`, { credentials: "include" });
      if (!res.ok) return { results: [] };
      return res.json();
    },
    enabled: nixSearchQuery.length >= 2 && showNixSearch,
    staleTime: 60000,
  });

  return (
    <>
      <div className="px-3 py-2 border-b border-[var(--ide-border)] mt-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Box className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">System Dependencies</span>
        </div>
        <p className="text-[9px] text-[var(--ide-text-muted)] mb-2">Nix packages installed in the workspace environment</p>
        <div className="relative mb-1.5">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ide-text-muted)]" />
          <Input
            value={nixSearchQuery}
            onChange={(e) => { setNixSearchQuery(e.target.value); if (e.target.value.length >= 2) setShowNixSearch(true); else setShowNixSearch(false); }}
            onFocus={() => nixSearchQuery.length >= 2 && setShowNixSearch(true)}
            placeholder="Search Nix packages..."
            className="flex-1 h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded-md placeholder:text-[var(--ide-text-muted)] pl-7"
            data-testid="input-search-nix"
          />
        </div>
        {showNixSearch && nixSearchQuery.length >= 2 && (
          <div className="border border-[var(--ide-border)] rounded-md max-h-36 overflow-y-auto bg-[var(--ide-bg)] mb-1.5">
            {nixSearchResults.isLoading ? (
              <div className="flex items-center justify-center py-3"><Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-muted)]" /></div>
            ) : (nixSearchResults.data?.results?.length || 0) === 0 ? (
              <div className="px-3 py-2 text-[10px] text-[var(--ide-text-muted)] text-center">No Nix packages found</div>
            ) : (
              nixSearchResults.data!.results.map((r) => (
                <div key={r.name} className="px-3 py-1.5 hover:bg-[var(--ide-surface)]/50 border-b border-[var(--ide-border)]/30 last:border-b-0 flex items-start justify-between gap-1.5" data-testid={`nix-result-${r.name}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-[var(--ide-text)] font-medium truncate">{r.name}</div>
                    {r.description && <p className="text-[9px] text-[var(--ide-text-muted)] line-clamp-1">{r.description}</p>}
                    {r.version && <span className="text-[8px] text-[var(--ide-text-muted)]">v{r.version}</span>}
                  </div>
                  <Button size="sm" className="h-5 px-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-[9px] rounded shrink-0"
                    onClick={() => { addSystemDepMutation.mutate(r.name); setShowNixSearch(false); setNixSearchQuery(""); }}
                    data-testid={`button-add-nix-${r.name}`}
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
        <form onSubmit={(e) => {
          e.preventDefault();
          if (newDepName.trim()) addSystemDepMutation.mutate(newDepName.trim());
        }} className="flex gap-1.5">
          <Input
            value={newDepName}
            onChange={(e) => setNewDepName(e.target.value)}
            placeholder="Or add manually: ffmpeg, imagemagick"
            className="flex-1 h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded-md placeholder:text-[var(--ide-text-muted)]"
            data-testid="input-add-dep"
          />
          <Button type="submit" size="sm" disabled={!newDepName.trim() || addSystemDepMutation.isPending}
            className="h-7 px-2 bg-purple-500 hover:bg-purple-500/80 text-white text-[10px] rounded-md" data-testid="button-add-dep">
            {addSystemDepMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          </Button>
        </form>
      </div>

      {systemDepsQuery.isLoading ? (
        <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" /></div>
      ) : (systemDepsQuery.data?.deps?.length || 0) === 0 ? (
        <div className="px-3 py-3 text-center">
          <Box className="w-6 h-6 text-[#2B3245] mx-auto mb-1" />
          <p className="text-[10px] text-[var(--ide-text-muted)]">No system dependencies configured</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--ide-border)]/50">
          {systemDepsQuery.data!.deps.map((dep: any) => (
            <div key={dep.id} className="flex items-center justify-between px-3 py-2 hover:bg-[var(--ide-surface)]/30 group" data-testid={`dep-item-${dep.name}`}>
              <div className="flex items-center gap-1.5">
                <Box className="w-3 h-3 text-purple-400" />
                <span className="text-[11px] text-[var(--ide-text)] font-medium">{dep.name}</span>
              </div>
              <Button variant="ghost" size="icon"
                className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeSystemDepMutation.mutate(dep.id)}
                data-testid={`button-remove-dep-${dep.name}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function PackagesPanel({ projectId, onClose, onOpenFile }: PackagesPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("imports");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRegistry, setSearchRegistry] = useState<"npm" | "pypi">("npm");
  const [installLog, setInstallLog] = useState<string | null>(null);
  const [logExpanded, setLogExpanded] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>({});
  const [versionExpanded, setVersionExpanded] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<Record<string, string[]>>({});

  const [newModuleName, setNewModuleName] = useState("");
  const [newDepName, setNewDepName] = useState("");

  const packagesQuery = useQuery<{
    packages: { name: string; version: string; dev?: boolean }[];
    packageManager: string;
    managers: string[];
    groups: Record<string, { packages: { name: string; version: string; dev?: boolean }[]; manager: string; language: string }>;
    language: string;
  }>({
    queryKey: ["/api/projects", projectId, "packages"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/packages`, { credentials: "include" });
      if (!res.ok) return { packages: [], packageManager: "none", managers: [], groups: {}, language: "javascript" };
      return res.json();
    },
  });

  useEffect(() => {
    if (packagesQuery.data) {
      const pm = packagesQuery.data.packageManager;
      if (pm === "pip" || pm === "poetry") setSearchRegistry("pypi");
      else setSearchRegistry("npm");
    }
  }, [packagesQuery.data?.packageManager]);

  const searchResultsQuery = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/packages/search", searchQuery, searchRegistry],
    queryFn: async () => {
      const res = await fetch(
        `/api/packages/search?q=${encodeURIComponent(searchQuery)}&registry=${searchRegistry}`,
        { credentials: "include" }
      );
      if (!res.ok) return { results: [] };
      return res.json();
    },
    enabled: searchQuery.length >= 2 && showSearch,
    staleTime: 30000,
  });

  const missingImportsQuery = useQuery<{
    missing: { name: string; suggestedPackage: string }[];
    packageManager: string;
  }>({
    queryKey: ["/api/projects", projectId, "imports", "missing"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/imports/missing`, { credentials: "include" });
      if (!res.ok) return { missing: [], packageManager: "none" };
      return res.json();
    },
    staleTime: 60000,
  });

  const systemModulesQuery = useQuery<{ modules: { id: string; name: string; version: string | null }[] }>({
    queryKey: ["/api/projects", projectId, "system-modules"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/system-modules`, { credentials: "include" });
      if (!res.ok) return { modules: [] };
      return res.json();
    },
  });

  const systemDepsQuery = useQuery<{ deps: { id: string; name: string }[] }>({
    queryKey: ["/api/projects", projectId, "system-deps"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/system-deps`, { credentials: "include" });
      if (!res.ok) return { deps: [] };
      return res.json();
    },
  });

  const registryToManager = (reg: "npm" | "pypi"): "npm" | "pip" | "poetry" => {
    if (reg === "npm") return "npm";
    const pm = packagesQuery.data?.packageManager;
    if (pm === "poetry") return "poetry";
    return "pip";
  };

  const invalidatePackageQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "packages"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "imports", "missing"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "packages", "outdated"] });
  };

  const addPackageMutation = useMutation({
    mutationFn: async ({ name, dev, version, manager }: { name: string; dev?: boolean; version?: string; manager?: string }) => {
      const mgr = manager || registryToManager(searchRegistry);
      return sseRequest(
        `/api/projects/${projectId}/packages/install-stream`,
        { name, dev, version, manager: mgr },
        (_line, fullOutput) => setInstallLog(fullOutput),
      );
    },
    onSuccess: (data: any) => {
      invalidatePackageQueries();
      if (data.output) setInstallLog(data.output);
      toast({ title: data.success ? "Package installed" : "Installation failed", description: data.command || undefined, variant: data.success ? "default" : "destructive" });
      setSearchQuery("");
      setShowSearch(false);
    },
    onError: (err: any) => {
      setInstallLog(err.output || err.message);
      toast({ title: "Installation failed", description: err.message, variant: "destructive" });
    },
  });

  const removePackageMutation = useMutation({
    mutationFn: async ({ name, manager }: { name: string; manager?: string }) => {
      return sseRequest(
        `/api/projects/${projectId}/packages/remove-stream`,
        { name, manager },
        (_line, fullOutput) => setInstallLog(fullOutput),
      );
    },
    onSuccess: (data: any) => {
      invalidatePackageQueries();
      if (data.output) setInstallLog(data.output);
      toast({ title: data.success ? "Package removed" : "Removal failed", description: data.command || undefined, variant: data.success ? "default" : "destructive" });
    },
    onError: (err: any) => {
      setInstallLog(err.output || err.message);
      toast({ title: "Removal failed", description: err.message, variant: "destructive" });
    },
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ name, manager }: { name?: string; manager?: string }) => {
      return sseRequest(
        `/api/projects/${projectId}/packages/update-stream`,
        { name, manager },
        (_line, fullOutput) => setInstallLog(fullOutput),
      );
    },
    onSuccess: (data: any) => {
      invalidatePackageQueries();
      if (data.output) setInstallLog(data.output);
      toast({ title: data.success ? "Package updated" : "Update failed", description: data.command || undefined, variant: data.success ? "default" : "destructive" });
    },
    onError: (err: any) => {
      setInstallLog(err.output || err.message);
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const addSystemModuleMutation = useMutation({
    mutationFn: async ({ name, version }: { name: string; version?: string }) => {
      return packageRequest("POST", `/api/projects/${projectId}/system-modules`, { name, version });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "system-modules"] });
      setNewModuleName("");
      toast({ title: "Module added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add module", description: err.message, variant: "destructive" });
    },
  });

  const removeSystemModuleMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      return packageRequest("DELETE", `/api/projects/${projectId}/system-modules/${moduleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "system-modules"] });
      toast({ title: "Module removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove module", description: err.message, variant: "destructive" });
    },
  });

  const addSystemDepMutation = useMutation({
    mutationFn: async (name: string) => {
      return packageRequest("POST", `/api/projects/${projectId}/system-deps`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "system-deps"] });
      setNewDepName("");
      toast({ title: "System dependency added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add dependency", description: err.message, variant: "destructive" });
    },
  });

  const removeSystemDepMutation = useMutation({
    mutationFn: async (depId: string) => {
      return packageRequest("DELETE", `/api/projects/${projectId}/system-deps/${depId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "system-deps"] });
      toast({ title: "System dependency removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove dependency", description: err.message, variant: "destructive" });
    },
  });

  const outdatedQuery = useQuery<{
    outdated: { name: string; current: string; latest: string; wanted: string; manager: string }[];
  }>({
    queryKey: ["/api/projects", projectId, "packages", "outdated"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/packages/outdated`, { credentials: "include" });
      if (!res.ok) return { outdated: [] };
      return res.json();
    },
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  const outdatedMap = new Map(
    (outdatedQuery.data?.outdated || []).map(o => [o.name, o])
  );

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      setShowSearch(true);
    } else {
      setShowSearch(false);
    }
  }, []);

  const fetchVersions = useCallback(async (pkgName: string) => {
    if (availableVersions[pkgName]) {
      setVersionExpanded(versionExpanded === pkgName ? null : pkgName);
      return;
    }
    try {
      const res = await fetch(`/api/packages/versions?name=${encodeURIComponent(pkgName)}&registry=${searchRegistry}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAvailableVersions(prev => ({ ...prev, [pkgName]: data.versions || [] }));
      }
    } catch {}
    setVersionExpanded(versionExpanded === pkgName ? null : pkgName);
  }, [searchRegistry, availableVersions, versionExpanded]);

  const isWorking = addPackageMutation.isPending || removePackageMutation.isPending || updatePackageMutation.isPending;
  const pm = packagesQuery.data?.packageManager || "npm";
  const missingCount = missingImportsQuery.data?.missing?.length || 0;

  const pmLabel = pm === "poetry" ? "poetry" : pm === "pip" ? "pip" : pm === "npm" ? "npm" : "none";
  const packagerFile = pm === "npm" ? "package.json" : pm === "poetry" ? "pyproject.toml" : pm === "pip" ? "requirements.txt" : null;

  return (
    <div className="flex flex-col h-full" data-testid="packages-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[#0CCE6B]" /> Dependencies
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => {
            packagesQuery.refetch();
            missingImportsQuery.refetch();
            systemModulesQuery.refetch();
            systemDepsQuery.refetch();
            outdatedQuery.refetch();
          }} data-testid="button-refresh-packages">
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-packages">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex border-b border-[var(--ide-border)] shrink-0">
        <button
          className={`flex-1 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${activeTab === "imports" ? "text-[#0CCE6B] border-b-2 border-[#0CCE6B] bg-[var(--ide-surface)]/30" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
          onClick={() => setActiveTab("imports")}
          data-testid="tab-imports"
        >
          <div className="flex items-center justify-center gap-1">
            <Package className="w-3 h-3" />
            Imports
            {missingCount > 0 && (
              <span className="ml-1 px-1 py-0.5 text-[8px] rounded-full bg-amber-500/20 text-amber-400">{missingCount}</span>
            )}
          </div>
        </button>
        <button
          className={`flex-1 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${activeTab === "system" ? "text-[#0CCE6B] border-b-2 border-[#0CCE6B] bg-[var(--ide-surface)]/30" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
          onClick={() => setActiveTab("system")}
          data-testid="tab-system"
        >
          <div className="flex items-center justify-center gap-1">
            <Settings2 className="w-3 h-3" />
            System
          </div>
        </button>
      </div>

      {activeTab === "imports" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--ide-border)] space-y-1.5">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ide-text-muted)]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
                  placeholder="Search packages..."
                  className="flex-1 h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded-md placeholder:text-[var(--ide-text-muted)] pl-7"
                  disabled={isWorking}
                  data-testid="input-search-package"
                />
              </div>
              <select
                value={searchRegistry}
                onChange={(e) => setSearchRegistry(e.target.value as "npm" | "pypi")}
                className="h-7 text-[10px] bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md px-1.5"
                data-testid="select-language-dropdown"
              >
                <option value="npm">npm</option>
                <option value="pypi">pip / PyPI</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-[var(--ide-surface)] text-[var(--ide-text-secondary)]">{pmLabel}</span>
                <span>· {packagesQuery.data?.packages.length || 0} packages</span>
                {(outdatedQuery.data?.outdated?.length || 0) > 0 && (
                  <button
                    className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[8px] hover:bg-amber-500/25 transition-colors cursor-pointer flex items-center gap-0.5"
                    onClick={() => updatePackageMutation.mutate({})}
                    disabled={isWorking}
                    data-testid="button-update-all"
                  >
                    <ArrowUpCircle className="w-2.5 h-2.5" />
                    {outdatedQuery.data!.outdated.length} outdated
                  </button>
                )}
              </div>
              {packagerFile && (
                <button
                  className="text-[9px] text-[#0079F2] hover:underline flex items-center gap-0.5 cursor-pointer"
                  onClick={() => onOpenFile?.(packagerFile)}
                  data-testid="link-packager-file"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {packagerFile}
                </button>
              )}
            </div>
          </div>

          {showSearch && searchQuery.length >= 2 && (
            <div className="border-b border-[var(--ide-border)] max-h-48 overflow-y-auto bg-[var(--ide-bg)]">
              {searchResultsQuery.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
                </div>
              ) : (searchResultsQuery.data?.results?.length || 0) === 0 ? (
                <div className="px-3 py-3 text-[10px] text-[var(--ide-text-muted)] text-center">No packages found</div>
              ) : (
                searchResultsQuery.data!.results.map((result) => (
                  <div key={result.name} className="px-3 py-2 hover:bg-[var(--ide-surface)]/50 border-b border-[var(--ide-border)]/30 last:border-b-0" data-testid={`search-result-${result.name}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-[var(--ide-text)] truncate">{result.name}</span>
                          <button
                            className="text-[9px] text-[var(--ide-text-muted)] hover:text-[#0CCE6B] cursor-pointer"
                            onClick={() => fetchVersions(result.name)}
                            data-testid={`button-version-picker-${result.name}`}
                          >
                            v{selectedVersion[result.name] || result.version || "latest"}
                            <ChevronDown className="w-2 h-2 inline ml-0.5" />
                          </button>
                        </div>
                        {result.description && (
                          <p className="text-[9px] text-[var(--ide-text-muted)] mt-0.5 line-clamp-1">{result.description}</p>
                        )}
                        {result.downloads > 0 && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <Download className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
                            <span className="text-[8px] text-[var(--ide-text-muted)]">{result.downloads > 1000 ? `${(result.downloads / 1000).toFixed(0)}k` : result.downloads}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="h-6 px-2 bg-[#0CCE6B] hover:bg-[#0CCE6B]/80 text-black text-[9px] rounded shrink-0"
                        disabled={isWorking}
                        onClick={() => addPackageMutation.mutate({
                          name: result.name,
                          version: selectedVersion[result.name] || undefined,
                        })}
                        data-testid={`button-install-${result.name}`}
                      >
                        {addPackageMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      </Button>
                    </div>
                    {versionExpanded === result.name && availableVersions[result.name] && (
                      <div className="mt-1.5 flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {availableVersions[result.name].map((v) => (
                          <button
                            key={v}
                            className={`px-1.5 py-0.5 text-[8px] rounded border transition-colors ${selectedVersion[result.name] === v ? "border-[#0CCE6B] text-[#0CCE6B] bg-[#0CCE6B]/10" : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:border-[var(--ide-text-secondary)]"}`}
                            onClick={() => {
                              setSelectedVersion(prev => ({ ...prev, [result.name]: v }));
                              setVersionExpanded(null);
                            }}
                            data-testid={`version-option-${result.name}-${v}`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              <button
                className="w-full px-3 py-1.5 text-[9px] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]/30 text-center"
                onClick={() => setShowSearch(false)}
                data-testid="button-close-search"
              >
                Close search
              </button>
            </div>
          )}

          {missingCount > 0 && (
            <div className="border-b border-[var(--ide-border)] bg-amber-500/5">
              <div className="px-3 py-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-[10px] text-amber-400 font-medium">
                  {missingCount} missing {missingCount === 1 ? "import" : "imports"} detected
                </span>
              </div>
              <div className="px-3 pb-2 space-y-1">
                {missingImportsQuery.data!.missing.slice(0, 5).map((imp) => (
                  <div key={imp.name} className="flex items-center justify-between gap-2" data-testid={`missing-import-${imp.name}`}>
                    <span className="text-[10px] text-[var(--ide-text)] font-mono truncate">{imp.suggestedPackage}</span>
                    <Button
                      size="sm"
                      className="h-5 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[9px] rounded shrink-0"
                      disabled={isWorking}
                      onClick={() => addPackageMutation.mutate({ name: imp.suggestedPackage })}
                      data-testid={`button-install-missing-${imp.name}`}
                    >
                      Install
                    </Button>
                  </div>
                ))}
                {missingCount > 5 && (
                  <span className="text-[9px] text-[var(--ide-text-muted)]">...and {missingCount - 5} more</span>
                )}
              </div>
            </div>
          )}

          {isWorking && (
            <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/50">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0CCE6B]" />
                <span className="text-[10px] text-[var(--ide-text-secondary)]">
                  {addPackageMutation.isPending ? "Installing..." : updatePackageMutation.isPending ? "Updating..." : "Removing..."}
                </span>
              </div>
            </div>
          )}

          {installLog && (
            <div className="border-b border-[var(--ide-border)]">
              <button
                className="flex items-center gap-1.5 w-full text-left px-3 py-1.5 hover:bg-[var(--ide-surface)]/30"
                onClick={() => setLogExpanded(!logExpanded)}
                data-testid="toggle-install-log"
              >
                {logExpanded ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                <Terminal className="w-3 h-3 text-[var(--ide-text-muted)]" />
                <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider">Console Output</span>
                <Button
                  variant="ghost" size="icon"
                  className="w-4 h-4 ml-auto text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
                  onClick={(e) => { e.stopPropagation(); setInstallLog(null); }}
                  data-testid="button-clear-log"
                >
                  <X className="w-2.5 h-2.5" />
                </Button>
              </button>
              {logExpanded && (
                <pre className="px-3 py-2 text-[9px] font-mono text-[var(--ide-text-muted)] bg-[var(--ide-bg)] max-h-32 overflow-y-auto whitespace-pre-wrap break-all" data-testid="text-install-output">
                  {installLog}
                </pre>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {packagesQuery.isLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" /></div>
            ) : (packagesQuery.data?.packages.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="w-8 h-8 text-[#2B3245] mb-2" />
                <p className="text-xs text-[var(--ide-text-muted)]">No packages found</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">Search above to add packages</p>
              </div>
            ) : (() => {
              const groups = packagesQuery.data!.groups || {};
              const langEntries = Object.entries(groups);
              const hasMultipleLanguages = langEntries.length > 1;
              const renderPkg = (pkg: { name: string; version: string; dev?: boolean }, mgr: string, i: number) => {
                const outdatedInfo = outdatedMap.get(pkg.name);
                return (
                <div key={`${mgr}-${pkg.name}-${i}`} className="flex items-center justify-between px-3 py-2 hover:bg-[var(--ide-surface)]/30 group" data-testid={`package-item-${pkg.name}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[var(--ide-text)] font-medium truncate">{pkg.name}</span>
                      {pkg.dev && <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--ide-surface)] text-[var(--ide-text-secondary)]">dev</span>}
                      {outdatedInfo && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400" title={`Latest: ${outdatedInfo.latest}`}>
                          ↑ {outdatedInfo.latest}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--ide-text-muted)]">{pkg.version}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {outdatedInfo && (
                      <Button variant="ghost" size="icon"
                        className="w-5 h-5 text-amber-400 hover:text-amber-300"
                        onClick={() => updatePackageMutation.mutate({ name: pkg.name, manager: mgr })}
                        disabled={isWorking}
                        title={`Update to ${outdatedInfo.latest}`}
                        data-testid={`button-update-package-${pkg.name}`}
                      >
                        <ArrowUpCircle className="w-3 h-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon"
                      className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-red-400"
                      onClick={() => removePackageMutation.mutate({ name: pkg.name, manager: mgr })}
                      disabled={isWorking}
                      data-testid={`button-remove-package-${pkg.name}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
              };
              const langLabels: Record<string, string> = { javascript: "JavaScript (npm)", python: "Python" };
              return (
                <div>
                  {langEntries.length === 0 ? (
                    <div className="divide-y divide-[var(--ide-border)]/50">
                      {packagesQuery.data!.packages.map((pkg, i) => renderPkg(pkg, pm, i))}
                    </div>
                  ) : (
                    langEntries.map(([lang, group]) => {
                      const prodPkgs = group.packages.filter(p => !p.dev);
                      const devPkgs = group.packages.filter(p => p.dev);
                      return (
                        <div key={lang}>
                          {hasMultipleLanguages && (
                            <div className="px-3 py-1.5 bg-[#0CCE6B]/5 border-b border-[var(--ide-border)]/50">
                              <span className="text-[9px] font-bold text-[#0CCE6B] uppercase tracking-wider">{langLabels[lang] || lang} ({group.packages.length})</span>
                            </div>
                          )}
                          {devPkgs.length > 0 && prodPkgs.length > 0 ? (
                            <>
                              <div className="px-3 py-1 bg-[var(--ide-surface)]/20 border-b border-[var(--ide-border)]/30">
                                <span className="text-[8px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider">Dependencies ({prodPkgs.length})</span>
                              </div>
                              <div className="divide-y divide-[var(--ide-border)]/50">
                                {prodPkgs.map((pkg, i) => renderPkg(pkg, group.manager, i))}
                              </div>
                              <div className="px-3 py-1 bg-[var(--ide-surface)]/20 border-y border-[var(--ide-border)]/30">
                                <span className="text-[8px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider">Dev Dependencies ({devPkgs.length})</span>
                              </div>
                              <div className="divide-y divide-[var(--ide-border)]/50">
                                {devPkgs.map((pkg, i) => renderPkg(pkg, group.manager, i))}
                              </div>
                            </>
                          ) : (
                            <div className="divide-y divide-[var(--ide-border)]/50">
                              {group.packages.map((pkg, i) => renderPkg(pkg, group.manager, i))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === "system" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 border-b border-[var(--ide-border)]">
            <div className="flex items-center gap-1.5 mb-2">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">System Modules</span>
            </div>
            <p className="text-[9px] text-[var(--ide-text-muted)] mb-2">Language runtimes and modules for the workspace</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newModuleName.trim()) {
                const parts = newModuleName.trim().split("-");
                const version = parts.length > 1 && /^\d/.test(parts[parts.length - 1]) ? parts.pop() : undefined;
                const name = parts.join("-");
                addSystemModuleMutation.mutate({ name, version });
              }
            }} className="flex gap-1.5">
              <Input
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                placeholder="e.g. nodejs-20, python-3.11"
                className="flex-1 h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded-md placeholder:text-[var(--ide-text-muted)]"
                data-testid="input-add-module"
              />
              <Button type="submit" size="sm" disabled={!newModuleName.trim() || addSystemModuleMutation.isPending}
                className="h-7 px-2 bg-blue-500 hover:bg-blue-500/80 text-white text-[10px] rounded-md" data-testid="button-add-module">
                {addSystemModuleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </Button>
            </form>
          </div>

          {systemModulesQuery.isLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 text-[var(--ide-text-muted)] animate-spin" /></div>
          ) : (systemModulesQuery.data?.modules?.length || 0) === 0 ? (
            <div className="px-3 py-3 text-center">
              <Cpu className="w-6 h-6 text-[#2B3245] mx-auto mb-1" />
              <p className="text-[10px] text-[var(--ide-text-muted)]">No system modules configured</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--ide-border)]/50 border-b border-[var(--ide-border)]">
              {systemModulesQuery.data!.modules.map((mod) => (
                <div key={mod.id} className="flex items-center justify-between px-3 py-2 hover:bg-[var(--ide-surface)]/30 group" data-testid={`module-item-${mod.name}`}>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 text-blue-400" />
                    <span className="text-[11px] text-[var(--ide-text)] font-medium">{mod.name}</span>
                    {mod.version && <span className="text-[9px] text-[var(--ide-text-muted)]">v{mod.version}</span>}
                  </div>
                  <Button variant="ghost" size="icon"
                    className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeSystemModuleMutation.mutate(mod.id)}
                    data-testid={`button-remove-module-${mod.name}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <NixDepsSection
            newDepName={newDepName}
            setNewDepName={setNewDepName}
            addSystemDepMutation={addSystemDepMutation}
            removeSystemDepMutation={removeSystemDepMutation}
            systemDepsQuery={systemDepsQuery}
            projectId={projectId}
          />
        </div>
      )}
    </div>
  );
}
