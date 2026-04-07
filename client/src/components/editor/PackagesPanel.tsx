import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Loader2,
  AlertCircle,
  ExternalLink,
  ArrowUpCircle,
  Download,
  Box,
  Settings2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from 'use-debounce';

interface InstalledPackage {
  name: string;
  version: string;
  type: 'production' | 'development';
  isDev?: boolean;
  description?: string;
}

interface SystemDependency {
  name: string;
  type: 'system';
}

interface SearchPackage {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  score?: number;
}

interface PackagesResponse {
  success: boolean;
  packages: InstalledPackage[];
  systemDependencies: SystemDependency[];
  language: string;
}

interface SearchResponse {
  success: boolean;
  packages: SearchPackage[];
  query: string;
  language: string;
}

interface PackagesPanelProps {
  projectId: string | number;
  language?: 'nodejs' | 'python' | 'ruby' | 'go' | 'rust';
  className?: string;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse",
        className
      )}
    />
  );
}

export function PackagesPanel({ projectId, language = 'nodejs', className }: PackagesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('latest');
  const [installedOpen, setInstalledOpen] = useState(true);
  const [systemOpen, setSystemOpen] = useState(true);
  const [pendingActions, setPendingActions] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const packagesQueryKey = ['/api/packages', projectId, 'list'];

  const { data: packagesData, isLoading, error, refetch } = useQuery<PackagesResponse>({
    queryKey: packagesQueryKey,
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await fetch(`/api/packages/${projectId}/list`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch packages');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: searchData, isLoading: isSearching } = useQuery<SearchResponse>({
    queryKey: ['/api/packages', projectId, 'search', debouncedSearch, language],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return { success: true, packages: [], query: '', language };
      const response = await fetch(
        `/api/packages/${projectId}/search?q=${encodeURIComponent(debouncedSearch)}&language=${language}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: !!projectId && debouncedSearch.length >= 2 && showAddDialog,
    staleTime: 60000,
  });

  const installMutation = useMutation({
    mutationFn: async ({ name, version }: { name: string; version?: string }) => {
      setPendingActions(prev => ({ ...prev, [name]: 'installing' }));
      return apiRequest('POST', `/api/packages/${projectId}/install`, { 
        name, 
        version: version !== 'latest' ? version : undefined 
      });
    },
    onSuccess: (_, { name }) => {
      toast({ title: 'Success', description: `Installed ${name}` });
      queryClient.invalidateQueries({ queryKey: packagesQueryKey });
      setPendingActions(prev => {
        const newState = { ...prev };
        delete newState[name];
        return newState;
      });
      setShowAddDialog(false);
      setSearchQuery('');
    },
    onError: (error: any, { name }) => {
      toast({
        title: 'Installation failed',
        description: error.message || `Failed to install ${name}`,
        variant: 'destructive'
      });
      setPendingActions(prev => {
        const newState = { ...prev };
        delete newState[name];
        return newState;
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ name, version }: { name: string; version?: string }) => {
      setPendingActions(prev => ({ ...prev, [name]: 'updating' }));
      return apiRequest('POST', `/api/packages/${projectId}/update`, { name, version });
    },
    onSuccess: (_, { name }) => {
      toast({ title: 'Success', description: `Updated ${name}` });
      queryClient.invalidateQueries({ queryKey: packagesQueryKey });
      setPendingActions(prev => {
        const newState = { ...prev };
        delete newState[name];
        return newState;
      });
    },
    onError: (error: any, { name }) => {
      toast({
        title: 'Update failed',
        description: error.message || `Failed to update ${name}`,
        variant: 'destructive'
      });
      setPendingActions(prev => {
        const newState = { ...prev };
        delete newState[name];
        return newState;
      });
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (name: string) => {
      setPendingActions(prev => ({ ...prev, [name]: 'removing' }));
      return apiRequest('DELETE', `/api/packages/${projectId}/${encodeURIComponent(name)}`);
    },
    onSuccess: (_, name) => {
      toast({ title: 'Success', description: `Removed ${name}` });
      queryClient.invalidateQueries({ queryKey: packagesQueryKey });
      setPendingActions(prev => {
        const newState = { ...prev };
        delete newState[name];
        return newState;
      });
    },
    onError: (error: any, name) => {
      toast({
        title: 'Removal failed',
        description: error.message || `Failed to remove ${name}`,
        variant: 'destructive'
      });
      setPendingActions(prev => {
        const newState = { ...prev };
        delete newState[name];
        return newState;
      });
    }
  });

  const handleInstall = useCallback((pkg: SearchPackage) => {
    installMutation.mutate({ name: pkg.name, version: selectedVersion !== 'latest' ? selectedVersion : pkg.version });
  }, [installMutation, selectedVersion]);

  const packages = packagesData?.packages || [];
  const systemDependencies = packagesData?.systemDependencies || [];
  const searchResults = searchData?.packages || [];
  const detectedLanguage = packagesData?.language || language;

  const languageLabel = detectedLanguage === 'python' ? 'Python' : 
                        detectedLanguage === 'nodejs' ? 'Node.js' : 
                        detectedLanguage.charAt(0).toUpperCase() + detectedLanguage.slice(1);

  if (!projectId) {
    return (
      <div 
        className={cn("h-full flex flex-col items-center justify-center p-3 bg-background", className)}
        data-testid="packages-panel-no-project"
      >
        <Package className="w-12 h-12 mb-4 text-muted-foreground opacity-40" />
        <p className="text-[13px] text-muted-foreground">Select a project to manage packages</p>
      </div>
    );
  }

  return (
    <div 
      className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)}
      data-testid="packages-panel"
    >
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]" data-testid="text-packages-title">Packages</span>
          <Badge className="h-4 px-1 text-[9px] bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)] rounded" data-testid="text-packages-count">
            {packages.length}
          </Badge>
          <Badge className="h-4 px-1 text-[9px] bg-[hsl(142,72%,42%)]/10 text-[hsl(142,72%,42%)] rounded" data-testid="badge-language">
            {languageLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-packages"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[hsl(142,72%,42%)] hover:bg-[hsl(142,72%,42%)]/10"
            onClick={() => setShowAddDialog(true)}
            data-testid="button-add-package"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <ShimmerSkeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="w-12 h-12 mb-3 text-destructive opacity-40" />
              <p className="text-[13px] text-muted-foreground">Failed to load packages</p>
              <Button variant="link" className="mt-2" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <Collapsible open={installedOpen} onOpenChange={setInstalledOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 hover:bg-accent/50 rounded-md px-2 transition-colors">
                  {installedOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Box className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[13px] font-medium" data-testid="text-installed-section">
                    Installed Packages
                  </span>
                  <Badge variant="secondary" className="ml-auto text-[11px]">
                    {packages.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {packages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Package className="w-10 h-10 mb-3 text-muted-foreground opacity-40" />
                      <p className="text-[13px] text-muted-foreground">No packages installed</p>
                      <Button 
                        variant="link" 
                        className="mt-2" 
                        onClick={() => setShowAddDialog(true)}
                      >
                        Add your first package
                      </Button>
                    </div>
                  ) : (
                    packages.map((pkg) => (
                      <div
                        key={pkg.name}
                        className="p-3 rounded-lg border bg-card transition-colors hover:bg-accent/50"
                        data-testid={`package-item-${pkg.name}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span 
                                className="font-mono text-[13px] font-medium truncate"
                                data-testid={`text-package-name-${pkg.name}`}
                              >
                                {pkg.name}
                              </span>
                              <Badge 
                                variant="outline" 
                                className="text-[10px] font-mono"
                                data-testid={`badge-version-${pkg.name}`}
                              >
                                {pkg.version}
                              </Badge>
                              {pkg.isDev && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] uppercase"
                                >
                                  dev
                                </Badge>
                              )}
                            </div>
                            {pkg.description && (
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                                {pkg.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateMutation.mutate({ name: pkg.name })}
                              disabled={!!pendingActions[pkg.name]}
                              title="Update to latest"
                              data-testid={`button-update-${pkg.name}`}
                            >
                              {pendingActions[pkg.name] === 'updating' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ArrowUpCircle className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeMutation.mutate(pkg.name)}
                              disabled={!!pendingActions[pkg.name]}
                              title="Remove package"
                              data-testid={`button-remove-${pkg.name}`}
                            >
                              {pendingActions[pkg.name] === 'removing' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={systemOpen} onOpenChange={setSystemOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 hover:bg-accent/50 rounded-md px-2 transition-colors">
                  {systemOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[13px] font-medium" data-testid="text-system-section">
                    System Dependencies
                  </span>
                  <Badge variant="secondary" className="ml-auto text-[11px]">
                    {systemDependencies.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {systemDependencies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Settings2 className="w-8 h-8 mb-2 text-muted-foreground opacity-40" />
                      <p className="text-[11px] text-muted-foreground">No system dependencies configured</p>
                    </div>
                  ) : (
                    systemDependencies.map((dep) => (
                      <div
                        key={dep.name}
                        className="p-3 rounded-lg border bg-card transition-colors hover:bg-accent/50"
                        data-testid={`system-dep-${dep.name}`}
                      >
                        <div className="flex items-center gap-2">
                          <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span 
                            className="font-mono text-[13px] truncate"
                            data-testid={`text-system-dep-${dep.name}`}
                          >
                            {dep.name}
                          </span>
                          <Badge 
                            variant="outline" 
                            className="text-[10px] uppercase ml-auto"
                          >
                            nix
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      </ScrollArea>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Add Package
            </DialogTitle>
            <DialogDescription>
              Search for packages from {detectedLanguage === 'python' ? 'PyPI' : 'npm'} registry
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${detectedLanguage === 'python' ? 'PyPI' : 'npm'} packages...`}
                  className="pl-9 h-10"
                  autoFocus
                  data-testid="input-search-packages"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                <SelectTrigger className="w-[120px]" data-testid="select-version">
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="next">Next</SelectItem>
                  <SelectItem value="beta">Beta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-2 min-h-[200px]">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <p className="text-[13px] text-muted-foreground mt-2">Searching...</p>
                  </div>
                ) : searchQuery.length < 2 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Search className="w-10 h-10 mb-3 text-muted-foreground opacity-40" />
                    <p className="text-[13px] text-muted-foreground">
                      Type at least 2 characters to search
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Package className="w-10 h-10 mb-3 text-muted-foreground opacity-40" />
                    <p className="text-[13px] text-muted-foreground">
                      No packages found for "{searchQuery}"
                    </p>
                  </div>
                ) : (
                  searchResults.map((pkg) => {
                    const isInstalled = packages.some(p => p.name === pkg.name);
                    const isPending = pendingActions[pkg.name] === 'installing';
                    
                    return (
                      <div
                        key={pkg.name}
                        className="p-3 rounded-lg border bg-card transition-colors hover:bg-accent/50"
                        data-testid={`search-result-${pkg.name}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span 
                                className="font-mono text-[13px] font-medium"
                                data-testid={`text-search-name-${pkg.name}`}
                              >
                                {pkg.name}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                v{pkg.version}
                              </Badge>
                              {isInstalled && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Installed
                                </Badge>
                              )}
                            </div>
                            {pkg.description && (
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                {pkg.description}
                              </p>
                            )}
                            {pkg.homepage && (
                              <a
                                href={pkg.homepage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-primary hover:underline mt-1 inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Homepage
                              </a>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={isInstalled ? "secondary" : "default"}
                            onClick={() => handleInstall(pkg)}
                            disabled={isInstalled || isPending}
                            className="shrink-0"
                            data-testid={`button-install-${pkg.name}`}
                          >
                            {isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Installing...
                              </>
                            ) : isInstalled ? (
                              'Installed'
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-1" />
                                Install
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setSearchQuery(''); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PackagesPanel;
