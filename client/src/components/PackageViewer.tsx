import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Package, 
  Search, 
  RefreshCw, 
  Plus,
  Trash2,
  ExternalLink,
  Info,
  AlertCircle,
  CheckCircle,
  Download,
  Loader2,
  Code2,
  FileText,
  GitBranch,
  Calendar,
  User
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  lastUpdated?: string;
  size?: string;
  author?: string;
}

interface SystemPackage {
  name: string;
  version: string;
  description?: string;
}

export function PackageViewer({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [activeTab, setActiveTab] = useState('installed');

  // Fetch installed packages
  const { data: installedPackages, isLoading: isLoadingPackages } = useQuery<PackageInfo[]>({
    queryKey: [`/api/projects/${projectId}/packages`],
    enabled: !!projectId
  });

  // Fetch system packages
  const { data: systemPackages } = useQuery<SystemPackage[]>({
    queryKey: [`/api/projects/${projectId}/packages/system`],
    enabled: !!projectId
  });

  // Fetch package details
  const { data: packageDetails, isLoading: isLoadingDetails } = useQuery<PackageInfo>({
    queryKey: [`/api/projects/${projectId}/packages/${selectedPackage}`],
    enabled: !!selectedPackage
  });

  // Search packages
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: [`/api/projects/${projectId}/packages/search`, searchTerm],
    enabled: searchTerm.length > 2 && activeTab === 'search',
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/packages/search?q=${searchTerm}`);
      if (!response.ok) throw new Error('Failed to search packages');
      return response.json();
    }
  });

  // Install package mutation
  const installPackageMutation = useMutation({
    mutationFn: async (packageName: string) => {
      const response = await fetch(`/api/projects/${projectId}/packages/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: packageName })
      });
      if (!response.ok) throw new Error('Failed to install package');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Package installed",
        description: "The package has been installed successfully"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/packages`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Installation failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Uninstall package mutation
  const uninstallPackageMutation = useMutation({
    mutationFn: async (packageName: string) => {
      const response = await fetch(`/api/projects/${projectId}/packages/uninstall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: packageName })
      });
      if (!response.ok) throw new Error('Failed to uninstall package');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Package uninstalled",
        description: "The package has been removed successfully"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/packages`] });
      setSelectedPackage('');
    },
    onError: (error: Error) => {
      toast({
        title: "Uninstall failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const filteredPackages = installedPackages?.filter(pkg => 
    pkg.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">Package Manager</CardTitle>
              <CardDescription>
                Manage project dependencies and system packages
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/packages`] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <div className="flex-1 flex">
        {/* Package List Sidebar */}
        <div className="w-80 border-r bg-muted/10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-4">
              <TabsTrigger value="installed" className="flex-1">Installed</TabsTrigger>
              <TabsTrigger value="search" className="flex-1">Search</TabsTrigger>
              <TabsTrigger value="system" className="flex-1">System</TabsTrigger>
            </TabsList>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={activeTab === 'search' ? "Search npm packages..." : "Filter packages..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2">
                <TabsContent value="installed" className="m-0">
                  {isLoadingPackages ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredPackages.length > 0 ? (
                    filteredPackages.map((pkg) => (
                      <button
                        key={pkg.name}
                        onClick={() => setSelectedPackage(pkg.name)}
                        className={`w-full text-left p-3 rounded-md mb-1 transition-colors ${
                          selectedPackage === pkg.name
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{pkg.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {pkg.version}
                            </Badge>
                          </div>
                          {pkg.description && (
                            <p className="text-xs opacity-80 line-clamp-2">{pkg.description}</p>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No packages installed</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="search" className="m-0">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults && searchResults.results && searchResults.results.length > 0 ? (
                    searchResults.results.map((pkg: any) => (
                      <div
                        key={pkg.name}
                        className="p-3 rounded-md mb-1 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{pkg.name}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => installPackageMutation.mutate(pkg.name)}
                            disabled={installPackageMutation.isPending}
                          >
                            {installPackageMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{pkg.version}</span>
                          <span>•</span>
                          <span>{pkg.downloads} downloads</span>
                        </div>
                      </div>
                    ))
                  ) : searchTerm.length > 2 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No packages found</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Type to search npm packages</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="system" className="m-0">
                  {systemPackages?.map((pkg) => (
                    <div
                      key={pkg.name}
                      className="p-3 rounded-md mb-1 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{pkg.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {pkg.version}
                        </Badge>
                      </div>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                      )}
                    </div>
                  ))}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Package Details */}
        <div className="flex-1 overflow-auto">
          {selectedPackage && packageDetails ? (
            <div className="p-6 space-y-6">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{packageDetails.name}</h2>
                    <p className="text-muted-foreground mt-1">{packageDetails.description}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => uninstallPackageMutation.mutate(packageDetails.name)}
                    disabled={uninstallPackageMutation.isPending}
                  >
                    {uninstallPackageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Uninstall
                  </Button>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Code2 className="h-4 w-4" />
                    <span>v{packageDetails.version}</span>
                  </div>
                  {packageDetails.license && (
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{packageDetails.license}</span>
                    </div>
                  )}
                  {packageDetails.size && (
                    <div className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      <span>{packageDetails.size}</span>
                    </div>
                  )}
                  {packageDetails.lastUpdated && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Updated {packageDetails.lastUpdated}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {packageDetails.homepage && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={packageDetails.homepage} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Homepage
                      </a>
                    </Button>
                  )}
                  {packageDetails.repository && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={packageDetails.repository} target="_blank" rel="noopener noreferrer">
                        <GitBranch className="h-4 w-4 mr-1" />
                        Repository
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Dependencies */}
              {packageDetails.dependencies && Object.keys(packageDetails.dependencies).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Dependencies</h3>
                  <div className="space-y-2">
                    {Object.entries(packageDetails.dependencies).map(([name, version]) => (
                      <div key={name} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <span className="text-sm font-mono">{name}</span>
                        <Badge variant="outline" className="text-xs">{version}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dev Dependencies */}
              {packageDetails.devDependencies && Object.keys(packageDetails.devDependencies).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Dev Dependencies</h3>
                  <div className="space-y-2">
                    {Object.entries(packageDetails.devDependencies).map(([name, version]) => (
                      <div key={name} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <span className="text-sm font-mono">{name}</span>
                        <Badge variant="outline" className="text-xs">{version}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isLoadingDetails ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p>Select a package to view details</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}