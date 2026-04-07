import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Plus, Trash2, Search, Loader2, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  installed?: boolean;
}

interface PackageManagerProps {
  projectId: number;
  language: string;
}

export function PackageManager({ projectId, language }: PackageManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('installed');

  // Get installed packages
  const { data: installedPackages = [], isLoading: isLoadingInstalled } = useQuery({
    queryKey: ['/api/projects', projectId, 'packages'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/packages`);
      return res.json();
    },
  });

  // Search packages
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['/api/packages/search', searchQuery, language],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/packages/search?q=${searchQuery}&language=${language}`);
      return res.json();
    },
    enabled: searchQuery.length > 2 && selectedTab === 'search',
  });

  // Install package
  const installPackageMutation = useMutation({
    mutationFn: async (packageName: string) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/packages`, {
        name: packageName,
        language,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'packages'] });
      toast({
        title: 'Package installed',
        description: `Successfully installed ${data.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Installation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Uninstall package
  const uninstallPackageMutation = useMutation({
    mutationFn: async (packageName: string) => {
      const res = await apiRequest('DELETE', `/api/projects/${projectId}/packages/${packageName}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'packages'] });
      toast({
        title: 'Package uninstalled',
        description: `Successfully removed ${data.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Uninstall failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getPackageManagerName = () => {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 'npm';
      case 'python':
        return 'pip';
      case 'ruby':
        return 'gem';
      case 'rust':
        return 'cargo';
      case 'go':
        return 'go';
      default:
        return 'package';
    }
  };

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <CardTitle>Package Manager</CardTitle>
        </div>
        <CardDescription>
          Manage {getPackageManagerName()} packages for your {language} project
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="h-full">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="installed" className="flex-1">
              Installed ({installedPackages.length})
            </TabsTrigger>
            <TabsTrigger value="search" className="flex-1">
              Search Packages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="installed" className="m-0 h-[calc(100%-40px)]">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {isLoadingInstalled ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : installedPackages.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      No packages installed yet. Search and install packages from the search tab.
                    </p>
                  </div>
                ) : (
                  installedPackages.map((pkg: PackageInfo) => (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{pkg.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {pkg.version}
                          </Badge>
                        </div>
                        {pkg.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => uninstallPackageMutation.mutate(pkg.name)}
                        disabled={uninstallPackageMutation.isPending}
                      >
                        {uninstallPackageMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="search" className="m-0 h-[calc(100%-40px)]">
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${getPackageManagerName()} packages...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[calc(100%-60px)]">
                <div className="space-y-2">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchQuery.length <= 2 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Type at least 3 characters to search for packages
                    </p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No packages found for "{searchQuery}"
                    </p>
                  ) : (
                    searchResults.map((pkg: PackageInfo) => {
                      const isInstalled = installedPackages.some(
                        (installed: PackageInfo) => installed.name === pkg.name
                      );
                      return (
                        <div
                          key={pkg.name}
                          className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{pkg.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {pkg.version}
                              </Badge>
                              {isInstalled && (
                                <Badge variant="secondary" className="text-xs">
                                  Installed
                                </Badge>
                              )}
                            </div>
                            {pkg.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {pkg.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a
                                href={`https://www.npmjs.com/package/${pkg.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => installPackageMutation.mutate(pkg.name)}
                              disabled={isInstalled || installPackageMutation.isPending}
                            >
                              {installPackageMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                              {isInstalled ? 'Installed' : 'Install'}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}