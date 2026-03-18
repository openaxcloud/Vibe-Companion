import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GitBranch, Download, Upload, Loader2, ExternalLink, Lock, Globe, RefreshCw } from "lucide-react";

interface GitHubPanelProps {
  projectId: string;
  projectName: string;
  onImported?: (newProjectId?: string) => void;
  onCloned?: () => void;
}

interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  language: string | null;
  updated_at: string;
  owner: { login: string };
}

export default function GitHubPanel({ projectId, projectName, onImported, onCloned }: GitHubPanelProps) {
  const { toast } = useToast();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [ghUser, setGhUser] = useState<any>(null);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [exportName, setExportName] = useState(projectName.replace(/\s+/g, "-").toLowerCase());
  const [exportPrivate, setExportPrivate] = useState(true);
  const [tab, setTab] = useState<"import" | "export">("export");
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    fetch("/api/github/user", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Failed")))
      .then(d => {
        setConnected(d.connected);
        if (d.user) setGhUser(d.user);
      })
      .catch(() => setConnected(false));
  }, []);

  const loadRepos = () => {
    setLoading(true);
    fetch("/api/github/repos", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Failed")))
      .then(d => { if (Array.isArray(d)) setRepos(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (connected && tab === "import") loadRepos();
  }, [connected, tab]);

  const handleExport = async () => {
    if (!exportName.trim()) return;
    setExporting(true);
    try {
      const res = await apiRequest("POST", "/api/github/export", { projectId, repoName: exportName.trim(), isPrivate: exportPrivate });
      const data = await res.json();
      toast({ title: "Exported to GitHub!", description: data.url });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (repo: GHRepo) => {
    setImporting(repo.full_name);
    try {
      const res = await apiRequest("POST", "/api/github/import", { owner: repo.owner.login, repo: repo.name, visibility: "public" });
      const data = await res.json();
      toast({ title: `Imported ${repo.name}`, description: "Opening project..." });
      onImported?.(data.project?.id);
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(null);
    }
  };

  const handleClone = async (repo: GHRepo) => {
    setCloning(repo.full_name);
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/git/clone`, { owner: repo.owner.login, repo: repo.name });
      const data = await res.json();
      toast({ title: `Cloned ${repo.name}`, description: `${data.filesCloned} files cloned` });
      onCloned?.();
    } catch (err: any) {
      toast({ title: "Clone failed", description: err.message, variant: "destructive" });
    } finally {
      setCloning(null);
    }
  };

  if (connected === null) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-[#676D7E]" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="p-4 text-center">
        <GitBranch className="w-8 h-8 text-[#676D7E] mx-auto mb-3" />
        <p className="text-sm text-[#9DA2B0] mb-2">GitHub is not connected</p>
        <p className="text-xs text-[#676D7E]">Connect your GitHub account to import and export projects</p>
      </div>
    );
  }

  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full" data-testid="github-panel">
      {ghUser && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2B3245] shrink-0">
          <img src={ghUser.avatar_url} className="w-5 h-5 rounded-full" alt="" />
          <span className="text-xs text-[#9DA2B0] truncate">{ghUser.login}</span>
        </div>
      )}

      <div className="flex border-b border-[#2B3245] shrink-0">
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tab === "export" ? "text-[#F5F9FC] border-b-2 border-[#0079F2]" : "text-[#676D7E] hover:text-[#9DA2B0]"}`}
          onClick={() => setTab("export")}
          data-testid="tab-github-export"
        >
          <Upload className="w-3 h-3 inline mr-1" /> Export
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tab === "import" ? "text-[#F5F9FC] border-b-2 border-[#0079F2]" : "text-[#676D7E] hover:text-[#9DA2B0]"}`}
          onClick={() => setTab("import")}
          data-testid="tab-github-import"
        >
          <Download className="w-3 h-3 inline mr-1" /> Import
        </button>
      </div>

      {tab === "export" ? (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] text-[#9DA2B0]">Repository name</label>
            <Input
              value={exportName}
              onChange={e => setExportName(e.target.value)}
              className="bg-[#0E1525] border-[#2B3245] h-8 text-xs text-[#F5F9FC]"
              data-testid="input-export-name"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${exportPrivate ? "bg-[#7C65CB]/20 text-[#7C65CB] border border-[#7C65CB]/30" : "bg-[#2B3245] text-[#676D7E] border border-transparent"}`}
              onClick={() => setExportPrivate(true)}
              data-testid="button-private"
            >
              <Lock className="w-3 h-3" /> Private
            </button>
            <button
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${!exportPrivate ? "bg-[#0CCE6B]/20 text-[#0CCE6B] border border-[#0CCE6B]/30" : "bg-[#2B3245] text-[#676D7E] border border-transparent"}`}
              onClick={() => setExportPrivate(false)}
              data-testid="button-public"
            >
              <Globe className="w-3 h-3" /> Public
            </button>
          </div>
          <Button
            className="w-full h-8 bg-[#0079F2] hover:bg-[#006AD8] text-white text-xs"
            onClick={handleExport}
            disabled={exporting || !exportName.trim()}
            data-testid="button-export-github"
          >
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Push to GitHub"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 flex items-center gap-1 shrink-0">
            <Input
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filter repos..."
              className="bg-[#0E1525] border-[#2B3245] h-7 text-[11px] text-[#F5F9FC] flex-1"
              data-testid="input-filter-repos"
            />
            <Button variant="ghost" size="icon" className="w-7 h-7 text-[#676D7E]" onClick={loadRepos}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {loading && repos.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-[#676D7E]" /></div>
            ) : filteredRepos.length === 0 ? (
              <p className="text-xs text-[#676D7E] text-center py-4">No repos found</p>
            ) : (
              filteredRepos.map(repo => (
                <div key={repo.id} className="flex items-center gap-2 p-2 rounded hover:bg-[#2B3245]/50 group" data-testid={`repo-${repo.name}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#F5F9FC] truncate font-medium">{repo.name}</span>
                      {repo.private && <Lock className="w-2.5 h-2.5 text-[#676D7E] shrink-0" />}
                    </div>
                    {repo.description && <p className="text-[10px] text-[#676D7E] truncate">{repo.description}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      {repo.language && <span className="text-[9px] text-[#9DA2B0]">{repo.language}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 text-[#0CCE6B] hover:bg-[#0CCE6B]/10"
                      onClick={() => handleClone(repo)}
                      disabled={cloning === repo.full_name}
                      title="Clone into this project"
                      data-testid={`button-clone-${repo.name}`}
                    >
                      {cloning === repo.full_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 text-[#0079F2] hover:bg-[#0079F2]/10"
                      onClick={() => handleImport(repo)}
                      disabled={importing === repo.full_name}
                      title="Import as new project"
                      data-testid={`button-import-${repo.name}`}
                    >
                      {importing === repo.full_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    </Button>
                    <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC]">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
