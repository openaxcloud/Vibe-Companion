import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Loader2, Globe, ShieldCheck, RefreshCw, Plus, Trash2, Pencil,
  ChevronDown, ChevronRight, Check, X, DollarSign, Clock, Shield,
  Settings, AlertTriangle,
} from "lucide-react";

interface DomainSearchResult {
  domain: string;
  tld: string;
  available: boolean;
  registrationPrice: number;
  renewalPrice: number;
  premium?: boolean;
}

interface PurchasedDomain {
  id: string;
  domain: string;
  tld: string;
  userId: string;
  projectId: string | null;
  purchasePrice: number;
  renewalPrice: number;
  status: string;
  autoRenew: boolean;
  whoisPrivacy: boolean;
  expiresAt: string;
  createdAt: string;
}

interface UnifiedDomain {
  domain: string;
  source: "purchased" | "connected";
  status: string;
  verified: boolean;
  sslStatus: string;
  purchasedDomainId: string | null;
  customDomainId: string | null;
  autoRenew: boolean | null;
  whoisPrivacy: boolean | null;
  expiresAt: string | null;
  renewalPrice: number | null;
}

interface DnsRecord {
  id: string;
  domainId: string;
  recordType: string;
  name: string;
  value: string;
  ttl: number;
  createdAt: string;
}

interface DomainWithRecords extends PurchasedDomain {
  dnsRecords: DnsRecord[];
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function DomainPurchasePanel({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DomainSearchResult[]>([]);
  const [purchasedOpen, setPurchasedOpen] = useState(true);
  const [managingDomainId, setManagingDomainId] = useState<string | null>(null);
  const [addDnsMode, setAddDnsMode] = useState(false);
  const [newRecordType, setNewRecordType] = useState("A");
  const [newRecordName, setNewRecordName] = useState("");
  const [newRecordValue, setNewRecordValue] = useState("");
  const [newRecordTtl, setNewRecordTtl] = useState("3600");
  const [confirmPurchase, setConfirmPurchase] = useState<DomainSearchResult | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editRecordType, setEditRecordType] = useState("");
  const [editRecordName, setEditRecordName] = useState("");
  const [editRecordValue, setEditRecordValue] = useState("");
  const [editRecordTtl, setEditRecordTtl] = useState("3600");

  const purchasedQuery = useQuery<PurchasedDomain[]>({
    queryKey: ["/api/domains/purchased"],
    queryFn: async () => {
      const res = await fetch("/api/domains/purchased", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const unifiedQuery = useQuery<UnifiedDomain[]>({
    queryKey: ["/api/projects", projectId, "networking", "all-domains"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/networking/all-domains`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!projectId,
  });

  const domainDetailQuery = useQuery<DomainWithRecords>({
    queryKey: ["/api/domains/purchased", managingDomainId],
    queryFn: async () => {
      const res = await fetch(`/api/domains/purchased/${managingDomainId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!managingDomainId,
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch(`/api/domains/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    onSuccess: (data: DomainSearchResult[]) => {
      setSearchResults(data);
    },
    onError: () => {
      toast({ title: "Search failed", variant: "destructive" });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (result: DomainSearchResult) => {
      const res = await apiRequest("POST", "/api/domains/purchase", {
        domain: result.domain,
        tld: result.tld,
        projectId: projectId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains/purchased"] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "domains"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "networking", "all-domains"] });
      }
      setConfirmPurchase(null);
      setSearchResults([]);
      setSearchQuery("");
      toast({ title: "Domain purchased successfully!" });
    },
    onError: (err: any) => {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    },
  });

  const addDnsMutation = useMutation({
    mutationFn: async (data: { domainId: string; recordType: string; name: string; value: string; ttl: number }) => {
      const res = await apiRequest("POST", `/api/domains/purchased/${data.domainId}/dns`, {
        recordType: data.recordType,
        name: data.name,
        value: data.value,
        ttl: data.ttl,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains/purchased", managingDomainId] });
      setAddDnsMode(false);
      setNewRecordName("");
      setNewRecordValue("");
      setNewRecordTtl("3600");
      toast({ title: "DNS record added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add record", description: err.message, variant: "destructive" });
    },
  });

  const deleteDnsMutation = useMutation({
    mutationFn: async ({ domainId, recordId }: { domainId: string; recordId: string }) => {
      await apiRequest("DELETE", `/api/domains/purchased/${domainId}/dns/${recordId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains/purchased", managingDomainId] });
      toast({ title: "DNS record removed" });
    },
  });

  const updateDnsMutation = useMutation({
    mutationFn: async (data: { domainId: string; recordId: string; recordType: string; name: string; value: string; ttl: number }) => {
      const res = await apiRequest("PUT", `/api/domains/purchased/${data.domainId}/dns/${data.recordId}`, {
        recordType: data.recordType,
        name: data.name,
        value: data.value,
        ttl: data.ttl,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains/purchased", managingDomainId] });
      setEditingRecordId(null);
      toast({ title: "DNS record updated" });
    },
    onError: () => {
      toast({ title: "Failed to update record", variant: "destructive" });
    },
  });

  const startEditRecord = (record: DnsRecord) => {
    setEditingRecordId(record.id);
    setEditRecordType(record.recordType);
    setEditRecordName(record.name);
    setEditRecordValue(record.value);
    setEditRecordTtl(String(record.ttl));
  };

  const toggleAutoRenewMutation = useMutation({
    mutationFn: async ({ domainId, autoRenew }: { domainId: string; autoRenew: boolean }) => {
      await apiRequest("PATCH", `/api/domains/purchased/${domainId}`, { autoRenew });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains/purchased"] });
      queryClient.invalidateQueries({ queryKey: ["/api/domains/purchased", managingDomainId] });
      toast({ title: "Auto-renewal updated" });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery.trim());
    }
  };

  const purchased = purchasedQuery.data || [];
  const unifiedDomains = unifiedQuery.data || [];
  const detail = domainDetailQuery.data;

  if (managingDomainId && detail) {
    return (
      <div className="flex flex-col h-full" data-testid="domain-management-panel">
        <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setManagingDomainId(null)} className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" data-testid="button-back-domains">
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
            <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Manage Domain</span>
          </div>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-domain-mgmt">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          <div className="bg-[var(--ide-surface)] rounded-lg p-3 border border-[var(--ide-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-green-400" />
              <span className="text-[12px] font-semibold text-[var(--ide-text)]" data-testid="text-managed-domain">{detail.domain}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px]">
              <div className="flex items-center gap-1 text-[var(--ide-text-muted)]">
                <Check className="w-2.5 h-2.5 text-green-400" />
                <span data-testid="text-domain-status">Status: {detail.status}</span>
              </div>
              <div className="flex items-center gap-1 text-[var(--ide-text-muted)]">
                <Clock className="w-2.5 h-2.5" />
                <span data-testid="text-domain-expires">Expires: {formatDate(detail.expiresAt)}</span>
              </div>
              <div className="flex items-center gap-1 text-[var(--ide-text-muted)]">
                <Shield className="w-2.5 h-2.5 text-blue-400" />
                <span data-testid="text-whois-privacy">WHOIS Privacy: {detail.whoisPrivacy ? "On" : "Off"}</span>
              </div>
              <div className="flex items-center gap-1 text-[var(--ide-text-muted)]">
                <RefreshCw className="w-2.5 h-2.5" />
                <span data-testid="text-auto-renew">
                  Auto-Renew:
                  <button
                    className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-medium ${detail.autoRenew ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                    onClick={() => toggleAutoRenewMutation.mutate({ domainId: detail.id, autoRenew: !detail.autoRenew })}
                    data-testid="button-toggle-autorenew"
                  >
                    {detail.autoRenew ? "ON" : "OFF"}
                  </button>
                </span>
              </div>
              <div className="flex items-center gap-1 text-[var(--ide-text-muted)]">
                <DollarSign className="w-2.5 h-2.5" />
                <span>Renewal: {formatPrice(detail.renewalPrice)}/yr</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase">DNS Records</span>
              <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => setAddDnsMode(true)} data-testid="button-add-dns">
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            {addDnsMode && (
              <div className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)] space-y-2 mb-2">
                <div className="flex gap-1.5">
                  <select value={newRecordType} onChange={(e) => setNewRecordType(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] w-20" data-testid="select-record-type">
                    <option value="A">A</option>
                    <option value="TXT">TXT</option>
                    <option value="MX">MX</option>
                    <option value="CNAME">CNAME</option>
                    <option value="AAAA">AAAA</option>
                  </select>
                  <Input placeholder="Name (e.g. @)" value={newRecordName} onChange={(e) => setNewRecordName(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)] flex-1" data-testid="input-record-name" />
                </div>
                <Input placeholder="Value" value={newRecordValue} onChange={(e) => setNewRecordValue(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)]" data-testid="input-record-value" />
                <div className="flex gap-1.5">
                  <Input placeholder="TTL" value={newRecordTtl} onChange={(e) => setNewRecordTtl(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)] w-20" data-testid="input-record-ttl" />
                  <Button size="sm" className="h-7 text-[10px] flex-1" onClick={() => addDnsMutation.mutate({ domainId: detail.id, recordType: newRecordType, name: newRecordName, value: newRecordValue, ttl: parseInt(newRecordTtl) || 3600 })} disabled={!newRecordName.trim() || !newRecordValue.trim() || addDnsMutation.isPending} data-testid="button-save-dns">
                    {addDnsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add Record"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setAddDnsMode(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {detail.dnsRecords.length === 0 && !addDnsMode ? (
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-3">No DNS records configured</p>
              ) : (
                detail.dnsRecords.map((record) => (
                  editingRecordId === record.id ? (
                    <div key={record.id} className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-blue-500/30 space-y-2" data-testid={`dns-edit-${record.id}`}>
                      <div className="flex gap-1.5">
                        <select value={editRecordType} onChange={(e) => setEditRecordType(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] w-20" data-testid={`edit-select-type-${record.id}`}>
                          <option value="A">A</option>
                          <option value="TXT">TXT</option>
                          <option value="MX">MX</option>
                          <option value="CNAME">CNAME</option>
                          <option value="AAAA">AAAA</option>
                        </select>
                        <Input placeholder="Name" value={editRecordName} onChange={(e) => setEditRecordName(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)] flex-1" data-testid={`edit-input-name-${record.id}`} />
                      </div>
                      <Input placeholder="Value" value={editRecordValue} onChange={(e) => setEditRecordValue(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)]" data-testid={`edit-input-value-${record.id}`} />
                      <div className="flex gap-1.5">
                        <Input placeholder="TTL" value={editRecordTtl} onChange={(e) => setEditRecordTtl(e.target.value)} className="h-7 text-xs bg-[var(--ide-bg)] w-20" data-testid={`edit-input-ttl-${record.id}`} />
                        <Button size="sm" className="h-7 text-[10px] flex-1" onClick={() => updateDnsMutation.mutate({ domainId: detail.id, recordId: record.id, recordType: editRecordType, name: editRecordName, value: editRecordValue, ttl: parseInt(editRecordTtl) || 3600 })} disabled={!editRecordName.trim() || !editRecordValue.trim() || updateDnsMutation.isPending} data-testid={`button-save-edit-${record.id}`}>
                          {updateDnsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setEditingRecordId(null)} data-testid={`button-cancel-edit-${record.id}`}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div key={record.id} className="bg-[var(--ide-surface)] rounded-lg p-2 border border-[var(--ide-border)] flex items-center gap-2" data-testid={`dns-record-${record.id}`}>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        record.recordType === "A" ? "bg-blue-500/10 text-blue-400" :
                        record.recordType === "MX" ? "bg-purple-500/10 text-purple-400" :
                        record.recordType === "TXT" ? "bg-yellow-500/10 text-yellow-400" :
                        record.recordType === "CNAME" ? "bg-green-500/10 text-green-400" :
                        "bg-gray-500/10 text-gray-400"
                      }`} data-testid={`dns-type-${record.id}`}>{record.recordType}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-[var(--ide-text)] block truncate font-mono" data-testid={`dns-name-${record.id}`}>{record.name}</span>
                        <span className="text-[9px] text-[var(--ide-text-muted)] block truncate font-mono" data-testid={`dns-value-${record.id}`}>{record.value}</span>
                      </div>
                      <span className="text-[8px] text-[var(--ide-text-muted)]">TTL: {record.ttl}</span>
                      <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-blue-400" onClick={() => startEditRecord(record)} data-testid={`edit-dns-${record.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-red-400" onClick={() => deleteDnsMutation.mutate({ domainId: detail.id, recordId: record.id })} data-testid={`delete-dns-${record.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="domain-purchase-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">Domain Management</span>
        <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-domains">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 border-b border-[var(--ide-border)]">
          <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase mb-1.5 block">Search & Purchase</span>
          <div className="flex gap-1.5">
            <Input
              placeholder="Search for a domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              className="h-7 text-xs bg-[var(--ide-bg)] flex-1"
              data-testid="input-domain-search"
            />
            <Button size="sm" className="h-7 text-[10px] px-3" onClick={handleSearch} disabled={searchMutation.isPending || !searchQuery.trim()} data-testid="button-search-domains">
              {searchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto">
              {searchResults.map((result) => (
                <div key={result.domain} className={`rounded-lg p-2 border ${result.available ? "bg-[var(--ide-surface)] border-[var(--ide-border)]" : "bg-[var(--ide-bg)] border-[var(--ide-border)] opacity-50"}`} data-testid={`search-result-${result.domain}`}>
                  <div className="flex items-center gap-2">
                    <Globe className={`w-3.5 h-3.5 shrink-0 ${result.available ? "text-green-400" : "text-red-400"}`} />
                    <span className="text-[11px] font-medium text-[var(--ide-text)] flex-1 truncate">{result.domain}</span>
                    {result.premium && <span className="text-[8px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400">Premium</span>}
                    {result.available ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-green-400" data-testid={`price-${result.domain}`}>{formatPrice(result.registrationPrice)}/yr</span>
                        <Button size="sm" className="h-6 text-[9px] px-2" onClick={() => setConfirmPurchase(result)} data-testid={`button-purchase-${result.domain}`}>
                          Purchase
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[9px] text-red-400">Unavailable</span>
                    )}
                  </div>
                  {result.available && (
                    <div className="mt-1 flex items-center gap-3 text-[8px] text-[var(--ide-text-muted)]">
                      <span>Renewal: {formatPrice(result.renewalPrice)}/yr</span>
                      <span className="flex items-center gap-0.5"><ShieldCheck className="w-2.5 h-2.5" /> WHOIS Privacy</span>
                      <span className="flex items-center gap-0.5"><RefreshCw className="w-2.5 h-2.5" /> Auto-Renew</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {projectId && (
          <div className="px-3 py-2 border-b border-[var(--ide-border)]">
            <div className="flex items-center gap-1.5 py-1.5">
              <Globe className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase">Project Domains ({unifiedDomains.length})</span>
            </div>
            <div className="space-y-1.5 mt-1">
              {unifiedQuery.isLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" /></div>
              ) : unifiedDomains.length === 0 ? (
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-3">No domains linked to this project</p>
              ) : (
                unifiedDomains.map((ud) => (
                  <div key={ud.domain} className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid={`unified-domain-${ud.domain}`}>
                    <div className="flex items-center gap-2">
                      <Globe className={`w-3.5 h-3.5 shrink-0 ${ud.verified ? "text-green-400" : "text-yellow-400"}`} />
                      <span className="text-[11px] font-medium text-[var(--ide-text)] flex-1 truncate">{ud.domain}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${ud.source === "purchased" ? "bg-blue-500/10 text-blue-400" : "bg-gray-500/10 text-gray-400"}`}>
                        {ud.source === "purchased" ? "Purchased" : "Connected"}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${ud.verified ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`} data-testid={`unified-status-${ud.domain}`}>
                        {ud.verified ? "Verified" : "Pending"}
                      </span>
                      {ud.purchasedDomainId && (
                        <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => { setManagingDomainId(ud.purchasedDomainId!); setAddDnsMode(false); }} data-testid={`manage-unified-${ud.domain}`}>
                          <Settings className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[8px] text-[var(--ide-text-muted)]">
                      <span>SSL: {ud.sslStatus || "pending"}</span>
                      {ud.autoRenew !== null && (
                        <span className="flex items-center gap-0.5"><RefreshCw className="w-2.5 h-2.5" /> Auto-Renew: {ud.autoRenew ? "On" : "Off"}</span>
                      )}
                      {ud.whoisPrivacy !== null && (
                        <span className="flex items-center gap-0.5"><ShieldCheck className="w-2.5 h-2.5" /> WHOIS: {ud.whoisPrivacy ? "On" : "Off"}</span>
                      )}
                      {ud.expiresAt && (
                        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> Expires: {formatDate(ud.expiresAt)}</span>
                      )}
                      {ud.renewalPrice !== null && (
                        <span>{formatPrice(ud.renewalPrice)}/yr</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="px-3 py-2">
          <button className="flex items-center gap-1.5 w-full text-left py-1.5" onClick={() => setPurchasedOpen(!purchasedOpen)} data-testid="toggle-purchased-domains">
            {purchasedOpen ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
            <Globe className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase">All Purchased Domains ({purchased.length})</span>
          </button>

          {purchasedOpen && (
            <div className="space-y-1.5 mt-1">
              {purchasedQuery.isLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" /></div>
              ) : purchased.length === 0 ? (
                <p className="text-[11px] text-[var(--ide-text-muted)] text-center py-3">No purchased domains</p>
              ) : (
                purchased.map((d) => (
                  <div key={d.id} className="bg-[var(--ide-surface)] rounded-lg p-2.5 border border-[var(--ide-border)]" data-testid={`purchased-domain-${d.id}`}>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span className="text-[11px] font-medium text-[var(--ide-text)] flex-1 truncate">{d.domain}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400" data-testid={`status-${d.id}`}>
                        {d.status === "active" ? "Verified" : d.status}
                      </span>
                      <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => { setManagingDomainId(d.id); setAddDnsMode(false); }} data-testid={`manage-domain-${d.id}`}>
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[8px] text-[var(--ide-text-muted)]">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        Expires {formatDate(d.expiresAt)}
                      </span>
                      {d.autoRenew && (
                        <span className="flex items-center gap-0.5 text-green-400">
                          <RefreshCw className="w-2.5 h-2.5" /> Auto-Renew
                        </span>
                      )}
                      {d.whoisPrivacy && (
                        <span className="flex items-center gap-0.5 text-blue-400">
                          <Shield className="w-2.5 h-2.5" /> Privacy
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {confirmPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="purchase-confirmation-dialog">
          <div className="bg-[var(--ide-panel)] rounded-lg p-4 border border-[var(--ide-border)] max-w-sm mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-2">Confirm Domain Purchase</h3>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-[var(--ide-text)]" data-testid="text-confirm-domain">{confirmPurchase.domain}</span>
              </div>
              <div className="text-xs text-[var(--ide-text-muted)] space-y-1">
                <p>Registration: <span className="text-[var(--ide-text)] font-medium">{formatPrice(confirmPurchase.registrationPrice)}</span></p>
                <p>Renewal: <span className="text-[var(--ide-text)] font-medium">{formatPrice(confirmPurchase.renewalPrice)}/yr</span></p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-[var(--ide-text-muted)] pt-1 border-t border-[var(--ide-border)]">
                <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-blue-400" /> WHOIS Privacy included</span>
                <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-green-400" /> Auto-renewal enabled</span>
              </div>
              {projectId && (
                <p className="text-[10px] text-blue-400">Will be automatically configured for this project</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => purchaseMutation.mutate(confirmPurchase)} disabled={purchaseMutation.isPending} data-testid="button-confirm-purchase">
                {purchaseMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Purchase Domain
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmPurchase(null)} data-testid="button-cancel-purchase">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
