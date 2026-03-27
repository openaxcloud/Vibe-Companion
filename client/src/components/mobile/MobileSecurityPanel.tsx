import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, ShieldCheck, Loader2, ChevronRight, ChevronDown,
  AlertTriangle, AlertCircle, Info, Package, Lock, Bug,
  Fingerprint, Bot, RefreshCw, Filter, Eye, EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileSecurityPanelProps {
  projectId: string;
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
  hidden: boolean;
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
}

const severityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-red-500/15", text: "text-red-400" },
  high: { bg: "bg-orange-500/15", text: "text-orange-400" },
  medium: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  low: { bg: "bg-blue-500/15", text: "text-blue-400" },
  info: { bg: "bg-[var(--ide-surface)]", text: "text-[var(--ide-text-muted)]" },
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

export function MobileSecurityPanel({ projectId }: MobileSecurityPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [showAllSeverities, setShowAllSeverities] = useState(false);

  const scansQuery = useQuery({
    queryKey: [`/api/projects/${projectId}/security/scans`],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/security/scans`).then(r => r.json()),
    refetchInterval: 5000,
  });

  const latestScan = (scansQuery.data?.scans || [])[0] as Scan | undefined;

  const findingsQuery = useQuery({
    queryKey: [`/api/projects/${projectId}/security/scans/${latestScan?.id}/findings`],
    queryFn: () => apiRequest("GET", `/api/projects/${projectId}/security/scans/${latestScan?.id}/findings`).then(r => r.json()),
    enabled: !!latestScan?.id && latestScan?.status === "completed",
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/security/scan`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/security/scans`] });
      toast({ title: "Scan started", description: "Security scan is running..." });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const findings: Finding[] = (findingsQuery.data?.findings || []).filter((f: Finding) => !f.hidden);
  const filteredFindings = showAllSeverities ? findings : findings.filter(f => f.severity === "critical" || f.severity === "high");
  const isScanning = latestScan?.status === "running" || scanMutation.isPending;

  const groupedFindings: Record<string, Finding[]> = {};
  for (const f of filteredFindings) {
    if (!groupedFindings[f.severity]) groupedFindings[f.severity] = [];
    groupedFindings[f.severity].push(f);
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ide-panel)]" data-testid="mobile-security-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#0CCE6B]" />
          <span className="text-[13px] font-semibold text-[var(--ide-text)]">Security Scanner</span>
        </div>
        <Button
          size="sm"
          className="h-8 text-[11px] gap-1.5 bg-[#0CCE6B] hover:bg-[#0BBE5B] text-black"
          onClick={() => scanMutation.mutate()}
          disabled={isScanning}
          data-testid="button-scan-project"
        >
          {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {isScanning ? "Scanning..." : "Scan Project"}
        </Button>
      </div>

      {latestScan && latestScan.status === "completed" && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-bg)]/50 shrink-0">
          {[
            { label: "Critical", count: latestScan.critical, color: "text-red-400" },
            { label: "High", count: latestScan.high, color: "text-orange-400" },
            { label: "Medium", count: latestScan.medium, color: "text-yellow-400" },
            { label: "Low", count: latestScan.low, color: "text-blue-400" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1">
              <span className={`text-[11px] font-bold ${s.color}`}>{s.count}</span>
              <span className="text-[10px] text-[var(--ide-text-muted)]">{s.label}</span>
            </div>
          ))}
          <div className="flex-1" />
          <button
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${showAllSeverities ? "bg-[var(--ide-surface)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
            onClick={() => setShowAllSeverities(!showAllSeverities)}
            data-testid="button-toggle-severities"
          >
            <Filter className="w-3 h-3" />
            {showAllSeverities ? "All" : "Critical+High"}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!latestScan ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
            <Shield className="w-10 h-10 text-[var(--ide-text-muted)]" />
            <p className="text-[12px] text-[var(--ide-text-muted)] text-center">Run a security scan to check your project for vulnerabilities</p>
          </div>
        ) : isScanning ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#0CCE6B]" />
            <p className="text-[12px] text-[var(--ide-text-muted)]">Scanning project files...</p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
            <ShieldCheck className="w-10 h-10 text-[#0CCE6B]" />
            <p className="text-[12px] text-[var(--ide-text)]">No {showAllSeverities ? "" : "critical or high "}vulnerabilities found</p>
          </div>
        ) : (
          <div className="py-1">
            {["critical", "high", "medium", "low", "info"].map(severity => {
              const group = groupedFindings[severity];
              if (!group || group.length === 0) return null;
              const SevIcon = severityIcons[severity] || Info;
              const colors = severityColors[severity] || severityColors.info;
              return (
                <div key={severity} className="mb-1">
                  <div className={`flex items-center gap-1.5 px-4 py-1.5 ${colors.bg}`}>
                    <SevIcon className={`w-3.5 h-3.5 ${colors.text}`} />
                    <span className={`text-[11px] font-semibold uppercase ${colors.text}`}>{severity}</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)]">({group.length})</span>
                  </div>
                  {group.map(finding => {
                    const isExpanded = expandedFinding === finding.id;
                    const CatIcon = categoryIcons[finding.category] || Shield;
                    return (
                      <div key={finding.id} className="border-b border-[var(--ide-border)]/50">
                        <button
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--ide-surface)] transition-colors"
                          onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                          data-testid={`finding-${finding.id}`}
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 shrink-0 text-[var(--ide-text-muted)]" />}
                          <CatIcon className="w-3.5 h-3.5 shrink-0 text-[var(--ide-text-muted)]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium text-[var(--ide-text)] truncate">{finding.title}</div>
                            <div className="text-[10px] text-[var(--ide-text-muted)] truncate">{finding.file}{finding.line ? `:${finding.line}` : ""}</div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-3 ml-5">
                            <p className="text-[11px] text-[var(--ide-text-secondary)] mb-2">{finding.description}</p>
                            {finding.code && (
                              <pre className="text-[10px] font-mono bg-[var(--ide-surface)] p-2 rounded border border-[var(--ide-border)] overflow-x-auto mb-2 text-[var(--ide-text)]">{finding.code}</pre>
                            )}
                            {finding.suggestion && (
                              <div className="text-[10px] text-[#0CCE6B] bg-[#0CCE6B]/5 px-2 py-1.5 rounded border border-[#0CCE6B]/20">
                                <span className="font-medium">Fix: </span>{finding.suggestion}
                              </div>
                            )}
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
