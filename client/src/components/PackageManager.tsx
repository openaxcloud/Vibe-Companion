import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  Plus, 
  Trash2, 
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle,
  Download,
  Terminal,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PackageManagerProps {
  projectId: number;
  language?: string;
  className?: string;
}

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  isDevDependency?: boolean;
  latest?: string;
  outdated?: boolean;
}

interface InstallLogEntry {
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: number;
}

export function PackageManager({ projectId, language: propLanguage, className }: PackageManagerProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PackageInfo[]>([]);
  const [installingPackages, setInstallingPackages] = useState<Set<string>>(new Set());
  const [installLog, setInstallLog] = useState<InstallLogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: packageData, isLoading } = useQuery<{
    packages: PackageInfo[];
    language: string;
    packageManager: string;
  }>({
    queryKey: ['/api/projects', projectId, 'packages'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/packages`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch packages');
      return res.json();
    },
    enabled: !!projectId,
  });

  const packages = packageData?.packages || [];
  const detectedLanguage = propLanguage || packageData?.language || 'javascript';
  const detectedManager = packageData?.packageManager || 'npm';

  useEffect(() => {
    if (logEndRef.current && showLog) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [installLog, showLog]);

  const getPackageManager = () => {
    switch (detectedLanguage) {
      case 'python': return 'pip';
      case 'go': return 'go';
      case 'rust': return 'cargo';
      default: return detectedManager || 'npm';
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/packages/search?q=${encodeURIComponent(searchQuery)}&language=${detectedLanguage}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Search failed');
      
      const results = await response.json();
      const resultArray = Array.isArray(results) ? results : results.packages || [];
      setSearchResults(resultArray.map((pkg: any) => ({
        name: pkg.name,
        version: pkg.version,
        description: pkg.description
      })));
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: 'Failed to search packages. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleInstallWithStreaming = useCallback(async (packageName: string, version?: string) => {
    setInstallingPackages(prev => new Set([...prev, packageName]));
    setInstallLog([]);
    setShowLog(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/packages/install-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: packageName, version, language: detectedLanguage }),
      });

      if (!response.ok) {
        throw new Error('Installation failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';

          for (const frame of frames) {
            let eventType = '';
            let dataStr = '';
            for (const line of frame.split('\n')) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.slice(6);
              }
            }
            if (!eventType || !dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (eventType === 'output') {
                setInstallLog(prev => [...prev, {
                  line: data.line,
                  stream: data.stream,
                  timestamp: Date.now(),
                }]);
              } else if (eventType === 'complete') {
                if (data.success) {
                  toast({
                    title: 'Package Installed',
                    description: `Successfully installed ${packageName}`,
                  });
                  queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'packages'] });
                } else {
                  toast({
                    title: 'Installation Failed',
                    description: `Failed to install ${packageName}`,
                    variant: 'destructive',
                  });
                }
              } else if (eventType === 'error') {
                setInstallLog(prev => [...prev, {
                  line: `Error: ${data.message}`,
                  stream: 'stderr',
                  timestamp: Date.now(),
                }]);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      await handleInstallFallback(packageName, version);
    } finally {
      setInstallingPackages(prev => {
        const newSet = new Set(prev);
        newSet.delete(packageName);
        return newSet;
      });
    }
  }, [projectId, detectedLanguage, queryClient, toast]);

  const handleInstallFallback = async (packageName: string, version?: string) => {
    try {
      const response = await apiRequest('POST', `/api/projects/${projectId}/packages`, {
        name: packageName,
        version,
        language: detectedLanguage,
      });
      
      if (!response.ok) throw new Error('Installation failed');
      
      toast({
        title: 'Package Installed',
        description: `Successfully installed ${packageName}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'packages'] });
    } catch (error) {
      toast({
        title: 'Installation Failed',
        description: `Failed to install ${packageName}`,
        variant: 'destructive',
      });
    }
  };

  const handleUninstall = async (packageName: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/projects/${projectId}/packages/${encodeURIComponent(packageName)}`);
      
      if (!response.ok) throw new Error('Uninstall failed');
      
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'packages'] });
      toast({
        title: 'Package Uninstalled',
        description: `Successfully uninstalled ${packageName}`,
      });
    } catch (error) {
      toast({
        title: 'Uninstall Failed',
        description: `Failed to uninstall ${packageName}`,
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (packageName: string) => {
    setInstallingPackages(prev => new Set([...prev, packageName]));
    
    try {
      const response = await apiRequest('POST', `/api/projects/${projectId}/packages/update`, {
        packages: [packageName],
      });
      
      if (!response.ok) throw new Error('Update failed');
      
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'packages'] });
      toast({
        title: 'Package Updated',
        description: `Successfully updated ${packageName}`,
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: `Failed to update ${packageName}`,
        variant: 'destructive',
      });
    } finally {
      setInstallingPackages(prev => {
        const newSet = new Set(prev);
        newSet.delete(packageName);
        return newSet;
      });
    }
  };

  const outdatedCount = packages.filter(p => p.outdated).length;

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Package Manager
          </CardTitle>
          <div className="flex items-center gap-2">
            {showLog && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => setShowLog(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Badge variant="outline">
              {getPackageManager()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {showLog && installLog.length > 0 && (
          <div className="mb-3 rounded-lg border bg-black/90 text-green-400 font-mono text-[11px] p-3 max-h-[200px] overflow-auto">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Terminal className="h-3 w-3" />
              <span>Installation Output</span>
            </div>
            {installLog.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "whitespace-pre-wrap break-all",
                  entry.stream === 'stderr' ? 'text-yellow-400' : 'text-green-400'
                )}
              >
                {entry.line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        <Tabs defaultValue="installed" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="installed" className="relative">
              Installed
              {outdatedCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1">
                  {outdatedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="installed" className="flex-1 flex flex-col mt-4 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-[13px] text-muted-foreground">Loading packages...</span>
              </div>
            ) : (
              <>
                {outdatedCount > 0 && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {outdatedCount} package{outdatedCount > 1 ? 's' : ''} can be updated
                    </AlertDescription>
                  </Alert>
                )}

                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {packages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-[13px]">
                        No packages installed yet. Use the Search tab to find and install packages.
                      </div>
                    ) : (
                      packages.map(pkg => (
                        <div
                          key={pkg.name}
                          className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-[13px] truncate">{pkg.name}</h4>
                                <Badge variant="secondary" className="text-[11px]">
                                  v{pkg.version}
                                </Badge>
                                {pkg.isDevDependency && (
                                  <Badge variant="outline" className="text-[11px]">
                                    Dev
                                  </Badge>
                                )}
                                {pkg.outdated && (
                                  <Badge variant="destructive" className="text-[11px]">
                                    Outdated
                                  </Badge>
                                )}
                              </div>
                              {pkg.description && (
                                <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                  {pkg.description}
                                </p>
                              )}
                              {pkg.outdated && pkg.latest && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Latest: v{pkg.latest}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {pkg.outdated && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => handleUpdate(pkg.name)}
                                  disabled={installingPackages.has(pkg.name)}
                                >
                                  {installingPackages.has(pkg.name) ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="h-3 w-3 mr-1" />
                                      Update
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() => handleUninstall(pkg.name)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="pt-3 border-t mt-3 text-[11px] text-muted-foreground">
                  {packages.length} packages installed
                  {packages.filter(p => p.isDevDependency).length > 0 && 
                    ` (${packages.filter(p => p.isDevDependency).length} dev)`
                  }
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="search" className="flex-1 flex flex-col mt-4 min-h-0">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder={`Search ${getPackageManager()} packages...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No packages found' : 'Search for packages to install'}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map(pkg => (
                    <div
                      key={pkg.name}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-[13px] truncate">{pkg.name}</h4>
                            <Badge variant="secondary" className="text-[11px]">
                              v{pkg.version}
                            </Badge>
                          </div>
                          {pkg.description && (
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                              {pkg.description}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 flex-shrink-0"
                          onClick={() => handleInstallWithStreaming(pkg.name, pkg.version)}
                          disabled={installingPackages.has(pkg.name) || 
                                    packages.some(p => p.name === pkg.name)}
                        >
                          {installingPackages.has(pkg.name) ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : packages.some(p => p.name === pkg.name) ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Installed
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Install
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}