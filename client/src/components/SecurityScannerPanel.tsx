import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, X, ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Info, Clock, ShieldCheck, FileCode2 } from "lucide-react";

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

export default function SecurityScannerPanel({ projectId, onClose }: SecurityScannerPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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

  const findingsQuery = useQuery<Finding[]>({
    queryKey: ["/api/projects", projectId, "security/scans", selectedScanId, "findings"],
    queryFn: async () => {
      if (!selectedScanId) return [];
      const res = await fetch(`/api/projects/${projectId}/security/scans/${selectedScanId}/findings`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedScanId,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/security/scan`);
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedScanId(data.id);
      setShowHistory(false);
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

  const latestScan = scansQuery.data?.[0];
  const activeScan = selectedScanId
    ? scansQuery.data?.find(s => s.id === selectedScanId) || latestScan
    : latestScan;

  const findings = findingsQuery.data || [];
  const groupedFindings: Record<string, Finding[]> = {};
  for (const f of findings) {
    if (!groupedFindings[f.severity]) groupedFindings[f.severity] = [];
    groupedFindings[f.severity].push(f);
  }
  const severityOrder = ["critical", "high", "medium", "low", "info"];

  return (
    <div className="flex flex-col h-full" data-testid="security-scanner-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#E54D4D]" /> Security Scanner
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
          onClick={() => scanMutation.mutate()}
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
          </div>
        )}

        {!scanMutation.isPending && !activeScan && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Shield className="w-8 h-8 text-[var(--ide-text-muted)] mb-2 opacity-30" />
            <p className="text-xs text-[var(--ide-text-muted)]">No scans yet</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 opacity-60">
              Click "Scan Project" to check for vulnerabilities
            </p>
          </div>
        )}

        {!scanMutation.isPending && activeScan && activeScan.status === "completed" && findings.length === 0 && activeScan.totalFindings === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <ShieldCheck className="w-8 h-8 text-[#0CCE6B] mb-2" />
            <p className="text-xs text-[var(--ide-text)]">No vulnerabilities found</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">Your code looks clean!</p>
          </div>
        )}

        {!scanMutation.isPending && findings.length > 0 && (
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
                  {items.map((finding) => (
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
                            <div className="text-[10px] text-[#0CCE6B] bg-[#0CCE6B]/5 rounded px-2 py-1.5 border border-[#0CCE6B]/20" data-testid={`finding-suggestion-${finding.id}`}>
                              <span className="font-semibold">Fix: </span>{finding.suggestion}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
