import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Network, Loader2, Plus, Trash2, X, Globe, Lock, Unlock, Copy, Check,
  ExternalLink, ChevronDown, ChevronRight, Wifi, AlertTriangle, Circle,
  ArrowRightLeft, Search,
} from "lucide-react";

interface PortConfig {
  id: string;
  projectId: string;
  port: number;
  internalPort: number;
  externalPort: number;
  label: string;
  protocol: string;
  isPublic: boolean;
  exposeLocalhost: boolean;
  createdAt: string;
  listening: boolean;
  localhostOnly: boolean;
  proxyUrl: string | null;
  externalUrl: string;
}

interface CustomDomain {
  id: string;
  domain: string;
  projectId: string;
  verified: boolean;
  verificationToken: string;
  sslStatus: string;
  createdAt: string;
  verifiedAt: string | null;
}

interface ProjectData {
  id: string;
  devUrlPublic: boolean;
}

export default function NetworkingPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [portsOpen, setPortsOpen] = useState(true);
  const [domainsOpen, setDomainsOpen] = useState(true);
  const [addPortMode, setAddPortMode] = useState(false);
  const [addDomainMode, setAddDomainMode] = useState(false);
  const [newPort, setNewPort] = useState("");
  const [newPortLabel, setNewPortLabel] = useState("");
  const [newPortProtocol, setNewPortProtocol] = useState("http");
  const [newDomain, setNewDomain] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const portsQuery = useQuery<PortConfig[]>({
    queryKey: ["/api/projects", projectId, "networking", "ports"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/networking/ports`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load ports");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const domainsQuery = useQuery<CustomDomain[]>({
    queryKey: ["/api/projects", projectId, "networking", "domains"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/networking/domains`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load domains");
      return res.json();
    },
  });

  const projectQuery = useQuery<ProjectData>({
    queryKey: ["/api/projects", projectId, "dev-url-settings"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load project");
      return res.json();
    },
  });

  const toggleDevUrlMutation = useMutation({
    mutationFn: async (devUrlPublic: boolean) => {
      await apiRequest("PATCH", `/api/projects/${projectId}`, { devUrlPublic });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "dev-url-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      toast({ title: "Development URL privacy updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const createPortMutation = useMutation({
    mutationFn: async (data: { port: number; label: string; protocol: string }) => {
      await apiRequest("POST", `/api/projects/${projectId}/networking/ports`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "ports"] });
      setAddPortMode(false);
      setNewPort("");
      setNewPortLabel("");
      toast({ title: "Port configured" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add port", description: err.message, variant: "destructive" });
    },
  });

  const togglePortMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      await apiRequest("PATCH", `/api/projects/${projectId}/networking/ports/${id}`, { isPublic });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "ports"] });
    },
  });

  const toggleExposeMutation = useMutation({
    mutationFn: async ({ id, exposeLocalhost }: { id: string; exposeLocalhost: boolean }) => {
      await apiRequest("PATCH", `/api/projects/${projectId}/networking/ports/${id}`, { exposeLocalhost });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "ports"] });
    },
  });

  const deletePortMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/networking/ports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "ports"] });
      toast({ title: "Port removed" });
    },
  });

  const scanPortsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${projectId}/networking/ports/scan`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "ports"] });
      toast({ title: "Port scan complete" });
    },
    onError: () => {
      toast({ title: "Port scan failed", variant: "destructive" });
    },
  });

  const addDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/networking/domains`, { domain });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "domains"] });
      setAddDomainMode(false);
      setNewDomain("");
      toast({ title: "Domain added - verify ownership with the DNS token" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add domain", description: err.message, variant: "destructive" });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/networking/domains/${id}/verify`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "domains"] });
      if (data.verified) {
        toast({ title: "Domain verified!" });
      } else {
        toast({ title: "Verification pending", description: data.message || "DNS token not found. Check your DNS configuration.", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/networking/domains/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "domains"] });
      toast({ title: "Domain removed" });
    },
  });

  const ports = portsQuery.data || [];
  const domains = domainsQuery.data || [];

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  function getSslBadge(status: string) {
    if (status === "self-signed") {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 flex items-center gap-0.5">
          <AlertTriangle className="w-2.5 h-2.5" /> Self-Signed
        </span>
      );
    }
    if (status === "active") {
      return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">SSL Active</span>;
    }
    if (status === "provisioning") {
      return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Provisioning</span>;
    }
    if (status === "failed") {
      return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">Failed</span>;
    }
    return <span className="text-[9px] text-[var(--ide-text-muted)]">SSL: {status}</span>;
  }

  return (
    <div className="flex flex-col h-full" data-testid="networking-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Networking</span>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-networking">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 border-b border-[var(--ide-border)]">
          <div className="flex items-center gap-2 py-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {projectQuery.data?.devUrlPublic ? <Globe className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-[var(--ide-text)] block">Private development URL</span>
                <span className="text-[9px] text-[var(--ide-text-muted)]">
                  {projectQuery.data?.devUrlPublic ? "Dev URL is publicly accessible" : "Dev URL requires authentication"}
                </span>
              </div>
            </div>
            <Switch
              checked={!projectQuery.data?.devUrlPublic}
              onCheckedChange={(checked) => toggleDevUrlMutation.mutate(!checked)}
              className="scale-75 shrink-0"
              data-testid="toggle-dev-url-private"
            />
          </div>
          <div className="mt-1 mb-1">
            <code className="text-[9px] font-mono bg-[var(--ide-bg)] px-2 py-1 rounded text-blue-400 block truncate" data-testid="text-dev-url">
              {projectId}.dev.e-code.ai
            </code>
          </div>
        </div>

        <div className="px-3 py-2">
          <button className="flex items-center gap-1.5 w-full text-left py-1.5" onClick={() => setPortsOpen(!portsOpen)} data-testid="toggle-ports">
            {portsOpen ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
            <Wifi className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase">Ports ({ports.length})</span>
            <div className="flex items-center gap-0.5 ml-auto">
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={(e) => { e.stopPropagation(); scanPortsMutation.mutate(); }} title="Auto-detect ports" data-testid="button-scan-ports">
                {scanPortsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              </Button>
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={(e) => { e.stopPropagation(); setAddPortMode(true); setPortsOpen(true); }} data-testid="button-add-port">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </button>

          {portsOpen && (
            <div className="space-y-1.5 mt-1">
              {addPortMode && (
                <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
                  <div className="flex gap-1.5">
                    <Input type="number" placeholder="Internal Port" value={newPort} onChange={(e) => setNewPort(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)] w-24" data-testid="input-port-number" />
                    <Input placeholder="Label" value={newPortLabel} onChange={(e) => setNewPortLabel(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)] flex-1" data-testid="input-port-label" />
                  </div>
                  <select value={newPortProtocol} onChange={(e) => setNewPortProtocol(e.target.value)} className="w-full h-7 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)]" data-testid="select-port-protocol">
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="ws">WebSocket</option>
                    <option value="tcp">TCP</option>
                  </select>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => createPortMutation.mutate({ port: parseInt(newPort) || 0, label: newPortLabel, protocol: newPortProtocol })} disabled={!newPort || createPortMutation.isPending} data-testid="button-save-port">
                      {createPortMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add Port"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setAddPortMode(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {portsQuery.isLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" /></div>
              ) : ports.length === 0 && !addPortMode ? (
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-3">No ports configured</p>
              ) : (
                ports.map((p) => (
                  <div key={p.id} className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid={`port-${p.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--ide-bg)] text-[10px] font-mono font-bold text-blue-400">{p.internalPort}</div>
                        <ArrowRightLeft className="w-2.5 h-2.5 text-[var(--ide-text-muted)] shrink-0" />
                        <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--ide-bg)] text-[10px] font-mono font-bold text-green-400">{p.externalPort === 80 ? "80" : p.externalPort}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-[var(--ide-text)] block truncate">{p.label || `Port ${p.internalPort}`}</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)] flex items-center gap-1">
                          {p.protocol.toUpperCase()}
                          {p.isPublic ? <Unlock className="w-2.5 h-2.5 text-green-400" /> : <Lock className="w-2.5 h-2.5" />}
                          {p.isPublic ? "Public" : "Private"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1" data-testid={`port-status-${p.id}`}>
                        <Circle className={`w-2 h-2 ${p.listening ? "fill-green-400 text-green-400" : "fill-red-400 text-red-400"}`} />
                        <span className={`text-[9px] ${p.listening ? "text-green-400" : "text-red-400"}`}>
                          {p.listening ? (p.localhostOnly ? "Localhost" : "Listening") : "Inactive"}
                        </span>
                      </div>
                      <Switch checked={p.isPublic} onCheckedChange={(checked) => togglePortMutation.mutate({ id: p.id, isPublic: checked })} className="scale-75" data-testid={`toggle-port-${p.id}`} />
                      <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-red-400" onClick={() => deletePortMutation.mutate(p.id)} data-testid={`delete-port-${p.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[9px] text-[var(--ide-text-muted)]">
                        <span>Expose localhost:</span>
                        <Switch checked={p.exposeLocalhost} onCheckedChange={(checked) => toggleExposeMutation.mutate({ id: p.id, exposeLocalhost: checked })} className="scale-[0.6]" data-testid={`toggle-expose-${p.id}`} />
                      </div>
                      <span className="text-[9px] font-mono text-[var(--ide-text-muted)]">
                        :{p.internalPort} → :{p.externalPort}
                      </span>
                    </div>
                    {p.externalUrl && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <Globe className="w-2.5 h-2.5 text-green-400 shrink-0" />
                        <code className="text-[9px] font-mono bg-[var(--ide-bg)] px-2 py-0.5 rounded text-green-400 flex-1 truncate" data-testid={`external-url-${p.id}`}>
                          {p.externalUrl}
                        </code>
                        <Button
                          variant="ghost" size="icon" className="w-4 h-4"
                          onClick={() => { navigator.clipboard.writeText(p.externalUrl); toast({ title: "External URL copied" }); }}
                          data-testid={`copy-external-url-${p.id}`}
                        >
                          <Copy className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
                        </Button>
                      </div>
                    )}
                    {p.proxyUrl && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <code className="text-[9px] font-mono bg-[var(--ide-bg)] px-2 py-0.5 rounded text-blue-400 flex-1 truncate" data-testid={`proxy-url-${p.id}`}>
                          {window.location.origin}{p.proxyUrl}
                        </code>
                        <Button
                          variant="ghost" size="icon" className="w-4 h-4"
                          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${p.proxyUrl}`); toast({ title: "URL copied" }); }}
                          data-testid={`copy-proxy-url-${p.id}`}
                        >
                          <Copy className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
                        </Button>
                        <a href={p.proxyUrl} target="_blank" rel="noreferrer" className="shrink-0" data-testid={`open-proxy-${p.id}`}>
                          <ExternalLink className="w-3 h-3 text-blue-400" />
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t border-[var(--ide-border)]">
          <button className="flex items-center gap-1.5 w-full text-left py-1.5" onClick={() => setDomainsOpen(!domainsOpen)} data-testid="toggle-domains">
            {domainsOpen ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
            <Globe className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase">Custom Domains ({domains.length})</span>
            <Button variant="ghost" size="icon" className="w-5 h-5 ml-auto text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={(e) => { e.stopPropagation(); setAddDomainMode(true); setDomainsOpen(true); }} data-testid="button-add-domain">
              <Plus className="w-3 h-3" />
            </Button>
          </button>

          {domainsOpen && (
            <div className="space-y-1.5 mt-1">
              {addDomainMode && (
                <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2">
                  <Input placeholder="example.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)]" data-testid="input-domain" />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => addDomainMutation.mutate(newDomain)} disabled={!newDomain.trim() || addDomainMutation.isPending} data-testid="button-save-domain">
                      {addDomainMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add Domain"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setAddDomainMode(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {domainsQuery.isLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" /></div>
              ) : domains.length === 0 && !addDomainMode ? (
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-3">No custom domains</p>
              ) : (
                domains.map((d) => (
                  <div key={d.id} className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid={`domain-${d.id}`}>
                    <div className="flex items-center gap-2">
                      <Globe className={`w-3.5 h-3.5 shrink-0 ${d.verified ? "text-green-400" : "text-yellow-400"}`} />
                      <span className="text-[11px] font-medium text-[var(--ide-text)] flex-1 truncate">{d.domain}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${d.verified ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                        {d.verified ? "Verified" : "Pending"}
                      </span>
                      <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-red-400" onClick={() => deleteDomainMutation.mutate(d.id)} data-testid={`delete-domain-${d.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {!d.verified && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-[9px] text-[var(--ide-text-muted)]">Add a TXT record with this token to verify:</p>
                        <div className="flex items-center gap-1">
                          <code className="text-[9px] font-mono bg-[var(--ide-bg)] px-2 py-1 rounded text-[var(--ide-text)] flex-1 truncate">{d.verificationToken}</code>
                          <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => copyToken(d.verificationToken, d.id)} data-testid={`copy-token-${d.id}`}>
                            {copiedToken === d.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-[var(--ide-text-muted)]" />}
                          </Button>
                        </div>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] w-full" onClick={() => verifyDomainMutation.mutate(d.id)} disabled={verifyDomainMutation.isPending} data-testid={`verify-domain-${d.id}`}>
                          {verifyDomainMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify Now"}
                        </Button>
                      </div>
                    )}
                    {d.verified && (
                      <div className="mt-1.5">
                        <div className="flex items-center gap-1.5">
                          {getSslBadge(d.sslStatus)}
                          <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="text-[9px] text-blue-400 hover:underline flex items-center gap-0.5 ml-auto">
                            Visit <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        {d.sslStatus === "self-signed" && (
                          <p className="text-[8px] text-yellow-400/70 mt-1" data-testid={`ssl-note-${d.id}`}>
                            Development certificate only. Production SSL requires external infrastructure (Let's Encrypt).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
