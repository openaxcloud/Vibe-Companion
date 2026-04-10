import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageShell, PageHeader, PageShellLoading } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  Download, 
  RefreshCw, 
  Search,
  AlertCircle,
  CheckCircle2,
  Info,
  ExternalLink,
  Trash2,
  ArrowUp,
  Clock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Star,
  GitBranch,
  FileText,
  Lock,
  Plus,
  X,
  Code,
  Terminal,
  Filter,
  AlertTriangle,
  Eye,
  Copy,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  installedVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  license?: string;
  size?: string;
  dependencies?: number;
  lastUpdated?: string;
  repository?: string;
  homepage?: string;
  downloads?: number;
  author?: string;
  keywords?: string[];
  type: 'npm' | 'pip';
  isDev?: boolean;
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface PackageStats {
  total: number;
  npm: number;
  pip: number;
  outdated: number;
  vulnerabilities: number;
  lastScan: string;
}

interface SearchResult {
  name: string;
  version: string;
  description?: string;
  downloads?: number;
  keywords?: string[];
  author?: string;
  license?: string;
  type: 'npm' | 'pip';
}

interface LockFileEntry {
  name: string;
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
}

export default function PackagesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("installed");
  const [searchQuery, setSearchQuery] = useState("");
  const [registrySearch, setRegistrySearch] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'npm' | 'pip'>('all');
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showLockFileDialog, setShowLockFileDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageInfo | null>(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const { data: packages = [], isLoading, error: packagesError } = useQuery<PackageInfo[]>({
    queryKey: ['/api/packages'],
    queryFn: async () => {
      const response = await fetch('/api/packages', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch packages');
      }
      return response.json();
    }
  });

  const { data: stats } = useQuery<PackageStats>({
    queryKey: ['/api/packages/stats'],
    queryFn: async () => {
      const response = await fetch('/api/packages/stats', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch package stats');
      }
      return response.json();
    }
  });

  const { data: lockFile = [] } = useQuery<LockFileEntry[]>({
    queryKey: ['/api/packages/lockfile'],
    queryFn: async () => {
      const response = await fetch('/api/packages/lockfile', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch lockfile');
      }
      return response.json();
    },
    enabled: showLockFileDialog
  });

  const { data: searchResults = [], isLoading: searchLoading, refetch: searchPackages } = useQuery<SearchResult[]>({
    queryKey: ['/api/packages/search', registrySearch],
    queryFn: async () => {
      if (!registrySearch) return [];
      const response = await fetch(`/api/packages/search?query=${encodeURIComponent(registrySearch)}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to search packages');
      }
      return response.json();
    },
    enabled: registrySearch.length > 2
  });

  const installPackageMutation = useMutation({
    mutationFn: async (pkg: { name: string; type: 'npm' | 'pip'; version?: string }) => {
      setInstallProgress(0);
      const interval = setInterval(() => {
        setInstallProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 300);
      
      const res = await apiRequest('POST', '/api/packages', pkg);
      clearInterval(interval);
      setInstallProgress(100);
      
      if (!res.ok) throw new Error('Failed to install package');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/packages'] });
      toast({
        title: "Package installed",
        description: `${variables.name} has been added to your project`,
      });
      setInstallProgress(0);
      setShowInstallDialog(false);
    },
    onError: () => {
      setInstallProgress(0);
      toast({
        title: "Installation failed",
        description: "Failed to install the package. Please try again.",
        variant: "destructive"
      });
    }
  });

  const updatePackageMutation = useMutation({
    mutationFn: async (pkg: { name: string; version: string }) => {
      const res = await apiRequest('PUT', `/api/packages/${pkg.name}`, { version: pkg.version });
      if (!res.ok) throw new Error('Failed to update package');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/packages'] });
      toast({
        title: "Package updated",
        description: `${variables.name} has been updated to v${variables.version}`,
      });
    }
  });

  const updateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PUT', '/api/packages/update-all');
      if (!res.ok) throw new Error('Failed to update packages');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/packages'] });
      toast({
        title: "All packages updated",
        description: "All outdated packages have been updated successfully",
      });
    }
  });

  const removePackageMutation = useMutation({
    mutationFn: async (packageName: string) => {
      const res = await apiRequest('DELETE', `/api/packages/${packageName}`);
      if (!res.ok) throw new Error('Failed to remove package');
      return res.json();
    },
    onSuccess: (_, packageName) => {
      queryClient.invalidateQueries({ queryKey: ['/api/packages'] });
      toast({
        title: "Package removed",
        description: `${packageName} has been removed from your project`,
      });
    }
  });

  const runSecurityScanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/packages/security-scan');
      if (!res.ok) throw new Error('Failed to run security scan');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/packages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/packages/stats'] });
      toast({
        title: "Security scan complete",
        description: "All packages have been scanned for vulnerabilities",
      });
    }
  });

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           pkg.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || pkg.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [packages, searchQuery, filterType]);

  const outdatedPackages = packages.filter(pkg => pkg.hasUpdate);
  const vulnerablePackages = packages.filter(pkg => pkg.vulnerabilities);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (isLoading) {
    return <PageShellLoading text="Loading packages..." />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Package Manager"
        description="Install, update, and manage your project dependencies across NPM and Pip registries"
        icon={Package}
        actions={
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="min-h-[44px] sm:min-h-0"
              onClick={() => runSecurityScanMutation.mutate(undefined)}
              disabled={runSecurityScanMutation.isPending}
              data-testid="button-security-scan"
            >
              <Shield className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Security Scan</span>
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="min-h-[44px] sm:min-h-0"
              onClick={() => updateAllMutation.mutate(undefined)}
              disabled={updateAllMutation.isPending || outdatedPackages.length === 0}
              data-testid="button-update-all"
            >
              <ArrowUp className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Update All</span>
              <span className="ml-1">({outdatedPackages.length})</span>
            </Button>
            <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="min-h-[44px] sm:min-h-0" data-testid="button-install-package">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Install Package</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl sm:w-full">
                <DialogHeader>
                  <DialogTitle>Install Package</DialogTitle>
                  <DialogDescription>
                    Search and install packages from NPM or PyPI registry
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search packages (e.g., react, flask, express)..."
                        value={registrySearch}
                        onChange={(e) => setRegistrySearch(e.target.value)}
                        className="pl-10"
                        data-testid="input-package-search"
                      />
                    </div>
                  </div>
                  
                  {installProgress > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[13px]">
                        <span>Installing package...</span>
                        <span>{installProgress}%</span>
                      </div>
                      <Progress value={installProgress} />
                    </div>
                  )}

                  <ScrollArea className="h-[300px]">
                    {searchLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-2">
                        {searchResults.map((pkg) => (
                          <Card 
                            key={`${pkg.type}-${pkg.name}`} 
                            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            data-testid={`card-search-result-${pkg.name}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{pkg.name}</h4>
                                  <Badge variant="outline" className="text-[11px]">
                                    {pkg.type.toUpperCase()}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[11px]">
                                    v{pkg.version}
                                  </Badge>
                                </div>
                                <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">
                                  {pkg.description}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                                  {pkg.downloads && (
                                    <span className="flex items-center gap-1">
                                      <Download className="h-3 w-3" />
                                      {formatNumber(pkg.downloads)} downloads
                                    </span>
                                  )}
                                  {pkg.author && (
                                    <span>by {pkg.author}</span>
                                  )}
                                </div>
                              </div>
                              <Button 
                                size="sm"
                                onClick={() => installPackageMutation.mutate({ 
                                  name: pkg.name, 
                                  type: pkg.type,
                                  version: pkg.version 
                                })}
                                disabled={installPackageMutation.isPending}
                                data-testid={`button-install-${pkg.name}`}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Install
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : registrySearch.length > 2 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No packages found for "{registrySearch}"</p>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Enter at least 3 characters to search</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card data-testid="card-stat-total">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-1 sm:gap-2">
              <Package className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Total Packages</span>
              <span className="sm:hidden">Total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.total || packages.length}</div>
            <p className="text-[11px] text-muted-foreground truncate">
              {stats?.npm || 0} NPM · {stats?.pip || 0} Pip
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-npm">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-1 sm:gap-2">
              <Terminal className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
              <span className="hidden sm:inline">NPM Packages</span>
              <span className="sm:hidden">NPM</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-red-500">{stats?.npm || 0}</div>
            <p className="text-[11px] text-muted-foreground truncate">JavaScript/TypeScript</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-pip">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-1 sm:gap-2">
              <Code className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
              <span className="hidden sm:inline">Pip Packages</span>
              <span className="sm:hidden">Pip</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-blue-500">{stats?.pip || 0}</div>
            <p className="text-[11px] text-muted-foreground">Python</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-outdated">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-1 sm:gap-2">
              <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
              Outdated
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-yellow-500">{stats?.outdated || outdatedPackages.length}</div>
            <p className="text-[11px] text-muted-foreground truncate">Updates available</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1" data-testid="card-stat-vulnerabilities">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-[11px] sm:text-[13px] font-medium flex items-center gap-1 sm:gap-2">
              <ShieldAlert className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
              <span className="hidden sm:inline">Vulnerabilities</span>
              <span className="sm:hidden">Issues</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-red-500">{stats?.vulnerabilities || vulnerablePackages.length}</div>
            <p className="text-[11px] text-muted-foreground">Security issues</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-filter-packages"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="w-[120px]" data-testid="select-package-type">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="npm">NPM</SelectItem>
              <SelectItem value="pip">Pip</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
          onClick={() => setShowLockFileDialog(true)}
          data-testid="button-view-lockfile"
        >
          <Lock className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">View Lock File</span>
          <span className="sm:hidden">Lock File</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="installed" className="text-[11px] sm:text-[13px] min-h-[44px] sm:min-h-0" data-testid="tab-installed">
            <span className="hidden sm:inline">Installed</span>
            <span className="sm:hidden">All</span>
            <span className="ml-1">({filteredPackages.length})</span>
          </TabsTrigger>
          <TabsTrigger value="outdated" className="flex items-center gap-1 sm:gap-2 text-[11px] sm:text-[13px] min-h-[44px] sm:min-h-0" data-testid="tab-outdated">
            Outdated
            {outdatedPackages.length > 0 && (
              <Badge variant="secondary" className="text-[11px]">{outdatedPackages.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vulnerabilities" className="flex items-center gap-1 sm:gap-2 text-[11px] sm:text-[13px] min-h-[44px] sm:min-h-0" data-testid="tab-vulnerabilities">
            <span className="hidden sm:inline">Vulnerabilities</span>
            <span className="sm:hidden">Vuln</span>
            {vulnerablePackages.length > 0 && (
              <Badge variant="destructive" className="text-[11px]">{vulnerablePackages.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-4 mt-4">
          {filteredPackages.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-[15px] font-semibold mb-2">No packages found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? `No packages match "${searchQuery}"` : "Install your first package to get started"}
                </p>
                <Button onClick={() => setShowInstallDialog(true)} data-testid="button-install-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Install Package
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredPackages.map((pkg) => (
                <PackageCard
                  key={`${pkg.type}-${pkg.name}`}
                  pkg={pkg}
                  onUpdate={() => updatePackageMutation.mutate({ name: pkg.name, version: pkg.latestVersion })}
                  onRemove={() => removePackageMutation.mutate(pkg.name)}
                  onViewDetails={() => setSelectedPackage(pkg)}
                  isUpdating={updatePackageMutation.isPending}
                  isRemoving={removePackageMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outdated" className="space-y-4 mt-4">
          {outdatedPackages.length > 0 ? (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Updates Available</AlertTitle>
                <AlertDescription>
                  {outdatedPackages.length} package(s) have updates available. 
                  Review changes before updating to ensure compatibility.
                </AlertDescription>
              </Alert>
              <div className="grid gap-4">
                {outdatedPackages.map((pkg) => (
                  <Card key={`${pkg.type}-${pkg.name}`} className="border-yellow-200 dark:border-yellow-800" data-testid={`card-outdated-${pkg.name}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-[15px] flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {pkg.name}
                            <Badge variant="outline">{pkg.type.toUpperCase()}</Badge>
                          </CardTitle>
                          <CardDescription>{pkg.description}</CardDescription>
                        </div>
                        <Button
                          onClick={() => updatePackageMutation.mutate({ 
                            name: pkg.name, 
                            version: pkg.latestVersion 
                          })}
                          disabled={updatePackageMutation.isPending}
                          data-testid={`button-update-${pkg.name}`}
                        >
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Update
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-8 text-[13px]">
                        <div>
                          <p className="text-muted-foreground">Current</p>
                          <p className="font-mono font-medium text-yellow-600">{pkg.installedVersion}</p>
                        </div>
                        <ArrowUp className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Latest</p>
                          <p className="font-mono font-medium text-green-600">{pkg.latestVersion}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-[15px] font-semibold mb-2">All packages are up to date!</h3>
                <p className="text-muted-foreground">
                  Your project dependencies are current with the latest versions.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vulnerabilities" className="space-y-4 mt-4">
          {vulnerablePackages.length > 0 ? (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Security Vulnerabilities Detected</AlertTitle>
                <AlertDescription>
                  {vulnerablePackages.length} package(s) have known security vulnerabilities. 
                  Update these packages immediately to protect your application.
                </AlertDescription>
              </Alert>
              <div className="grid gap-4">
                {vulnerablePackages.map((pkg) => (
                  <Card key={`${pkg.type}-${pkg.name}`} className="border-red-200 dark:border-red-800" data-testid={`card-vulnerable-${pkg.name}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-[15px] flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                            {pkg.name}
                            <Badge variant="outline">{pkg.type.toUpperCase()}</Badge>
                          </CardTitle>
                          <CardDescription>{pkg.description}</CardDescription>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => updatePackageMutation.mutate({ 
                            name: pkg.name, 
                            version: pkg.latestVersion 
                          })}
                          disabled={updatePackageMutation.isPending}
                          data-testid={`button-fix-${pkg.name}`}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Fix Vulnerability
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-center mb-4">
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950">
                          <p className="text-2xl font-bold text-red-600">{pkg.vulnerabilities?.critical || 0}</p>
                          <p className="text-[11px] text-muted-foreground">Critical</p>
                        </div>
                        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950">
                          <p className="text-2xl font-bold text-orange-600">{pkg.vulnerabilities?.high || 0}</p>
                          <p className="text-[11px] text-muted-foreground">High</p>
                        </div>
                        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                          <p className="text-2xl font-bold text-yellow-600">{pkg.vulnerabilities?.medium || 0}</p>
                          <p className="text-[11px] text-muted-foreground">Medium</p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                          <p className="text-2xl font-bold text-blue-600">{pkg.vulnerabilities?.low || 0}</p>
                          <p className="text-[11px] text-muted-foreground">Low</p>
                        </div>
                      </div>
                      <p className="text-[13px] text-muted-foreground">
                        Current: <span className="font-mono text-red-600">{pkg.installedVersion}</span> → 
                        Fixed in: <span className="font-mono text-green-600">{pkg.latestVersion}</span>
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-[15px] font-semibold mb-2">No vulnerabilities found</h3>
                <p className="text-muted-foreground mb-4">
                  All your packages are secure. Last scan: {stats?.lastScan || 'Never'}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => runSecurityScanMutation.mutate(undefined)}
                  disabled={runSecurityScanMutation.isPending}
                  data-testid="button-rescan"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", runSecurityScanMutation.isPending && "animate-spin")} />
                  Run New Scan
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showLockFileDialog} onOpenChange={setShowLockFileDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Lock File Viewer
            </DialogTitle>
            <DialogDescription>
              View resolved package versions and integrity hashes
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] rounded-lg border bg-muted/50 p-4">
            <pre className="text-[13px] font-mono">
              {lockFile.length > 0 ? JSON.stringify(lockFile, null, 2) : 'No lock file data available'}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                if (lockFile.length > 0) {
                  copyToClipboard(JSON.stringify(lockFile, null, 2));
                  toast({ title: "Copied", description: "Lock file copied to clipboard" });
                }
              }}
              disabled={lockFile.length === 0}
              data-testid="button-copy-lockfile"
            >
              {copiedText ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {selectedPackage?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedPackage?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p className="font-mono font-medium">{selectedPackage.installedVersion}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Latest</p>
                  <p className="font-mono font-medium">{selectedPackage.latestVersion}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">License</p>
                  <p className="font-medium">{selectedPackage.license || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Size</p>
                  <p className="font-medium">{selectedPackage.size || 'Unknown'}</p>
                </div>
              </div>
              {selectedPackage.keywords && selectedPackage.keywords.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-[13px] mb-2">Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPackage.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                {selectedPackage.homepage && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedPackage.homepage} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Homepage
                    </a>
                  </Button>
                )}
                {selectedPackage.repository && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedPackage.repository} target="_blank" rel="noopener noreferrer">
                      <GitBranch className="h-4 w-4 mr-2" />
                      Repository
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

interface PackageCardProps {
  pkg: PackageInfo;
  onUpdate: () => void;
  onRemove: () => void;
  onViewDetails: () => void;
  isUpdating: boolean;
  isRemoving: boolean;
}

function PackageCard({ pkg, onUpdate, onRemove, onViewDetails, isUpdating, isRemoving }: PackageCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-package-${pkg.name}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <Package className="h-4 w-4" />
              {pkg.name}
              <Badge variant="outline" className="text-[11px]">
                {pkg.type.toUpperCase()}
              </Badge>
              {pkg.isDev && (
                <Badge variant="secondary" className="text-[11px]">DEV</Badge>
              )}
              {pkg.vulnerabilities && (
                <Badge variant="destructive" className="text-[11px]">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Vulnerable
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">{pkg.description}</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onViewDetails} data-testid={`button-details-${pkg.name}`}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onRemove}
              disabled={isRemoving}
              data-testid={`button-remove-${pkg.name}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
          <div>
            <p className="text-muted-foreground">Installed</p>
            <p className="font-mono font-medium">{pkg.installedVersion}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Latest</p>
            <p className={cn("font-mono font-medium", pkg.hasUpdate && "text-yellow-600")}>
              {pkg.latestVersion}
              {pkg.hasUpdate && <Badge variant="secondary" className="ml-2 text-[11px]">Update</Badge>}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">License</p>
            <p className="font-medium">{pkg.license || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Size</p>
            <p className="font-medium">{pkg.size || 'Unknown'}</p>
          </div>
        </div>
        {pkg.hasUpdate && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button size="sm" onClick={onUpdate} disabled={isUpdating} data-testid={`button-update-${pkg.name}`}>
              <ArrowUp className="h-4 w-4 mr-2" />
              Update to {pkg.latestVersion}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
