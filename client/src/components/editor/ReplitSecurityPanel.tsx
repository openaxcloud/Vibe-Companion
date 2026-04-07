import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { createSecurityWebSocket, type ResilientWebSocket, type ConnectionState } from '@/lib/websocket-resilience';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldCheck,
  ShieldAlert,
  Settings, 
  Loader2, 
  X,
  ChevronDown,
  ChevronUp,
  Package,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SecurityScan, Vulnerability, SecurityScanSettings } from '@shared/schema';

interface ReplitSecurityPanelProps {
  projectId: string;
  className?: string;
}

interface WebSocketMessage {
  type: 'initial' | 'scan_update' | 'vulnerability_update' | 'error';
  scans?: SecurityScan[];
  vulnerabilities?: Vulnerability[];
  scan?: SecurityScan;
  vulnerability?: Vulnerability;
  message?: string;
}

function VulnerabilitySkeleton() {
  return (
    <div className="bg-card rounded-lg border border-border p-3" data-testid="vulnerability-skeleton">
      <div className="flex items-center gap-2">
        <div className="relative overflow-hidden w-20 h-5 bg-muted rounded">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent" />
        </div>
        <div className="relative overflow-hidden flex-1 h-4 bg-muted rounded">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent" />
        </div>
      </div>
    </div>
  );
}

export function ReplitSecurityPanel({ projectId, className }: ReplitSecurityPanelProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'hidden'>('active');
  const [showSettings, setShowSettings] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [realtimeScans, setRealtimeScans] = useState<SecurityScan[]>([]);
  const [wsConnectionState, setWsConnectionState] = useState<ConnectionState>('disconnected');
  const wsRef = useRef<ResilientWebSocket | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<SecurityScanSettings>({
    queryKey: ['/api/workspace/projects', projectId, 'security-settings'],
    enabled: !!projectId,
  });

  const { data: initialScans } = useQuery<SecurityScan[]>({
    queryKey: ['/api/workspace/projects', projectId, 'security-scans'],
    enabled: !!projectId,
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 10s to 30s
    refetchIntervalInBackground: false,
  });

  const { data: activeVulnerabilities, isLoading: isLoadingActive } = useQuery<Vulnerability[]>({
    queryKey: ['/api/workspace/projects', projectId, 'vulnerabilities', 'by-hidden', 'active'],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/projects/${projectId}/vulnerabilities/by-hidden?hidden=false`);
      if (!res.ok) throw new Error('Failed to fetch vulnerabilities');
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: hiddenVulnerabilities, isLoading: isLoadingHidden } = useQuery<Vulnerability[]>({
    queryKey: ['/api/workspace/projects', projectId, 'vulnerabilities', 'by-hidden', 'hidden'],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/projects/${projectId}/vulnerabilities/by-hidden?hidden=true`);
      if (!res.ok) throw new Error('Failed to fetch vulnerabilities');
      return res.json();
    },
    enabled: !!projectId,
  });

  const scans = realtimeScans.length > 0 ? realtimeScans : (initialScans || []);
  const currentVulnerabilities = activeTab === 'active' 
    ? (activeVulnerabilities || []) 
    : (hiddenVulnerabilities || []);
  const latestScan = scans?.[0];
  const isScanning = latestScan?.status === 'running' || latestScan?.status === 'queued';
  const totalCount = (activeVulnerabilities?.length || 0) + (hiddenVulnerabilities?.length || 0);

  const startScanMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/workspace/projects/${projectId}/security-scans`, {
        scanType: 'full',
        status: 'queued',
        scanner: 'semgrep',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspace/projects', projectId, 'security-scans'] });
      toast({ title: 'Security scan started', description: 'Scanning for vulnerabilities...' });
    },
    onError: (error: any) => {
      toast({ title: 'Scan failed', description: error.message || 'Failed to start security scan', variant: 'destructive' });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<SecurityScanSettings>) => {
      return apiRequest('PATCH', `/api/workspace/projects/${projectId}/security-settings`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspace/projects', projectId, 'security-settings'] });
      toast({ description: 'Settings updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update settings', variant: 'destructive' });
    },
  });

  const toggleHideMutation = useMutation({
    mutationFn: async ({ id, isHidden }: { id: string; isHidden: boolean }) => {
      return apiRequest('PATCH', `/api/workspace/vulnerabilities/${id}/hide`, { isHidden });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspace/projects', projectId, 'vulnerabilities', 'by-hidden', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspace/projects', projectId, 'vulnerabilities', 'by-hidden', 'hidden'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update vulnerability', variant: 'destructive' });
    },
  });

  const toggleCardExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatLastScanTime = (scan?: SecurityScan) => {
    if (!scan?.startedAt) return null;
    const date = new Date(scan.startedAt);
    return `Last ran on ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}, ${date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
  };

  useEffect(() => {
    if (!projectId) return;

    const resilientWs = createSecurityWebSocket(projectId);
    wsRef.current = resilientWs;

    const unsubscribeState = resilientWs.onStateChange((event) => {
      setWsConnectionState(event.state);
      
      if (event.state === 'failed' || event.state === 'circuit_open') {
        console.warn(`[SecurityPanel] WebSocket ${event.state}: ${event.error}`);
      }
    });

    const unsubscribeMessage = resilientWs.onMessage((event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        switch (message.type) {
          case 'initial':
            if (message.scans) setRealtimeScans(message.scans);
            break;
          case 'scan_update':
            if (message.scan) {
              setRealtimeScans(prev => {
                const index = prev.findIndex(s => s.id === message.scan!.id);
                if (index >= 0) {
                  const updated = [...prev];
                  updated[index] = message.scan!;
                  return updated;
                }
                return [message.scan!, ...prev];
              });
            }
            break;
          case 'vulnerability_update':
            queryClient.invalidateQueries({ queryKey: ['/api/workspace/projects', projectId, 'vulnerabilities', 'by-hidden', 'active'] });
            queryClient.invalidateQueries({ queryKey: ['/api/workspace/projects', projectId, 'vulnerabilities', 'by-hidden', 'hidden'] });
            break;
          case 'error':
            console.error('[SecurityPanel] WebSocket error:', message.message);
            break;
        }
      } catch (error) {
        console.error('[SecurityPanel] Error parsing WebSocket message:', error);
      }
    });

    resilientWs.connect();

    return () => {
      unsubscribeState();
      unsubscribeMessage();
      resilientWs.destroy();
      wsRef.current = null;
    };
  }, [projectId, queryClient]);

  return (
    <div className={cn('flex flex-col h-full bg-[var(--ecode-surface)]', className)} data-testid="security-panel">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Security</span>
          <Badge className="h-4 px-1 text-[9px] bg-[hsl(142,72%,42%)] text-white rounded" data-testid="beta-badge">
            Beta
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2.5 space-y-2">
          <p className="text-[10px] text-[var(--ecode-text-muted)]">
            Scan for security risks and privacy leaks.{' '}
            <a 
              href="https://docs.replit.com/programming-ide/security-scanner" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[hsl(142,72%,42%)] hover:underline"
              data-testid="learn-more-link"
            >
              Learn more
            </a>
          </p>

          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => !isScanning && startScanMutation.mutate(undefined)}
              disabled={isScanning || startScanMutation.isPending}
              className={cn(
                "h-8 font-medium rounded-lg",
                isScanning || startScanMutation.isPending
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-foreground hover:bg-muted"
              )}
              data-testid="scan-button"
            >
              {isScanning || startScanMutation.isPending ? (
                <>
                  <Loader2 className="w-[18px] h-[18px] mr-2 animate-spin" />
                  Scanning for vulnerabilities
                </>
              ) : (
                <>
                  <ShieldCheck className="w-[18px] h-[18px] mr-2" />
                  Scan for vulnerabilities
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 px-3 border-border text-foreground hover:bg-muted rounded-lg"
              data-testid="scan-settings-button"
            >
              <Settings className="w-[18px] h-[18px] mr-2" />
              Scan settings
            </Button>
          </div>

          <div className={cn("collapsible-content", showSettings && "expanded")}>
            <div>
              <div className="bg-background rounded-lg p-3 space-y-2 border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground text-[15px] leading-[20px]">Scan Settings</h3>
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-full"
                      data-testid="close-settings-button"
                    >
                      <X className="w-[18px] h-[18px] text-muted-foreground" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] leading-[20px] text-foreground">
                        Enable privacy vulnerability detection
                      </span>
                      <Switch
                        checked={settings?.privacyDetectionEnabled ?? true}
                        onCheckedChange={(checked) => 
                          updateSettingsMutation.mutate({ privacyDetectionEnabled: checked })
                        }
                        data-testid="privacy-toggle"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] leading-[20px] text-foreground">
                        Enable security vulnerability detection
                      </span>
                      <Switch
                        checked={settings?.securityDetectionEnabled ?? true}
                        onCheckedChange={(checked) => 
                          updateSettingsMutation.mutate({ securityDetectionEnabled: checked })
                        }
                        data-testid="security-toggle"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          <div className="border-b border-border">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('active')}
                className={cn(
                  'pb-3 text-[15px] leading-[20px] font-medium border-b-2 transition-colors',
                  activeTab === 'active'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                data-testid="active-issues-tab"
              >
                Active Issues
              </button>
              <button
                onClick={() => setActiveTab('hidden')}
                className={cn(
                  'pb-3 text-[15px] leading-[20px] font-medium border-b-2 transition-colors',
                  activeTab === 'hidden'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                data-testid="hidden-issues-tab"
              >
                Hidden Issues
              </button>
            </div>
          </div>

          {activeTab === 'active' && (
            <div className="space-y-1">
              <p className="text-[17px] font-medium leading-tight text-foreground">
                {totalCount} potential vulnerabilities found.
              </p>
              {latestScan && (
                <p className="text-[13px] text-muted-foreground">
                  {formatLastScanTime(latestScan)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {(activeTab === 'active' ? isLoadingActive : isLoadingHidden) ? (
              <div className="space-y-3" data-testid="vulnerabilities-loading">
                <VulnerabilitySkeleton />
                <VulnerabilitySkeleton />
                <VulnerabilitySkeleton />
              </div>
            ) : currentVulnerabilities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="empty-state">
                <ShieldCheck 
                  className="w-12 h-12 mb-3 text-muted-foreground"
                />
                <h3 className="text-[17px] font-medium leading-tight text-foreground mb-1">
                  {activeTab === 'active' ? 'No active issues found' : 'No hidden issues'}
                </h3>
                <p className="text-[15px] leading-[20px] text-muted-foreground">
                  {activeTab === 'active' 
                    ? 'Your project appears to be secure. Run a scan to check again.'
                    : 'Issues you hide will appear here.'}
                </p>
              </div>
            ) : (
              currentVulnerabilities.map((vuln) => (
                <div 
                  key={vuln.id}
                  className="bg-card rounded-lg border border-border overflow-hidden"
                  data-testid={`vulnerability-${vuln.id}`}
                >
                  <button
                    onClick={() => toggleCardExpanded(vuln.id)}
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-muted"
                    data-testid={`expand-vulnerability-${vuln.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge className="bg-destructive/10 text-destructive border-0 uppercase text-[10px] tracking-wide font-medium flex items-center gap-1 shrink-0 rounded">
                        <ShieldAlert className="w-3 h-3" />
                        Security
                      </Badge>
                      <span className="text-[15px] leading-[20px] text-foreground truncate">
                        {vuln.title}
                      </span>
                    </div>
                    {expandedCards.has(vuln.id) ? (
                      <ChevronUp className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                    )}
                  </button>

                  <div className={cn("collapsible-content", expandedCards.has(vuln.id) && "expanded")}>
                    <div>
                      <div className="px-3 pb-3 space-y-2 border-t border-border">
                          <p className="text-[15px] leading-[20px] text-muted-foreground pt-3">
                            {vuln.description}
                          </p>

                          {vuln.packageName && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-[15px] leading-[20px] text-muted-foreground">
                                <Package className="w-[18px] h-[18px]" />
                                <span className="font-mono">{vuln.packageName}@{vuln.vulnerableVersion}</span>
                              </div>
                            </div>
                          )}

                          {vuln.filePath && (
                            <p className="text-[13px] text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                              {vuln.filePath}{vuln.lineNumber ? `:${vuln.lineNumber}` : ''}
                            </p>
                          )}

                          <div className="flex gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHideMutation.mutate({ id: vuln.id, isHidden: !vuln.isHidden });
                              }}
                              className="h-8 px-4 border-border text-muted-foreground hover:bg-muted rounded-lg"
                              data-testid={`toggle-hide-${vuln.id}`}
                            >
                              {vuln.isHidden ? 'Unhide' : 'Hide'}
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                              data-testid={`fix-with-agent-${vuln.id}`}
                            >
                              Fix with Agent
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border pt-3 mt-3 space-y-2">
            <p className="text-[13px] text-muted-foreground">
              Vulnerability scans are enabled by the following Replit partners:
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-foreground" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="text-[13px] text-muted-foreground">
                  Security scans are powered by Semgrep Community Edition.
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-foreground" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="text-[13px] text-muted-foreground">
                  Privacy scans are powered by HoundDog.ai.
                </span>
              </div>
            </div>
            
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Security scanning powered by{' '}
              <a 
                href="https://semgrep.dev" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Semgrep
              </a>
              {' '}and privacy scanning powered by{' '}
              <a 
                href="https://hounddog.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                HoundDog.ai
              </a>
              , both running locally on Replit infrastructure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
