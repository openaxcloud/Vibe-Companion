import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Package, Settings, Cpu, HardDrive, Network, Shield, 
  AlertCircle, CheckCircle, RefreshCw, FileText, Plus,
  Trash2, Edit, Save, X, Search, Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NixPackage {
  name: string;
  version: string;
  description: string;
  installed: boolean;
}

interface NixChannel {
  name: string;
  url: string;
  active: boolean;
}

export function NixConfig({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [customConfig, setCustomConfig] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Fetch Nix packages
  const { data: packages = [] } = useQuery<NixPackage[]>({
    queryKey: ['/api/nix', projectId, 'packages'],
    queryFn: async () => {
      const response = await fetch(`/api/nix/${projectId}/packages`);
      if (!response.ok) throw new Error('Failed to fetch packages');
      return response.json();
    }
  });

  // Fetch Nix channels
  const { data: channels = [] } = useQuery<NixChannel[]>({
    queryKey: ['/api/nix', projectId, 'channels'],
    queryFn: async () => {
      const response = await fetch(`/api/nix/${projectId}/channels`);
      if (!response.ok) throw new Error('Failed to fetch channels');
      return response.json();
    }
  });

  const defaultConfig = `{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.python311
    pkgs.postgresql_15
  ];
  
  env = {
    NODE_ENV = "development";
    DATABASE_URL = "postgresql://localhost:5432/myapp";
  };
}`;

  const handleInstallPackage = (pkg: NixPackage) => {
    toast({
      title: 'Installing package',
      description: `Installing ${pkg.name}@${pkg.version}...`
    });
  };

  const handleUninstallPackage = (pkg: NixPackage) => {
    toast({
      title: 'Uninstalling package',
      description: `Removing ${pkg.name}...`
    });
  };

  const handleSaveConfig = () => {
    setIsEditing(false);
    toast({
      title: 'Configuration saved',
      description: 'Your Nix configuration has been updated'
    });
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(customConfig || defaultConfig);
    toast({
      title: 'Copied to clipboard',
      description: 'Nix configuration copied to clipboard'
    });
  };

  const filteredPackages = packages.filter(pkg =>
    pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pkg.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Nix Configuration</h2>
        <p className="text-muted-foreground">
          Configure your development environment with Nix packages
        </p>
      </div>

      <Tabs defaultValue="packages">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Installed Packages</CardTitle>
              <CardDescription>
                Manage your project's Nix packages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {filteredPackages.map(pkg => (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{pkg.name}</p>
                            <Badge variant="outline" className="text-[11px]">
                              v{pkg.version}
                            </Badge>
                            {pkg.installed && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          <p className="text-[13px] text-muted-foreground">
                            {pkg.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={pkg.installed ? 'destructive' : 'default'}
                        onClick={() => pkg.installed ? handleUninstallPackage(pkg) : handleInstallPackage(pkg)}
                      >
                        {pkg.installed ? (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Uninstall
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Install
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>replit.nix</CardTitle>
                  <CardDescription>
                    Edit your Nix configuration file
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyConfig}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveConfig}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={customConfig || defaultConfig}
                onChange={(e) => setCustomConfig(e.target.value)}
                readOnly={!isEditing}
                className="font-mono text-[13px] h-[400px]"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nix Channels</CardTitle>
              <CardDescription>
                Manage package sources and versions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {channels.map(channel => (
                  <div
                    key={channel.name}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Network className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{channel.name}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {channel.url}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {channel.active && (
                        <Badge variant="default">Active</Badge>
                      )}
                      <Switch checked={channel.active} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Environment Settings</CardTitle>
              <CardDescription>
                Configure Nix environment options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Pure Shell</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Isolate environment from host system
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto GC</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Automatically garbage collect unused packages
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Binary Cache</Label>
                    <p className="text-[13px] text-muted-foreground">
                      Use binary cache for faster installations
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Nix provides reproducible, declarative, and reliable systems
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}