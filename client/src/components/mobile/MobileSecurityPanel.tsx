import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { createSecurityWebSocket, type ResilientWebSocket, type ConnectionState } from '@/lib/websocket-resilience';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface MobileSecurityPanelProps {
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
    <div className="bg-card rounded-lg border border-border p-4" data-testid="vulnerability-skeleton">
      <div className="flex items-center gap-2">
        <div className="relative overflow-hidden w-20 h-5 bg-muted rounded skeleton-shimmer" />
        <div className="relative overflow-hidden flex-1 h-4 bg-muted rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

export function MobileSecurityPanel({ projectId, className }: MobileSecurityPanelProps) {
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
  });

  const { data: initialScans, isLoading: scansLoading } = useQuery<SecurityScan[]>({
    queryKey: ['/api/workspace/projects', projectId, 'security-scans'],
    refetchInterval: 30000, // RATE LIMIT FIX: Increased from 10s to 30s
    refetchIntervalInBackground: false,
  });

  const scans = realtimeScans.length > 0 ? realtimeScans : (initialScans || []);

  const { data: activeVulnerabilities, isLoading: activeLoading } = useQuery<Vulnerability[]>({
    queryKey: ['/api/workspace/projects', projectId, 'vulnerabilities', 'by-hidden', 'active'],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/projects/${projectId}/vulnerabilities/by-hidden?hidden=false`);
      if (!res.ok) throw new Error('Failed to fetch vulnerabilities');
      return res.json();
    },
  });

  const { data: hiddenVulnerabilities, isLoading: hiddenLoading } = useQuery<Vulnerability[]>({
    queryKey: ['/api/workspace/projects', projectId, 'vulnerabilities', 'by-hidden', 'hidden'],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/projects/${projectId}/vulnerabilities/by-hidden?hidden=true`);
      if (!res.ok) throw new Error('Failed to fetch vulnerabilities');
      return res.json();
    },
  });

  const latestScan = scans?.[0];
  const isScanning = latestScan?.status === 'running' || latestScan?.status === 'queued';

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
      toast({
        title: 'Security scan started',
        description: 'Scanning for vulnerabilities...',
      });
    },
    onError: () => {
      toast({
        title: 'Scan failed',
        description: 'Failed to start security scan',
        variant: 'destructive',
      });
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
        console.warn(`[MobileSecurityPanel] WebSocket ${event.state}: ${event.error}`);
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
            console.error('[MobileSecurityPanel] WebSocket error:', message.message);
            break;
        }
      } catch (error) {
        console.error('[MobileSecurityPanel] Error parsing WebSocket message:', error);
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

  const vulnerabilities = activeTab === 'active' ? activeVulnerabilities : hiddenVulnerabilities;
  const isLoading = activeTab === 'active' ? activeLoading : hiddenLoading;
  const totalCount = (activeVulnerabilities?.length || 0) + (hiddenVulnerabilities?.length || 0);
  const hasNoVulnerabilities = !isLoading && (!vulnerabilities || vulnerabilities.length === 0);

  return (
    <div className={cn('flex flex-col h-full bg-background', className)} data-testid="mobile-security-panel">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* Hero Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-medium leading-tight text-foreground">
                Security and Privacy Scanner
              </h1>
              <Badge 
                className="uppercase text-[10px] tracking-wide rounded bg-primary text-primary-foreground font-medium px-2 py-0.5"
                data-testid="beta-badge"
              >
                Beta
              </Badge>
            </div>
            
            <p className="text-[15px] leading-[20px] text-muted-foreground">
              Run a scan to check for potential security risks and privacy leaks in your application. 
              Scans are typically complete within minutes.{' '}
              <a 
                href="https://docs.replit.com/programming-ide/security-scanner" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                data-testid="learn-more-link"
              >
                Learn more
              </a>
            </p>
          </div>

          {/* Action Buttons - Mobile touch targets */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => !isScanning && startScanMutation.mutate(undefined)}
              disabled={isScanning || startScanMutation.isPending}
              className={cn(
                "flex-1 h-11 font-medium rounded-lg text-[15px] leading-[20px]",
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
              onClick={() => setShowSettings(!showSettings)}
              className="w-11 h-11 p-0 border-border text-foreground hover:bg-muted rounded-lg"
              data-testid="scan-settings-button"
            >
              <Settings className="w-[18px] h-[18px]" />
            </Button>
          </div>

          {/* Scan Settings Panel */}
          <div className={`collapsible-panel ${showSettings ? 'expanded' : 'collapsed'}`}>
            <div className="bg-card rounded-lg p-4 space-y-3 border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-medium leading-tight text-foreground">Scan Settings</h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-11 h-11 flex items-center justify-center hover:bg-muted rounded-lg"
                  data-testid="close-settings-button"
                >
                  <X className="w-[18px] h-[18px] text-muted-foreground" />
                </button>
              </div>
              
              <div className="space-y-3">
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

          {/* Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('active')}
                className={cn(
                  'pb-3 text-[15px] leading-[20px] font-medium border-b-2 transition-colors min-h-[44px] flex items-center',
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
                  'pb-3 text-[15px] leading-[20px] font-medium border-b-2 transition-colors min-h-[44px] flex items-center',
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

          {/* Vulnerability Count & Last Scan Time */}
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

          {/* Issues List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3" data-testid="vulnerabilities-loading">
                <VulnerabilitySkeleton />
                <VulnerabilitySkeleton />
                <VulnerabilitySkeleton />
              </div>
            ) : hasNoVulnerabilities ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center" data-testid="empty-state">
                <div className="w-12 h-12 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-[17px] font-medium leading-tight text-foreground mb-2">
                  {activeTab === 'active' ? 'No active issues' : 'No hidden issues'}
                </h3>
                <p className="text-[15px] leading-[20px] text-muted-foreground mb-4">
                  {activeTab === 'active' 
                    ? 'Your project is looking secure! Run a scan to check for vulnerabilities.'
                    : 'You haven\'t hidden any issues yet.'}
                </p>
                {activeTab === 'active' && (
                  <Button
                    onClick={() => !isScanning && startScanMutation.mutate(undefined)}
                    disabled={isScanning || startScanMutation.isPending}
                    className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-[15px] leading-[20px] font-medium"
                    data-testid="empty-state-scan-button"
                  >
                    {isScanning || startScanMutation.isPending ? (
                      <>
                        <Loader2 className="w-[18px] h-[18px] mr-2 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-[18px] h-[18px] mr-2" />
                        Run Security Scan
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              vulnerabilities?.map((vuln) => (
                <div 
                  key={vuln.id}
                  className="bg-card rounded-lg border border-border overflow-hidden"
                  data-testid={`vulnerability-${vuln.id}`}
                >
                  {/* Card Header - Clickable */}
                  <button
                    onClick={() => toggleCardExpanded(vuln.id)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-muted min-h-[44px]"
                    data-testid={`expand-vulnerability-${vuln.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge className="uppercase text-[10px] tracking-wide rounded bg-destructive/10 text-destructive border-0 font-medium flex items-center gap-1 shrink-0">
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

                  {/* Expanded Content */}
                  <div className={`collapsible-panel ${expandedCards.has(vuln.id) ? 'expanded' : 'collapsed'}`}>
                    <div className="px-4 pb-4 space-y-3 border-t border-border">
                      <p className="text-[15px] leading-[20px] text-muted-foreground pt-3">
                        {vuln.description}
                      </p>

                      {/* Package Dependencies (if applicable) */}
                      {vuln.packageName && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[15px] leading-[20px] text-muted-foreground">
                            <Package className="w-[18px] h-[18px]" />
                            <span className="font-mono">{vuln.packageName}@{vuln.vulnerableVersion}</span>
                          </div>
                        </div>
                      )}

                      {/* File Path */}
                      {vuln.filePath && (
                        <p className="text-[13px] text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                          {vuln.filePath}{vuln.lineNumber ? `:${vuln.lineNumber}` : ''}
                        </p>
                      )}

                      {/* Action Buttons - Mobile touch targets */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHideMutation.mutate({ id: vuln.id, isHidden: !vuln.isHidden });
                          }}
                          className="h-10 px-4 border-border text-muted-foreground hover:bg-muted rounded-lg text-[15px] leading-[20px]"
                          data-testid={`toggle-hide-${vuln.id}`}
                        >
                          {vuln.isHidden ? 'Unhide' : 'Hide'}
                        </Button>
                        <Button
                          className="h-11 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-[15px] leading-[20px]"
                          data-testid={`fix-with-agent-${vuln.id}`}
                        >
                          Fix with Agent
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Partner Attribution - Scrolls with content */}
          <div className="border-t border-border pt-4 mt-4 space-y-3">
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
              , both running locally on Replit infrastructure. No code or data is transmitted to any third party, including{' '}
              <a 
                href="https://semgrep.dev" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Semgrep
              </a>
              {' '}or{' '}
              <a 
                href="https://hounddog.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                HoundDog.ai
              </a>
              .
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
