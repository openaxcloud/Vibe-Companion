import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LazyMotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Search,
  Download,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Loader2,
  Plus,
  Shield,
  ArrowUpCircle,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InstalledPackage {
  name: string;
  version: string;
  type: 'production' | 'development';
}

interface PackagesResponse {
  success: boolean;
  packages: InstalledPackage[];
  language?: 'javascript' | 'python';
  message?: string;
}

interface SearchResult {
  name: string;
  version: string;
  description: string;
  date?: string;
  links?: { npm?: string };
  homepage?: string;
}

interface Vulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url?: string;
  fixAvailable: boolean;
  range?: string;
  nodes?: number;
}

interface AuditResponse {
  success: boolean;
  vulnerabilities: Vulnerability[];
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
    total: number;
  };
  language: string;
}

interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: string;
  homepage?: string;
}

interface OutdatedResponse {
  success: boolean;
  outdated: OutdatedPackage[];
  language: string;
}

interface DependencyNode {
  name: string;
  version: string;
  depth: number;
  dependencyCount: number;
  children: DependencyNode[];
}

interface DependencyResponse {
  success: boolean;
  dependencies: DependencyNode[];
  language: string;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <LazyMotionDiv
      className={cn("bg-muted rounded-lg overflow-hidden relative", className)}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
    >
      <LazyMotionDiv
        className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
    </LazyMotionDiv>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    moderate: 'bg-yellow-500 text-black',
    low: 'bg-blue-500 text-white',
    info: 'bg-gray-500 text-white',
  };
  
  return (
    <Badge className={cn("text-[10px] uppercase", colors[severity] || colors.info)}>
      {severity}
    </Badge>
  );
}

function DependencyTreeItem({ node, level = 0 }: { node: DependencyNode; level?: number }) {
  const [expanded, setExpanded] = useState(level < 1);
  const hasChildren = node.children && node.children.length > 0;
  
  return (
    <div className="text-[13px]">
      <div 
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded hover:bg-muted cursor-pointer",
          level > 0 && "ml-4"
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
        style={{ marginLeft: level * 12 }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="w-3 h-3 shrink-0" />
        )}
        <span className="font-medium text-foreground">{node.name}</span>
        <span className="text-muted-foreground text-[11px]">@{node.version}</span>
        {node.dependencyCount > 0 && (
          <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
            {node.dependencyCount} deps
          </Badge>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <DependencyTreeItem key={`${child.name}-${idx}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ReplitPackagesPanel({ projectId }: { projectId?: string | number }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [searchLanguage, setSearchLanguage] = useState<'npm' | 'pypi'>('npm');
  const { toast } = useToast();

  const { data: packagesData, isLoading, error, refetch } = useQuery<PackagesResponse>({
    queryKey: ['/api/packages/installed', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await fetch(`/api/packages/installed?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch packages');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: auditData, isLoading: isAuditing, refetch: refetchAudit } = useQuery<AuditResponse>({
    queryKey: ['/api/packages', projectId, 'audit'],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await fetch(`/api/packages/${projectId}/audit`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to run security audit');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 60000,
  });

  const { data: outdatedData, isLoading: isCheckingOutdated, refetch: refetchOutdated } = useQuery<OutdatedResponse>({
    queryKey: ['/api/packages', projectId, 'outdated'],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await fetch(`/api/packages/${projectId}/outdated`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to check outdated packages');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 60000,
  });

  const { data: dependencyData, isLoading: isLoadingDeps } = useQuery<DependencyResponse>({
    queryKey: ['/api/packages', projectId, 'dependencies'],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await fetch(`/api/packages/${projectId}/dependencies`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load dependencies');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 60000,
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<SearchResult[]>({
    queryKey: ['package-search', searchQuery, searchLanguage],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      if (searchLanguage === 'pypi') {
        const response = await fetch(
          `https://pypi.org/pypi/${encodeURIComponent(searchQuery)}/json`
        );
        if (!response.ok) return [];
        const data = await response.json();
        return [{
          name: data.info.name,
          version: data.info.version,
          description: data.info.summary || '',
          homepage: data.info.home_page || data.info.project_url
        }];
      } else {
        const response = await fetch(
          `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(searchQuery)}&size=10`
        );
        if (!response.ok) return [];
        const data = await response.json();
        return data.objects?.map((obj: any) => ({
          name: obj.package.name,
          version: obj.package.version,
          description: obj.package.description || '',
          date: obj.package.date,
          links: obj.package.links
        })) || [];
      }
    },
    enabled: searchQuery.length >= 2,
    staleTime: 60000,
  });

  const installMutation = useMutation({
    mutationFn: async ({ packageName, version }: { packageName: string; version?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('POST', `/api/packages/${projectId}/install`, {
        package: packageName,
        version
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({ title: 'Package installed', description: `Successfully installed ${variables.packageName}` });
      queryClient.invalidateQueries({ queryKey: ['/api/packages/installed', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/packages', projectId, 'outdated'] });
      queryClient.invalidateQueries({ queryKey: ['/api/packages', projectId, 'dependencies'] });
    },
    onError: (error: any, variables) => {
      toast({ title: 'Installation failed', description: error.message || `Failed to install ${variables.packageName}`, variant: 'destructive' });
    }
  });

  const uninstallMutation = useMutation({
    mutationFn: async (packageName: string) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('POST', `/api/packages/${projectId}/uninstall`, {
        package: packageName
      });
      return response.json();
    },
    onSuccess: (data, packageName) => {
      toast({ title: 'Package removed', description: `Successfully removed ${packageName}` });
      queryClient.invalidateQueries({ queryKey: ['/api/packages/installed', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/packages', projectId, 'dependencies'] });
    },
    onError: (error: any, packageName) => {
      toast({ title: 'Removal failed', description: error.message || `Failed to remove ${packageName}`, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ packageName, version }: { packageName: string; version: string }) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('POST', `/api/packages/${projectId}/update`, {
        package: packageName,
        version
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({ title: 'Package updated', description: `Successfully updated ${variables.packageName} to ${variables.version}` });
      queryClient.invalidateQueries({ queryKey: ['/api/packages/installed', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/packages', projectId, 'outdated'] });
      queryClient.invalidateQueries({ queryKey: ['/api/packages', projectId, 'audit'] });
    },
    onError: (error: any, variables) => {
      toast({ title: 'Update failed', description: error.message || `Failed to update ${variables.packageName}`, variant: 'destructive' });
    }
  });

  const togglePackageExpansion = useCallback((packageName: string) => {
    setExpandedPackages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(packageName)) {
        newSet.delete(packageName);
      } else {
        newSet.add(packageName);
      }
      return newSet;
    });
  }, []);

  const installedPackages = packagesData?.packages || [];
  const projectLanguage = packagesData?.language;
  const installedPackageNames = new Set(installedPackages.map(p => p.name));
  const filteredSearch = searchResults?.filter(pkg => !installedPackageNames.has(pkg.name)) || [];
  const vulnerabilities = auditData?.vulnerabilities || [];
  const auditSummary = auditData?.summary || { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
  const outdatedPackages = outdatedData?.outdated || [];
  const dependencies = dependencyData?.dependencies || [];

  if (!projectId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-3 bg-background" data-testid="packages-panel-no-project">
        <Package className="w-12 h-12 text-muted-foreground opacity-40 mb-3" />
        <p className="text-[15px] leading-[20px] text-muted-foreground">Select a project to manage packages</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]" data-testid="packages-panel">
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Packages</span>
          {projectLanguage && (
            <Badge variant="outline" className="h-4 text-[9px] px-1 border-[var(--ecode-border)] text-[var(--ecode-text-muted)]">
              {projectLanguage}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded hover:bg-[var(--ecode-sidebar-hover)]"
          onClick={() => {
            refetch();
            refetchAudit();
            refetchOutdated();
          }}
          disabled={isLoading}
          data-testid="button-refresh-packages"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-[var(--ecode-text-muted)]", isLoading && "animate-spin")} />
        </Button>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${searchLanguage === 'pypi' ? 'PyPI' : 'npm'}...`}
              className="pl-7 h-7 rounded text-xs bg-[var(--ecode-surface)] border-[var(--ecode-border)] text-[var(--ecode-text)] placeholder:text-[var(--ecode-text-muted)]"
              data-testid="input-package-search"
            />
          </div>
          <Select value={searchLanguage} onValueChange={(v: 'npm' | 'pypi') => setSearchLanguage(v)}>
            <SelectTrigger className="w-[70px] h-7 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="npm">npm</SelectItem>
              <SelectItem value="pypi">PyPI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="installed" className="flex-1 flex flex-col">
        <TabsList className="h-9 w-full flex justify-start px-2.5 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] rounded-none overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <TabsTrigger value="installed" className="text-[10px] px-2 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)] data-[state=active]:text-[var(--ecode-text)] text-[var(--ecode-text-muted)] rounded-none" data-testid="tab-installed">
            Installed
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)]">
              {installedPackages.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="search" className="text-[10px] px-2 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)] data-[state=active]:text-[var(--ecode-text)] text-[var(--ecode-text-muted)] rounded-none" data-testid="tab-search">
            Search
            {isSearching && <Loader2 className="ml-1 w-3 h-3 animate-spin text-[hsl(142,72%,42%)]" />}
          </TabsTrigger>
          <TabsTrigger value="security" className="text-[10px] px-2 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)] data-[state=active]:text-[var(--ecode-text)] text-[var(--ecode-text-muted)] rounded-none">
            <Shield className="w-3 h-3 mr-0.5" />
            Sec
            {auditSummary.critical + auditSummary.high > 0 && (
              <Badge className="ml-0.5 h-4 px-1 text-[9px] bg-red-600 text-white">
                {auditSummary.critical + auditSummary.high}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="updates" className="text-[10px] px-2 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)] data-[state=active]:text-[var(--ecode-text)] text-[var(--ecode-text-muted)] rounded-none">
            <ArrowUpCircle className="w-3 h-3 mr-0.5" />
            Up
            {outdatedPackages.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[9px]">
                {outdatedPackages.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deps" className="text-[10px] px-2 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-[hsl(142,72%,42%)] data-[state=active]:text-[var(--ecode-text)] text-[var(--ecode-text-muted)] rounded-none">
            <GitBranch className="w-3 h-3 mr-0.5" />
            Tree
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <ShimmerSkeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="w-12 h-12 text-destructive opacity-40 mb-3" />
                  <p className="text-[15px] leading-[20px] text-muted-foreground">Failed to load packages</p>
                  <Button variant="link" size="sm" onClick={() => refetch()} className="text-[13px] text-primary hover:text-primary">
                    Try again
                  </Button>
                </div>
              ) : installedPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
                  <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">No packages installed</h4>
                  <p className="text-[13px] text-muted-foreground mb-4 max-w-[200px]">
                    Search for packages to add dependencies to your project
                  </p>
                  <Button className="h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[13px]" onClick={() => {
                    const searchTab = document.querySelector('[data-testid="tab-search"]') as HTMLElement;
                    searchTab?.click();
                  }} data-testid="button-install-first">
                    <Plus className="w-[18px] h-[18px] mr-1.5" />
                    Install Package
                  </Button>
                </div>
              ) : (
                installedPackages.map((pkg) => (
                  <div key={pkg.name} className="mb-2 border border-border rounded-lg bg-card overflow-hidden" data-testid={`package-item-${pkg.name}`}>
                    <div className="p-3 cursor-pointer hover:bg-muted transition-colors" onClick={() => togglePackageExpansion(pkg.name)}>
                      <div className="flex items-start gap-2">
                        <button className="mt-0.5">
                          {expandedPackages.has(pkg.name) ? (
                            <ChevronDown className="w-[18px] h-[18px] text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-[18px] h-[18px] text-muted-foreground" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[15px] leading-[20px] font-medium text-foreground">{pkg.name}</span>
                            <Badge variant="outline" className="text-[11px] px-1.5 py-0 border-border text-muted-foreground bg-transparent">
                              {pkg.version}
                            </Badge>
                            <Badge className={cn("text-[11px] uppercase tracking-wider px-1.5 py-0",
                              pkg.type === 'development' ? "bg-muted text-amber-400 border-amber-500" : "bg-card text-primary border-primary"
                            )}>
                              {pkg.type === 'development' ? 'dev' : 'prod'}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={(e) => {
                          e.stopPropagation();
                          uninstallMutation.mutate(pkg.name);
                        }} disabled={uninstallMutation.isPending} data-testid={`button-uninstall-${pkg.name}`}>
                          {uninstallMutation.isPending && uninstallMutation.variables === pkg.name ? (
                            <Loader2 className="w-[18px] h-[18px] animate-spin text-muted-foreground" />
                          ) : (
                            <Trash2 className="w-[18px] h-[18px] text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {expandedPackages.has(pkg.name) && (
                      <div className="px-3 pb-3 border-t border-border">
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Version:</span>
                            <span className="text-[13px] font-mono text-foreground">{pkg.version}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Type:</span>
                            <span className="text-[13px] text-foreground">{pkg.type}</span>
                          </div>
                          <a href={projectLanguage === 'python' ? `https://pypi.org/project/${pkg.name}` : `https://www.npmjs.com/package/${pkg.name}`}
                            target="_blank" rel="noopener noreferrer" className="text-[13px] text-primary hover:underline inline-flex items-center gap-1">
                            View on {projectLanguage === 'python' ? 'PyPI' : 'npm'} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="search" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              {searchQuery.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-full py-12">
                  <Search className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
                  <p className="text-[15px] leading-[20px] text-muted-foreground">Type at least 2 characters to search</p>
                </div>
              ) : isSearching ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <ShimmerSkeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : filteredSearch.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
                  <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">No packages found</h4>
                  <p className="text-[13px] text-muted-foreground">Try a different search term</p>
                </div>
              ) : (
                filteredSearch.map((pkg) => (
                  <div key={pkg.name} className="mb-2 p-3 border border-border rounded-lg bg-card hover:bg-muted transition-colors" data-testid={`search-result-${pkg.name}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] leading-[20px] font-medium text-foreground">{pkg.name}</span>
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0 border-border text-muted-foreground bg-transparent">
                            v{pkg.version}
                          </Badge>
                        </div>
                        {pkg.description && (
                          <p className="text-[13px] text-muted-foreground mt-1.5 line-clamp-2">{pkg.description}</p>
                        )}
                      </div>
                      <Button className="h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] shrink-0"
                        onClick={() => installMutation.mutate({ packageName: pkg.name })} disabled={installMutation.isPending}
                        data-testid={`button-install-${pkg.name}`}>
                        {installMutation.isPending && installMutation.variables?.packageName === pkg.name ? (
                          <><Loader2 className="w-[18px] h-[18px] mr-1.5 animate-spin" />Installing</>
                        ) : (
                          <><Download className="w-[18px] h-[18px] mr-1.5" />Install</>
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="security" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              {isAuditing ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <ShimmerSkeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-red-600/10 border border-red-600/20 text-center">
                      <div className="text-[15px] font-bold text-red-600">{auditSummary.critical}</div>
                      <div className="text-[10px] uppercase text-red-600">Critical</div>
                    </div>
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                      <div className="text-[15px] font-bold text-orange-500">{auditSummary.high}</div>
                      <div className="text-[10px] uppercase text-orange-500">High</div>
                    </div>
                    <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                      <div className="text-[15px] font-bold text-yellow-600">{auditSummary.moderate}</div>
                      <div className="text-[10px] uppercase text-yellow-600">Moderate</div>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                      <div className="text-[15px] font-bold text-blue-500">{auditSummary.low}</div>
                      <div className="text-[10px] uppercase text-blue-500">Low</div>
                    </div>
                  </div>

                  {vulnerabilities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle className="w-12 h-12 text-green-500 opacity-60 mb-4" />
                      <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">No vulnerabilities found</h4>
                      <p className="text-[13px] text-muted-foreground">Your packages are secure</p>
                    </div>
                  ) : (
                    vulnerabilities.map((vuln, idx) => (
                      <div key={`${vuln.name}-${idx}`} className="mb-2 p-3 border border-border rounded-lg bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              <span className="text-[14px] font-medium text-foreground">{vuln.name}</span>
                              <SeverityBadge severity={vuln.severity} />
                            </div>
                            <p className="text-[13px] text-muted-foreground mt-1">{vuln.title}</p>
                            {vuln.range && (
                              <p className="text-[12px] text-muted-foreground mt-1">Affected: {vuln.range}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {vuln.fixAvailable && (
                              <Badge variant="outline" className="text-[10px] text-green-500 border-green-500">
                                Fix available
                              </Badge>
                            )}
                            {vuln.url && (
                              <a href={vuln.url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="updates" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              {isCheckingOutdated ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <ShimmerSkeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : outdatedPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 opacity-60 mb-4" />
                  <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">All packages up to date</h4>
                  <p className="text-[13px] text-muted-foreground">No updates available</p>
                </div>
              ) : (
                outdatedPackages.map((pkg) => (
                  <div key={pkg.name} className="mb-2 p-3 border border-border rounded-lg bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ArrowUpCircle className="w-4 h-4 text-blue-500" />
                          <span className="text-[14px] font-medium text-foreground">{pkg.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[12px]">
                          <span className="text-muted-foreground">Current:</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{pkg.current}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-muted-foreground">Latest:</span>
                          <Badge className="text-[10px] px-1 py-0 bg-green-600 text-white">{pkg.latest}</Badge>
                        </div>
                      </div>
                      <Button size="sm" className="h-7 text-[12px] bg-blue-600 hover:bg-blue-700"
                        onClick={() => updateMutation.mutate({ packageName: pkg.name, version: pkg.latest })}
                        disabled={updateMutation.isPending && updateMutation.variables?.packageName === pkg.name}>
                        {updateMutation.isPending && updateMutation.variables?.packageName === pkg.name ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <ArrowUpCircle className="w-3 h-3 mr-1" />
                        )}
                        Update
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="deps" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              {isLoadingDeps ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <ShimmerSkeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : dependencies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <GitBranch className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
                  <h4 className="text-[17px] font-medium leading-tight text-foreground mb-2">No dependencies found</h4>
                  <p className="text-[13px] text-muted-foreground">Install some packages to see the dependency tree</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {dependencies.map((dep, idx) => (
                    <DependencyTreeItem key={`${dep.name}-${idx}`} node={dep} />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
