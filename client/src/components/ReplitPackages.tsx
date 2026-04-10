import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, Plus, Search, Download, Trash2, 
  CheckCircle, AlertCircle, Clock, RefreshCw,
  Terminal, Code, Settings, Star, TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PackageInfo {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  size?: string;
  downloads?: number;
  stars?: number;
  lastUpdated?: Date;
  status: 'installed' | 'available' | 'outdated';
  category: 'dependency' | 'devDependency' | 'system';
}

interface ReplitPackagesProps {
  projectId: number;
}

export function ReplitPackages({ projectId }: ReplitPackagesProps) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [searchResults, setSearchResults] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState<string[]>([]);
  const [showInstallDialog, setShowInstallDialog] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, [projectId]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/packages/${projectId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast({
        title: "Error",
        description: "Failed to fetch packages",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const searchPackages = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await fetch(`/api/packages/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.packages || []);
      }
    } catch (error) {
      console.error('Error searching packages:', error);
      toast({
        title: "Search Error",
        description: "Failed to search packages",
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const installPackage = async (packageName: string, version?: string) => {
    try {
      setInstalling(prev => [...prev, packageName]);
      
      const response = await apiRequest('POST', `/api/packages/${projectId}`, { 
        name: packageName,
        version: version || 'latest'
      });

      if (response.ok) {
        toast({
          title: "Package Installed",
          description: `${packageName} has been installed successfully`
        });
        fetchPackages();
      } else {
        const error = await response.json();
        toast({
          title: "Installation Failed",
          description: error.message || "Failed to install package",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to install package",
        variant: "destructive"
      });
    } finally {
      setInstalling(prev => prev.filter(p => p !== packageName));
    }
  };

  const uninstallPackage = async (packageName: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/packages/${projectId}/${encodeURIComponent(packageName)}`);

      if (response.ok) {
        toast({
          title: "Package Removed",
          description: `${packageName} has been uninstalled`
        });
        fetchPackages();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to uninstall package",
        variant: "destructive"
      });
    }
  };

  const updateAllPackages = async () => {
    try {
      const response = await apiRequest('POST', `/api/packages/${projectId}/update`);

      if (response.ok) {
        toast({
          title: "Packages Updated",
          description: "All packages have been updated to their latest versions"
        });
        fetchPackages();
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update packages",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'installed': return 'text-green-600 bg-green-50 border-green-200';
      case 'outdated': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'available': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'installed': return <CheckCircle className="h-4 w-4" />;
      case 'outdated': return <AlertCircle className="h-4 w-4" />;
      case 'available': return <Download className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'dependency': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'devDependency': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'system': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const installedPackages = packages.filter(p => p.status === 'installed');
  const outdatedPackages = packages.filter(p => p.status === 'outdated');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Package Manager
          </h2>
          <p className="text-muted-foreground">
            Universal package management powered by Nix
          </p>
        </div>
        
        <div className="flex gap-2">
          {outdatedPackages.length > 0 && (
            <Button variant="outline" onClick={updateAllPackages}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Update All ({outdatedPackages.length})
            </Button>
          )}
          
          <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Install Package
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Install Package</DialogTitle>
                <DialogDescription>
                  Search and install packages from the Nix package repository
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for packages (e.g., react, express, numpy)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchPackages(e.target.value);
                    }}
                    className="pl-10"
                  />
                </div>
                
                {searching && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    <span className="ml-2 text-[13px]">Searching packages...</span>
                  </div>
                )}
                
                {searchResults.length > 0 && (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {searchResults.map((pkg) => (
                      <Card key={pkg.name} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{pkg.name}</span>
                              <Badge variant="outline" className="text-[11px]">
                                v{pkg.version}
                              </Badge>
                              {pkg.stars && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Star className="h-3 w-3" />
                                  {pkg.stars.toLocaleString()}
                                </div>
                              )}
                            </div>
                            <p className="text-[13px] text-muted-foreground">{pkg.description}</p>
                            {pkg.author && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                by {pkg.author}
                              </p>
                            )}
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={() => installPackage(pkg.name, pkg.version)}
                            disabled={installing.includes(pkg.name)}
                          >
                            {installing.includes(pkg.name) ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                                Installing
                              </>
                            ) : (
                              <>
                                <Download className="h-3 w-3 mr-1" />
                                Install
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="installed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="installed">
            Installed ({installedPackages.length})
          </TabsTrigger>
          <TabsTrigger value="outdated">
            Outdated ({outdatedPackages.length})
          </TabsTrigger>
          <TabsTrigger value="info">
            Package Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-4">
          {installedPackages.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No packages installed</h3>
                <p className="text-muted-foreground mb-4">
                  Install your first package to get started
                </p>
                <Button onClick={() => setShowInstallDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Install Package
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {installedPackages.map((pkg) => (
                <Card key={pkg.name} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Package className="h-4 w-4" />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{pkg.name}</span>
                          <Badge variant="outline">v{pkg.version}</Badge>
                          <Badge className={`${getCategoryColor(pkg.category)} border text-[11px]`}>
                            {pkg.category === 'devDependency' ? 'dev' : pkg.category}
                          </Badge>
                        </div>
                        
                        <p className="text-[13px] text-muted-foreground mb-1">
                          {pkg.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                          {pkg.size && (
                            <span>Size: {pkg.size}</span>
                          )}
                          {pkg.license && (
                            <span>License: {pkg.license}</span>
                          )}
                          {pkg.lastUpdated && (
                            <span>Updated: {new Date(pkg.lastUpdated).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => uninstallPackage(pkg.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="outdated" className="space-y-4">
          {outdatedPackages.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                <p className="text-muted-foreground">All packages are up to date!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {outdatedPackages.map((pkg) => (
                <Card key={pkg.name} className="p-4 border-orange-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{pkg.name}</span>
                          <Badge variant="outline">v{pkg.version}</Badge>
                          <Badge className="text-orange-600 bg-orange-50 border-orange-200">
                            Update available
                          </Badge>
                        </div>
                        <p className="text-[13px] text-muted-foreground">{pkg.description}</p>
                      </div>
                    </div>
                    
                    <Button 
                      size="sm"
                      onClick={() => installPackage(pkg.name, 'latest')}
                      disabled={installing.includes(pkg.name)}
                    >
                      {installing.includes(pkg.name) ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                          Updating
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Update
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Universal Package Management</CardTitle>
              <CardDescription>
                E-Code uses Nix for reproducible, instant package management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <Terminal className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <h3 className="font-semibold">Universal</h3>
                  <p className="text-[13px] text-muted-foreground">
                    Install packages for any language
                  </p>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <h3 className="font-semibold">Instant</h3>
                  <p className="text-[13px] text-muted-foreground">
                    No download or compile time
                  </p>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <RefreshCw className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <h3 className="font-semibold">Reproducible</h3>
                  <p className="text-[13px] text-muted-foreground">
                    Same versions everywhere
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Supported Languages</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Python', 'Node.js', 'Go', 'Rust', 'Java', 'C++', 
                    'Ruby', 'PHP', 'Haskell', 'Scala', 'Kotlin', 'Swift'
                  ].map((lang) => (
                    <Badge key={lang} variant="outline">{lang}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="text-[13px] text-muted-foreground space-y-1">
                  <li>• Atomic package operations - no broken environments</li>
                  <li>• Rollback to previous environments instantly</li>
                  <li>• Zero package conflicts with isolated environments</li>
                  <li>• Export environments as shell.nix files</li>
                  <li>• Shared package store reduces disk usage</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}