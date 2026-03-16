import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCsrfToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Package, Plus, RefreshCw, X, Terminal, ChevronDown, ChevronRight } from "lucide-react";

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

interface PackagesPanelProps {
  projectId: string;
  onClose: () => void;
}

export default function PackagesPanel({ projectId, onClose }: PackagesPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPackageName, setNewPackageName] = useState("");
  const [installLog, setInstallLog] = useState<string | null>(null);
  const [logExpanded, setLogExpanded] = useState(true);

  const packagesQuery = useQuery<{ packages: { name: string; version: string; dev?: boolean }[]; packageManager: string; language: string }>({
    queryKey: ["/api/projects", projectId, "packages"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/packages`, { credentials: "include" });
      if (!res.ok) return { packages: [], packageManager: "none", language: "javascript" };
      return res.json();
    },
  });

  const addPackageMutation = useMutation({
    mutationFn: async ({ name, dev }: { name: string; dev?: boolean }) => {
      return packageRequest("POST", `/api/projects/${projectId}/packages/add`, { name, dev });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      setInstallLog(data.output || null);
      toast({ title: "Package installed", description: data.command || undefined });
      setNewPackageName("");
    },
    onError: (err: any) => {
      setInstallLog(err.output || err.message);
      toast({ title: "Installation failed", description: err.message, variant: "destructive" });
    },
  });

  const removePackageMutation = useMutation({
    mutationFn: async (name: string) => {
      return packageRequest("POST", `/api/projects/${projectId}/packages/remove`, { name });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      setInstallLog(data.output || null);
      toast({ title: "Package removed", description: data.command || undefined });
    },
    onError: (err: any) => {
      setInstallLog(err.output || err.message);
      toast({ title: "Removal failed", description: err.message, variant: "destructive" });
    },
  });

  const isWorking = addPackageMutation.isPending || removePackageMutation.isPending;

  return (
    <div className="flex flex-col h-full" data-testid="packages-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[#0CCE6B]" /> Packages
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => packagesQuery.refetch()} data-testid="button-refresh-packages">
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-packages">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-3 py-2 border-b border-[var(--ide-border)]">
        <form onSubmit={(e) => { e.preventDefault(); if (newPackageName.trim()) addPackageMutation.mutate({ name: newPackageName.trim() }); }} className="flex gap-1.5">
          <Input
            value={newPackageName}
            onChange={(e) => setNewPackageName(e.target.value)}
            placeholder="Add package..."
            className="flex-1 h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded-md placeholder:text-[var(--ide-text-muted)]"
            disabled={isWorking}
            data-testid="input-add-package"
          />
          <Button type="submit" size="sm" disabled={!newPackageName.trim() || isWorking}
            className="h-7 px-2 bg-[#0CCE6B] hover:bg-[#0CCE6B]/80 text-black text-[10px] rounded-md" data-testid="button-add-package">
            {addPackageMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          </Button>
        </form>
        {packagesQuery.data && (
          <div className="mt-1.5 text-[9px] text-[var(--ide-text-muted)]">
            {packagesQuery.data.packageManager === "npm" ? "npm" : packagesQuery.data.packageManager === "pip" ? "pip" : "No package manager detected"} · {packagesQuery.data.packages.length} packages
          </div>
        )}
      </div>

      {isWorking && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/50">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0CCE6B]" />
            <span className="text-[10px] text-[var(--ide-text-secondary)]">
              {addPackageMutation.isPending ? "Installing..." : "Removing..."}
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
            <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider">Output</span>
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
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">Add a package above to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--ide-border)]/50">
            {packagesQuery.data!.packages.map((pkg, i) => (
              <div key={`${pkg.name}-${i}`} className="flex items-center justify-between px-3 py-2 hover:bg-[var(--ide-surface)]/30 group" data-testid={`package-item-${pkg.name}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--ide-text)] font-medium truncate">{pkg.name}</span>
                    {pkg.dev && <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--ide-surface)] text-[var(--ide-text-secondary)]">dev</span>}
                  </div>
                  <span className="text-[10px] text-[var(--ide-text-muted)]">{pkg.version}</span>
                </div>
                <Button variant="ghost" size="icon"
                  className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePackageMutation.mutate(pkg.name)}
                  disabled={isWorking}
                  data-testid={`button-remove-package-${pkg.name}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
