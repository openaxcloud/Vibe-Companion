import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Puzzle, 
  Search, 
  Download, 
  Star, 
  DownloadCloud, 
  RefreshCcw, 
  Trash2,
  Loader2,
  AlertCircle,
  Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ExtensionsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number;
}

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

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg bg-muted animate-pulse", className)} />
  );
}

export function ExtensionsManager({ isOpen, onClose, projectId }: ExtensionsManagerProps) {
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

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
    enabled: isOpen,
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
    enabled: isOpen && !!projectId,
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
        title: "Extension installed",
        description: `${extension.name} has been installed and enabled`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extensions', projectId, 'installed'] });
    },
    onError: (error: any, extension) => {
      toast({
        title: "Installation failed",
        description: error.message || `Failed to install ${extension.name}`,
        variant: "destructive",
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
        title: "Extension uninstalled",
        description: "Extension has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extensions', projectId, 'installed'] });
    },
    onError: (error: any) => {
      toast({
        title: "Uninstall failed",
        description: error.message || "Failed to uninstall extension",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ extensionId, enabled }: { extensionId: string; enabled: boolean }) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('PATCH', `/api/extensions/${projectId}/${extensionId}`, {
        enabled,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.enabled ? "Extension enabled" : "Extension disabled",
        description: `${data.name} has been ${data.enabled ? "enabled" : "disabled"}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extensions', projectId, 'installed'] });
    },
    onError: (error: any) => {
      toast({
        title: "Toggle failed",
        description: error.message || "Failed to toggle extension",
        variant: "destructive",
      });
    },
  });

  const installedExtensionIds = new Set(installedExtensions.map(ext => ext.extensionId));

  const marketplaceExtensions = marketplaceData?.extensions || [];

  const filteredMarketplace = marketplaceExtensions.filter(ext => 
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInstalled = installedExtensions.filter(ext => 
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ext.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleInstall = (extension: MarketplaceExtension) => {
    installMutation.mutate(extension);
  };

  const handleUninstall = (extensionId: string) => {
    uninstallMutation.mutate(extensionId);
  };

  const handleToggle = (extensionId: string, currentEnabled: boolean) => {
    toggleMutation.mutate({ extensionId, enabled: !currentEnabled });
  };

  const isLoading = isLoadingMarketplace || isLoadingInstalled;
  const isMutating = installMutation.isPending || uninstallMutation.isPending || toggleMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[700px] max-h-[90vh] h-[600px] flex flex-col overflow-hidden"
        data-testid="extensions-manager-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            Extensions Manager
          </DialogTitle>
          <DialogDescription>
            Browse, install, and manage extensions to enhance your IDE experience.
          </DialogDescription>
        </DialogHeader>

        {!projectId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center" data-testid="extensions-manager-no-project">
            <Package className="h-12 w-12 mb-4 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Select a project to manage extensions</p>
          </div>
        ) : (
          <>
            <div className="relative flex items-center mb-4">
              <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search extensions..." 
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-extensions"
              />
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => { refetchMarketplace(); refetchInstalled(); }}
                disabled={isLoading}
                data-testid="button-refresh-extensions"
              >
                <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="browse" data-testid="tab-browse">Browse</TabsTrigger>
                <TabsTrigger value="installed" data-testid="tab-installed">
                  Installed ({installedExtensions.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="browse" className="flex-1 overflow-auto">
                {isLoadingMarketplace ? (
                  <div className="space-y-4 py-2">
                    {[1, 2, 3].map(i => (
                      <ShimmerSkeleton key={i} className="h-24 w-full" />
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
                ) : filteredMarketplace.length === 0 ? (
                  <div className="text-center py-8" data-testid="browse-empty">
                    <p className="text-muted-foreground">
                      {searchQuery ? `No extensions found matching "${searchQuery}"` : "No extensions available"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    {filteredMarketplace.map(ext => {
                      const isInstalled = installedExtensionIds.has(ext.extensionId);
                      const isPending = (installMutation.isPending && installMutation.variables?.extensionId === ext.extensionId) ||
                        (uninstallMutation.isPending && uninstallMutation.variables === ext.extensionId);

                      return (
                        <Card key={ext.extensionId} className="overflow-hidden" data-testid={`browse-extension-${ext.extensionId}`}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                                  <span className="break-all">{ext.name}</span>
                                  {isInstalled && (
                                    <Badge variant="outline">Installed</Badge>
                                  )}
                                </CardTitle>
                                <CardDescription className="line-clamp-2">{ext.description}</CardDescription>
                              </div>
                              
                              {isInstalled ? (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="ml-2"
                                  onClick={() => handleUninstall(ext.extensionId)}
                                  disabled={isMutating}
                                  data-testid={`button-uninstall-browse-${ext.extensionId}`}
                                >
                                  {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="ml-2"
                                  onClick={() => handleInstall(ext)}
                                  disabled={isMutating}
                                  data-testid={`button-install-${ext.extensionId}`}
                                >
                                  {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <DownloadCloud className="h-4 w-4 mr-1" /> Install
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          
                          <CardFooter className="py-2 text-[11px] text-muted-foreground border-t flex justify-between">
                            <div>
                              {ext.author} • v{ext.version}
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className="flex items-center">
                                <Star className="h-3 w-3 mr-1" /> {ext.category}
                              </span>
                              <span className="flex items-center">
                                <Download className="h-3 w-3 mr-1" /> {ext.category}
                              </span>
                            </div>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="installed" className="flex-1 overflow-auto">
                {isLoadingInstalled ? (
                  <div className="space-y-4 py-2">
                    {[1, 2, 3].map(i => (
                      <ShimmerSkeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : filteredInstalled.length === 0 ? (
                  <div className="text-center py-8" data-testid="installed-empty">
                    <p className="text-muted-foreground">
                      {searchQuery ? `No installed extensions matching "${searchQuery}"` : "No extensions installed"}
                    </p>
                    {!searchQuery && (
                      <Button 
                        variant="outline" 
                        className="mt-4" 
                        onClick={() => setActiveTab("browse")}
                        data-testid="button-browse-from-installed"
                      >
                        Browse Extensions
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    {filteredInstalled.map(ext => {
                      const isToggling = toggleMutation.isPending && toggleMutation.variables?.extensionId === ext.extensionId;
                      const isUninstalling = uninstallMutation.isPending && uninstallMutation.variables === ext.extensionId;

                      return (
                        <Card key={ext.extensionId} data-testid={`installed-extension-${ext.extensionId}`}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-base break-all">{ext.name}</CardTitle>
                                <CardDescription className="line-clamp-2">{ext.description}</CardDescription>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                {isToggling ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Switch 
                                    id={`ext-toggle-${ext.extensionId}`} 
                                    checked={ext.enabled}
                                    onCheckedChange={() => handleToggle(ext.extensionId, ext.enabled)}
                                    disabled={isMutating}
                                    data-testid={`switch-toggle-${ext.extensionId}`}
                                  />
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleUninstall(ext.extensionId)}
                                  disabled={isMutating}
                                  data-testid={`button-uninstall-${ext.extensionId}`}
                                >
                                  {isUninstalling ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardFooter className="py-2 text-[11px] text-muted-foreground border-t">
                            <div>
                              {ext.author} • v{ext.version} • {ext.category}
                            </div>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
        
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-close-extensions-manager">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
