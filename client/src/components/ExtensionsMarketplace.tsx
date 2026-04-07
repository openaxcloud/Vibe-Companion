import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  Search,
  Download,
  Star,
  TrendingUp,
  Code,
  Palette,
  Terminal,
  Zap,
  Shield,
  Globe,
  Settings,
  Check,
  ExternalLink,
  User,
  Tag,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface MarketplaceExtension {
  extensionId: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  icon: string;
}

interface InstalledExtension {
  id: number;
  projectId: number;
  extensionId: string;
  name: string;
  description: string | null;
  author: string | null;
  version: string | null;
  category: string | null;
  icon: string | null;
  enabled: boolean;
}

interface MarketplaceResponse {
  extensions: MarketplaceExtension[];
  categories: string[];
}

interface ExtensionsMarketplaceProps {
  projectId?: number;
  className?: string;
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg bg-muted animate-pulse", className)} />
  );
}

const categoryIcons: Record<string, typeof Package> = {
  all: Package,
  themes: Palette,
  languages: Code,
  tools: Terminal,
  formatters: Zap,
  linters: Shield,
  snippets: Globe,
};

export function ExtensionsMarketplace({ projectId, className }: ExtensionsMarketplaceProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: marketplaceData, isLoading: isLoadingMarketplace, error: marketplaceError, refetch: refetchMarketplace } = useQuery<MarketplaceResponse>({
    queryKey: ['/api/extensions/marketplace'],
    queryFn: async () => {
      const response = await fetch('/api/extensions/marketplace', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch marketplace extensions');
      }
      return response.json();
    },
    staleTime: 60000,
  });

  const { data: installedExtensions = [], isLoading: isLoadingInstalled, refetch: refetchInstalled } = useQuery<InstalledExtension[]>({
    queryKey: ['/api/extensions', projectId, 'installed'],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await fetch(`/api/extensions/${projectId}/installed`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch installed extensions');
      }
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const installMutation = useMutation({
    mutationFn: async (extension: MarketplaceExtension) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('POST', `/api/extensions/${projectId}/install`, {
        extensionId: extension.extensionId,
        name: extension.name,
        description: extension.description,
        author: extension.author,
        version: extension.version,
        category: extension.category,
        icon: extension.icon,
      });
      return response.json();
    },
    onSuccess: (_, extension) => {
      toast({
        title: 'Extension installed',
        description: `${extension.name} has been installed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extensions', projectId, 'installed'] });
    },
    onError: (error: any, extension) => {
      toast({
        title: 'Installation failed',
        description: error.message || `Failed to install ${extension.name}`,
        variant: 'destructive',
      });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async (extensionId: string) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('DELETE', `/api/extensions/${projectId}/${extensionId}`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Extension uninstalled',
        description: 'Extension has been removed successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extensions', projectId, 'installed'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Uninstall failed',
        description: error.message || 'Failed to uninstall extension',
        variant: 'destructive',
      });
    },
  });

  const installedExtensionIds = new Set(installedExtensions.map(ext => ext.extensionId));

  const extensions = marketplaceData?.extensions || [];
  const categories = [
    { id: 'all', label: 'All' },
    ...(marketplaceData?.categories || []).map(cat => ({ id: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) }))
  ];

  const filteredExtensions = extensions.filter((ext) => {
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ext.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleInstallToggle = (extension: MarketplaceExtension) => {
    const isInstalled = installedExtensionIds.has(extension.extensionId);
    if (isInstalled) {
      uninstallMutation.mutate(extension.extensionId);
    } else {
      installMutation.mutate(extension);
    }
  };

  const isLoading = isLoadingMarketplace || isLoadingInstalled;
  const isMutating = installMutation.isPending || uninstallMutation.isPending;

  if (!projectId) {
    return (
      <Card className={cn("h-full", className)} data-testid="extensions-marketplace-no-project">
        <CardContent className="flex flex-col items-center justify-center h-full p-8">
          <Package className="h-12 w-12 mb-4 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">Select a project to browse extensions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("h-full", className)} data-testid="extensions-marketplace">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Extensions Marketplace
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => { refetchMarketplace(); refetchInstalled(); }}
            disabled={isLoading}
            data-testid="button-refresh-marketplace"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search extensions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-extensions"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => {
              const Icon = categoryIcons[category.id] || Package;
              return (
                <Button
                  key={category.id}
                  size="sm"
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex-shrink-0"
                  data-testid={`button-category-${category.id}`}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {category.label}
                </Button>
              );
            })}
          </div>

          <Separator />

          <ScrollArea className="h-[calc(100vh-20rem)]">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <ShimmerSkeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : marketplaceError ? (
              <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="marketplace-error">
                <AlertCircle className="h-12 w-12 mb-3 text-red-500 opacity-40" />
                <p className="text-muted-foreground mb-2">Failed to load extensions</p>
                <Button 
                  variant="link" 
                  onClick={() => refetchMarketplace()}
                  data-testid="button-retry-marketplace"
                >
                  Try again
                </Button>
              </div>
            ) : filteredExtensions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="marketplace-empty">
                <Package className="h-12 w-12 mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">
                  {searchQuery ? `No extensions found matching "${searchQuery}"` : 'No extensions available'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredExtensions.map((extension) => {
                  const isInstalled = installedExtensionIds.has(extension.extensionId);
                  const isPending = (installMutation.isPending && installMutation.variables?.extensionId === extension.extensionId) ||
                    (uninstallMutation.isPending && uninstallMutation.variables === extension.extensionId);

                  return (
                    <div
                      key={extension.extensionId}
                      className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      data-testid={`extension-card-${extension.extensionId}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3 flex-1">
                          <div className="text-2xl">
                            {extension.icon === 'palette' && '🎨'}
                            {extension.icon === 'code' && '💻'}
                            {extension.icon === 'git-branch' && '🔀'}
                            {extension.icon === 'box' && '📦'}
                            {extension.icon === 'wand' && '✨'}
                            {extension.icon === 'check-circle' && '✅'}
                            {extension.icon === 'file-code' && '📄'}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[13px] font-medium">{extension.name}</h4>
                              {isInstalled && (
                                <Badge variant="secondary" className="text-[11px]">
                                  Installed
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {extension.description}
                            </p>
                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {extension.author}
                              </div>
                              <div className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                v{extension.version}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={isInstalled ? 'outline' : 'default'}
                            onClick={() => handleInstallToggle(extension)}
                            disabled={isMutating}
                            data-testid={`button-install-${extension.extensionId}`}
                          >
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isInstalled ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Installed
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-1" />
                                Install
                              </>
                            )}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            data-testid={`button-details-${extension.extensionId}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {!isLoading && !marketplaceError && extensions.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[13px] font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Featured Extensions
              </h3>
              <div className="grid gap-2">
                {extensions.slice(0, 3).map((extension) => {
                  const isInstalled = installedExtensionIds.has(extension.extensionId);
                  return (
                    <div
                      key={extension.extensionId}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                      data-testid={`featured-extension-${extension.extensionId}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[15px]">
                          {extension.icon === 'palette' && '🎨'}
                          {extension.icon === 'code' && '💻'}
                          {extension.icon === 'git-branch' && '🔀'}
                        </span>
                        <div>
                          <p className="text-[13px] font-medium">{extension.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            by {extension.author}
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleInstallToggle(extension)}
                        disabled={isMutating}
                        data-testid={`button-featured-install-${extension.extensionId}`}
                      >
                        {isInstalled ? 'Installed' : 'Install'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
