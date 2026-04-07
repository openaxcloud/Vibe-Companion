import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Puzzle, 
  Search, 
  Download, 
  Star, 
  DownloadCloud, 
  RefreshCcw, 
  Check, 
  Settings, 
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExtensionsManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  stars: number;
  downloads: number;
  installed: boolean;
  enabled: boolean;
  category: "language" | "tool" | "theme" | "other";
}

export function ExtensionsManager({ isOpen, onClose }: ExtensionsManagerProps) {
  const [activeTab, setActiveTab] = useState("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  
  // Mock extensions data
  const [extensions, setExtensions] = useState<Extension[]>([
    {
      id: "1",
      name: "Python Language Support",
      description: "Advanced Python language features including linting, formatting, and intellisense",
      author: "PLOT Team",
      version: "1.2.0",
      stars: 1234,
      downloads: 45678,
      installed: true,
      enabled: true,
      category: "language"
    },
    {
      id: "2",
      name: "React Developer Tools",
      description: "Enhanced development experience for React applications",
      author: "Web Tools",
      version: "3.1.5",
      stars: 987,
      downloads: 23456,
      installed: true,
      enabled: true,
      category: "tool"
    },
    {
      id: "3",
      name: "Dark+ Theme",
      description: "A dark theme optimized for long coding sessions",
      author: "ThemeCreator",
      version: "2.0.1",
      stars: 567,
      downloads: 12345,
      installed: false,
      enabled: false,
      category: "theme"
    },
    {
      id: "4",
      name: "Go Language Support",
      description: "Full language server for Go programming",
      author: "Go Team",
      version: "1.0.0",
      stars: 423,
      downloads: 8765,
      installed: false,
      enabled: false,
      category: "language"
    },
    {
      id: "5",
      name: "ESLint Integration",
      description: "JavaScript and TypeScript linting with ESLint",
      author: "Lint Tools",
      version: "2.3.4",
      stars: 876,
      downloads: 32109,
      installed: false,
      enabled: false,
      category: "tool"
    }
  ]);
  
  const filteredExtensions = extensions.filter(ext => 
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const installedExtensions = extensions.filter(ext => ext.installed);
  
  const handleToggleExtension = (id: string) => {
    setExtensions(extensions.map(ext => 
      ext.id === id ? { ...ext, enabled: !ext.enabled } : ext
    ));
    
    const extension = extensions.find(ext => ext.id === id);
    if (extension) {
      toast({
        title: extension.enabled ? "Extension disabled" : "Extension enabled",
        description: `${extension.name} has been ${extension.enabled ? "disabled" : "enabled"}`,
      });
    }
  };
  
  const handleInstallExtension = (id: string) => {
    setExtensions(extensions.map(ext => 
      ext.id === id ? { ...ext, installed: true, enabled: true } : ext
    ));
    
    const extension = extensions.find(ext => ext.id === id);
    if (extension) {
      toast({
        title: "Extension installed",
        description: `${extension.name} has been installed and enabled`,
      });
    }
  };
  
  const handleUninstallExtension = (id: string) => {
    setExtensions(extensions.map(ext => 
      ext.id === id ? { ...ext, installed: false, enabled: false } : ext
    ));
    
    const extension = extensions.find(ext => ext.id === id);
    if (extension) {
      toast({
        title: "Extension uninstalled",
        description: `${extension.name} has been uninstalled`,
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] h-[600px] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            Extensions Manager
          </DialogTitle>
          <DialogDescription>
            Browse, install, and manage extensions to enhance your IDE experience.
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative flex items-center mb-4">
          <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search extensions..." 
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="installed">Installed ({installedExtensions.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="browse" className="flex-1 overflow-auto">
            <div className="space-y-4 py-2">
              {filteredExtensions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No extensions found matching "{searchQuery}"</p>
                </div>
              ) : (
                filteredExtensions.map(ext => (
                  <Card key={ext.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex flex-wrap items-center gap-2">
                            <span className="break-all">{ext.name}</span>
                            {ext.installed && (
                              <Badge variant="outline">Installed</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="line-clamp-2">{ext.description}</CardDescription>
                        </div>
                        
                        {ext.installed ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="ml-2"
                            onClick={() => handleUninstallExtension(ext.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="ml-2"
                            onClick={() => handleInstallExtension(ext.id)}
                          >
                            <DownloadCloud className="h-4 w-4 mr-1" /> Install
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardFooter className="py-2 text-xs text-muted-foreground border-t flex justify-between">
                      <div>
                        {ext.author} • v{ext.version}
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Star className="h-3 w-3 mr-1" /> {ext.stars}
                        </span>
                        <span className="flex items-center">
                          <Download className="h-3 w-3 mr-1" /> {ext.downloads}
                        </span>
                      </div>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="installed" className="flex-1 overflow-auto">
            {installedExtensions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No extensions installed</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("browse")}>
                  Browse Extensions
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {installedExtensions.map(ext => (
                  <Card key={ext.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base break-all">{ext.name}</CardTitle>
                          <CardDescription className="line-clamp-2">{ext.description}</CardDescription>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id={`ext-toggle-${ext.id}`} 
                            checked={ext.enabled}
                            onCheckedChange={() => handleToggleExtension(ext.id)}
                          />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleUninstallExtension(ext.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardFooter className="py-2 text-xs text-muted-foreground border-t">
                      <div>
                        {ext.author} • v{ext.version} • {ext.category}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}