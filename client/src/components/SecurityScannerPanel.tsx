import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, X, ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Info, Clock, ShieldCheck, FileCode2, Eye, EyeOff, Bot, RefreshCw, ArrowUpCircle, Filter, Package, Lock, Bug, Fingerprint } from "lucide-react";

interface SecurityScannerPanelProps {
  projectId: string;
  onClose: () => void;
}

interface Finding {
  id: string;
  severity: string;
  title: string;
  description: string;
  file: string;
  line: number | null;
  code: string | null;
  suggestion: string | null;
  category: string;
  isDirect: boolean | null;
  hidden: boolean;
  hiddenAt: string | null;
  agentSessionId: string | null;
}

interface Scan {
  id: string;
  status: string;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  createdAt: string;
  finishedAt: string | null;
}

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  high: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
  medium: { bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30" },
  low: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
  info: { bg: "bg-[var(--ide-surface)]", text: "text-[var(--ide-text-muted)]", border: "border-[var(--ide-border)]" },
};

const severityIcons: Record<string, typeof AlertTriangle> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: Info,
  info: Info,
};

const categoryIcons: Record<string, typeof Shield> = {
  sast: Lock,
  dependency: Package,
  malicious: Bug,
  privacy: Fingerprint,
};

const categoryLabels: Record<string, string> = {
  sast: "SAST",
  dependency: "Dependency",
  malicious: "Malicious",
  privacy: "Privacy",
};

export default function SecurityScannerPanel({ projectId, onClose }: SecurityScannerPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "hidden">("active");
  const [showAllSeverities, setShowAllSeverities] = useState(false);
  const [showRescanBanner, setShowRescanBanner] = useState(false);

  const scansQuery = useQuery<Scan[]>({
    queryKey: ["/api/projects", projectId, "security/scans"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/security/scans`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (scansQuery.data?.length && !selectedScanId) {
      setSelectedScanId(scansQuery.data[0].id);
    }
  }, [scansQuery.data, selectedScanId]);

  const activeFindingsQuery = useQuery<Finding[]>({
    queryKey: ["/api/projects", projectId, "security/scans", selectedScanId, "findings", "active"],
    queryFn: async () => {
      if (!selectedScanId) return [];
      const res = await fetch(`/api/projects/${projectId}/security/scans/${selectedScanId}/findings?hidden=false`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedScanId,
  });

  const hiddenFindingsQuery = useQuery<Finding[]>({
    queryKey: ["/api/projects", projectId, "security/scans", selectedScanId, "findings", "hidden"],
    queryFn: async () => {
      if (!selectedScanId) return [];
      const res = await fetch(`/api/projects/${projectId}/security/scans/${selectedScanId}/findings?hidden=true`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedScanId && activeTab === "hidden",
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/security/scan`);
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedScanId(data.id);
      setShowHistory(false);
      setShowRescanBanner(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "security/scans"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "security/scans", data.id, "findings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "security/scans"] });
      }, 500);
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const hideMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await apiRequest("PATCH", `/api/security/findings/${findingId}/hide`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "security/scans", selectedScanId, "findings"] });
      toast({ title: "Finding hidden", description: "Moved to hidden tab." });
    },
  });

  const unhideMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await apiRequest("PATCH", `/api/security/findings/${findingId}/unhide`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "security/scans", selectedScanId, "findings"] });
      toast({ title: "Finding restored", description: "Moved to active tab." });
    },
  });

  const fixWithAgentMutation = useMutation({
    mutationFn: async (finding: Finding) => {
      const sessionId = crypto.randomUUID();
      await apiRequest("PATCH", `/api/security/findings/${finding.id}/agent-session`, { agentSessionId: sessionId });
      return { finding, sessionId };
    },
    onSuccess: ({ finding, sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "security/scans", selectedScanId, "findings"] });
      const message = `Fix security vulnerability:\n\n**${finding.title}** (${finding.severity})\n\nFile: ${finding.file}${finding.line ? `:${finding.line}` : ""}\n\n${finding.description}\n\n${finding.code ? `Code:\n\`\`\`\n${finding.code}\n\`\`\`\n` : ""}${finding.suggestion ? `Suggestion: ${finding.suggestion}` : ""}`;
      const event = new CustomEvent("open-ai-panel", { detail: { message, sessionId } });
      window.dispatchEvent(event);
      setShowRescanBanner(true);
      toast({ title: "Fix with Agent", description: "Opened AI agent with vulnerability details." });
    },
  });

  const autoUpdateMutation = useMutation({
    mutationFn: async ({ packageName, targetVersion }: { packageName: string; targetVersion: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/security/auto-update`, { packageName, targetVersion });
      return res.json();
    },
    onSuccess: (data) => {
      setShowRescanBanner(true);
      toast({ title: "Dependency updated", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  function extractPackageInfo(finding: Finding): { packageName: string; targetVersion: string } | null {
    const match = finding.title.match(/:\s*([^@]+)@/);
    const versionMatch = finding.code?.match(/fix:\s*>=\s*([\d.]+)/);
    if (match && versionMatch) {
      return { packageName: match[1].trim(), targetVersion: versionMatch[1] };
    }
    return null;
  }

  const latestScan = scansQuery.data?.[0];
  const activeScan = selectedScanId
    ? scansQuery.data?.find(s => s.id === selectedScanId) || latestScan
    : latestScan;

  const currentFindings = activeTab === "active" ? (activeFindingsQuery.data || []) : (hiddenFindingsQuery.data || []);

  const filteredFindings = showAllSeverities
    ? currentFindings
    : currentFindings.filter(f => f.severity === "critical" || f.severity === "high");

  const groupedFindings: Record<string, Finding[]> = {};
  for (const f of filteredFindings) {
    if (!groupedFindings[f.severity]) groupedFindings[f.severity] = [];
    groupedFindings[f.severity].push(f);
  }
  const severityOrder = ["critical", "high", "medium", "low", "info"];

  const hiddenCount = activeTab === "active" ? (hiddenFindingsQuery.data?.length ?? 0) : 0;
  const activeCount = activeTab === "hidden" ? (activeFindingsQuery.data?.length ?? 0) : 0;

  return (
    <div className="flex flex-col h-full" data-testid="security-scanner-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#E54D4D]" /> Security & Privacy Scanner
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            onClick={() => setShowHistory(!showHistory)}
            data-testid="button-scan-history">
            <Clock className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-security">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-[var(--ide-border)] flex items-center justify-between">
        <Button
          size="sm"
          className="h-7 px-4 text-[11px] bg-[#E54D4D] hover:bg-[#E54D4D]/80 text-white rounded-md font-semibold gap-1.5"
          onClick={() => scanMutation.mutate(undefined)}
          disabled={scanMutation.isPending}
          data-testid="button-run-scan"
        >
          {scanMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
          Scan Project
        </Button>
        {activeScan && activeScan.status === "completed" && (
          <div className="flex items-center gap-2 text-[10px]">
            {activeScan.critical > 0 && <span className="flex items-center gap-0.5 text-red-400" data-testid="badge-critical">{activeScan.critical} critical</span>}
            {activeScan.high > 0 && <span className="flex items-center gap-0.5 text-orange-400" data-testid="badge-high">{activeScan.high} high</span>}
            {activeScan.medium > 0 && <span className="flex items-center gap-0.5 text-yellow-400" data-testid="badge-medium">{activeScan.medium} med</span>}
            {activeScan.low > 0 && <span className="flex items-center gap-0.5 text-blue-400" data-testid="badge-low">{activeScan.low} low</span>}
            {activeScan.totalFindings === 0 && <span className="flex items-center gap-1 text-[#0CCE6B]"><ShieldCheck className="w-3 h-3" /> Clean</span>}
          </div>
        )}
      </div>

      {showRescanBanner && (
        <div className="px-3 py-2 bg-[#0CCE6B]/10 border-b border-[#0CCE6B]/30 flex items-center gap-2" data-testid="rescan-banner">
          <RefreshCw className="w-3.5 h-3.5 text-[#0CCE6B]" />
          <span className="text-[10px] text-[#0CCE6B] flex-1">Changes made. Re-scan to verify fixes.</span>
          <Button
            size="sm"
            className="h-5 px-2 text-[9px] bg-[#0CCE6B] hover:bg-[#0CCE6B]/80 text-black rounded font-semibold"
            onClick={() => { scanMutation.mutate(undefined); setShowRescanBanner(false); }}
            disabled={scanMutation.isPending}
            data-testid="button-rescan"
          >
            Re-scan
          </Button>
        </div>
      )}

      <div className="flex border-b border-[var(--ide-border)] shrink-0">
        <button
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${activeTab === "active" ? "text-[var(--ide-text)] border-b-2 border-[#E54D4D]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
          onClick={() => setActiveTab("active")}
          data-testid="tab-active-issues"
        >
          <Eye className="w-3 h-3 inline mr-1" />
          Active{activeFindingsQuery.data ? ` (${activeFindingsQuery.data.length})` : ""}
        </button>
        <button
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${activeTab === "hidden" ? "text-[var(--ide-text)] border-b-2 border-[#E54D4D]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
          onClick={() => setActiveTab("hidden")}
          data-testid="tab-hidden-issues"
        >
          <EyeOff className="w-3 h-3 inline mr-1" />
          Hidden{hiddenFindingsQuery.data ? ` (${hiddenFindingsQuery.data.length})` : ""}
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--ide-border)] shrink-0">
        <Filter className="w-3 h-3 text-[var(--ide-text-muted)]" />
        <button
          className={`text-[9px] px-1.5 py-0.5 rounded ${showAllSeverities ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)]"}`}
          onClick={() => setShowAllSeverities(!showAllSeverities)}
          data-testid="button-toggle-severity"
        >
          {showAllSeverities ? "All severities" : "Critical & High only"}
        </button>
        {!showAllSeverities && currentFindings.length !== filteredFindings.length && (
          <span className="text-[9px] text-[var(--ide-text-muted)]">
            ({currentFindings.length - filteredFindings.length} hidden by filter)
          </span>
        )}
      </div>

      {showHistory && scansQuery.data && scansQuery.data.length > 0 && (
        <div className="border-b border-[var(--ide-border)] max-h-[150px] overflow-y-auto">
          <div className="px-3 py-1.5">
            <span className="text-[9px] text-[var(--ide-text-muted)] uppercase tracking-wider font-semibold">Scan History</span>
          </div>
          {scansQuery.data.map((scan) => (
            <button
              key={scan.id}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${selectedScanId === scan.id ? "bg-[var(--ide-surface)]" : "hover:bg-[var(--ide-surface)]/40"}`}
              onClick={() => { setSelectedScanId(scan.id); setShowHistory(false); }}
              data-testid={`scan-history-${scan.id}`}
            >
              {scan.totalFindings === 0 ? (
                <ShieldCheck className="w-3 h-3 text-[#0CCE6B] shrink-0" />
              ) : scan.critical > 0 || scan.high > 0 ? (
                <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
              )}
              <span className="text-[10px] text-[var(--ide-text)] flex-1 truncate">
                {new Date(scan.createdAt).toLocaleString()}
              </span>
              <span className="text-[9px] text-[var(--ide-text-muted)]">
                {scan.totalFindings} finding{scan.totalFindings === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {scanMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Loader2 className="w-6 h-6 text-[#E54D4D] animate-spin mb-2" />
            <p className="text-xs text-[var(--ide-text-muted)]">Scanning project files...</p>
            <p className="text-[9px] text-[var(--ide-text-muted)] mt-1 opacity-60">SAST + Privacy + Dependency + Malicious file detection</p>
          </div>
        )}

        {!scanMutation.isPending && !activeScan && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Shield className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
            <p className="text-xs text-[var(--ide-text-muted)]">No scans yet</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-60">
              Click "Scan Project" to check for vulnerabilities, privacy issues, and malicious code
            </p>
          </div>
        )}

        {!scanMutation.isPending && activeScan && activeScan.status === "completed" && filteredFindings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <ShieldCheck className="w-8 h-8 text-[#0CCE6B] mb-2" />
            <p className="text-xs text-[var(--ide-text)]">
              {activeTab === "hidden" ? "No hidden findings" : currentFindings.length === 0 ? "No vulnerabilities found" : "No critical/high findings"}
            </p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">
              {activeTab === "hidden" ? "Hidden findings will appear here." : currentFindings.length === 0 ? "Your code looks clean!" : "Toggle filter to see all severities."}
            </p>
          </div>
        )}

        {!scanMutation.isPending && filteredFindings.length > 0 && (
          <div>
            {severityOrder.map((sev) => {
              const items = groupedFindings[sev];
              if (!items || items.length === 0) return null;
              const colors = severityColors[sev];
              const Icon = severityIcons[sev];
              return (
                <div key={sev}>
                  <div className={`px-3 py-1.5 ${colors.bg} border-y ${colors.border}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${colors.text}`}>
                      {sev} ({items.length})
                    </span>
                  </div>
                  {items.map((finding) => {
                    const CategoryIcon = categoryIcons[finding.category] || Lock;
                    const isNodeDep = finding.category === "dependency" && finding.file?.includes("package");
                    const pkgInfo = isNodeDep ? extractPackageInfo(finding) : null;

                    return (
                      <div key={finding.id}>
                        <button
                          className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[var(--ide-surface)]/40 transition-colors"
                          onClick={() => setExpandedFinding(expandedFinding === finding.id ? null : finding.id)}
                          data-testid={`finding-${finding.id}`}
                        >
                          {expandedFinding === finding.id ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] mt-0.5 shrink-0" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] mt-0.5 shrink-0" />}
                          <Icon className={`w-3.5 h-3.5 ${colors.text} shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-[var(--ide-text)] font-medium">{finding.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <CategoryIcon className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
                              <span className="text-[8px] text-[var(--ide-text-muted)] uppercase font-semibold">{categoryLabels[finding.category] || finding.category}</span>
                              {finding.isDirect !== null && finding.category === "dependency" && (
                                <span className={`text-[8px] px-1 rounded ${finding.isDirect ? "bg-orange-500/15 text-orange-400" : "bg-blue-500/15 text-blue-400"}`}>
                                  {finding.isDirect ? "direct" : "transitive"}
                                </span>
                              )}
                              <span className="text-[1px] text-[var(--ide-text-muted)]">|</span>
                              <FileCode2 className="w-2.5 h-2.5 text-[var(--ide-text-muted)]" />
                              <span className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate">{finding.file}{finding.line ? `:${finding.line}` : ""}</span>
                            </div>
                          </div>
                        </button>
                        {expandedFinding === finding.id && (
                          <div className="px-3 pb-2 pl-9">
                            <p className="text-[10px] text-[var(--ide-text-secondary)] mb-1.5">{finding.description}</p>
                            {finding.code && (
                              <pre className="text-[9px] font-mono text-[var(--ide-text-muted)] bg-[var(--ide-bg)] rounded px-2 py-1.5 mb-1.5 overflow-x-auto" data-testid={`finding-code-${finding.id}`}>{finding.code}</pre>
                            )}
                            {finding.suggestion && (
                              <div className="text-[10px] text-[#0CCE6B] bg-[#0CCE6B]/5 rounded px-2 py-1.5 border border-[#0CCE6B]/20 mb-2" data-testid={`finding-suggestion-${finding.id}`}>
                                <span className="font-semibold">Fix: </span>{finding.suggestion}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {activeTab === "active" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-5 px-2 text-[9px] gap-1 border-[var(--ide-border)]"
                                  onClick={(e) => { e.stopPropagation(); hideMutation.mutate(finding.id); }}
                                  disabled={hideMutation.isPending}
                                  data-testid={`button-hide-${finding.id}`}
                                >
                                  <EyeOff className="w-2.5 h-2.5" /> Hide
                                </Button>
                              )}
                              {activeTab === "hidden" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-5 px-2 text-[9px] gap-1 border-[var(--ide-border)]"
                                  onClick={(e) => { e.stopPropagation(); unhideMutation.mutate(finding.id); }}
                                  disabled={unhideMutation.isPending}
                                  data-testid={`button-unhide-${finding.id}`}
                                >
                                  <Eye className="w-2.5 h-2.5" /> Move to Active
                                </Button>
                              )}
                              {!finding.agentSessionId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-5 px-2 text-[9px] gap-1 border-[#7C65CB]/40 text-[#7C65CB] hover:bg-[#7C65CB]/10"
                                  onClick={(e) => { e.stopPropagation(); fixWithAgentMutation.mutate(finding); }}
                                  disabled={fixWithAgentMutation.isPending}
                                  data-testid={`button-fix-agent-${finding.id}`}
                                >
                                  <Bot className="w-2.5 h-2.5" /> Fix with Agent
                                </Button>
                              )}
                              {finding.agentSessionId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-5 px-2 text-[9px] gap-1 border-[#7C65CB]/40 text-[#7C65CB] hover:bg-[#7C65CB]/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const event = new CustomEvent("open-ai-panel", { detail: { sessionId: finding.agentSessionId } });
                                    window.dispatchEvent(event);
                                  }}
                                  data-testid={`button-view-session-${finding.id}`}
                                >
                                  <Bot className="w-2.5 h-2.5" /> View Agent Session
                                </Button>
                              )}
                              {isNodeDep && pkgInfo && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-5 px-2 text-[9px] gap-1 border-[#0CCE6B]/40 text-[#0CCE6B] hover:bg-[#0CCE6B]/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    autoUpdateMutation.mutate(pkgInfo);
                                  }}
                                  disabled={autoUpdateMutation.isPending}
                                  data-testid={`button-auto-update-${finding.id}`}
                                >
                                  <ArrowUpCircle className="w-2.5 h-2.5" />
                                  {autoUpdateMutation.isPending ? "Updating..." : "Update automatically"}
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
