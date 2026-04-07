import React, { useState, useEffect } from 'react';
import { 
  Puzzle, Download, Star, TrendingUp, Search, Filter,
  Code, Palette, Terminal, Languages, Zap, GitBranch,
  FileCode, Package, Shield, Check, X, Loader2,
  ExternalLink, Heart, Clock, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ExtensionsMarketplaceProps {
  projectId: number;
  className?: string;
}

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  authorAvatar?: string;
  version: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  category: 'themes' | 'languages' | 'formatters' | 'linters' | 'snippets' | 'tools';
  tags: string[];
  icon: string;
  installed: boolean;
  hasUpdate?: boolean;
  price: number;
  screenshots?: string[];
  lastUpdated: string;
}

const MOCK_EXTENSIONS: Extension[] = [
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    description: 'Atom\'s iconic One Dark theme for a modern coding experience',
    author: 'binaryify',
    version: '3.15.0',
    downloads: 12500000,
    rating: 4.9,
    ratingCount: 2340,
    category: 'themes',
    tags: ['dark', 'modern', 'popular'],
    icon: '🎨',
    installed: false,
    price: 0,
    lastUpdated: '2024-01-15'
  },
  {
    id: 'prettier',
    name: 'Prettier - Code formatter',
    description: 'Code formatter using prettier',
    author: 'Prettier',
    version: '10.1.0',
    downloads: 34000000,
    rating: 4.8,
    ratingCount: 5670,
    category: 'formatters',
    tags: ['formatter', 'javascript', 'typescript', 'css'],
    icon: '✨',
    installed: true,
    price: 0,
    lastUpdated: '2024-01-20'
  },
  {
    id: 'eslint',
    name: 'ESLint',
    description: 'Integrates ESLint JavaScript into VS Code',
    author: 'Microsoft',
    version: '2.4.2',
    downloads: 28000000,
    rating: 4.7,
    ratingCount: 3450,
    category: 'linters',
    tags: ['linter', 'javascript', 'typescript'],
    icon: '🔍',
    installed: true,
    hasUpdate: true,
    price: 0,
    lastUpdated: '2024-01-18'
  },
  {
    id: 'python',
    name: 'Python',
    description: 'IntelliSense, linting, debugging, and more',
    author: 'Microsoft',
    version: '2024.0.1',
    downloads: 45000000,
    rating: 4.6,
    ratingCount: 8900,
    category: 'languages',
    tags: ['python', 'language', 'debugger'],
    icon: '🐍',
    installed: false,
    price: 0,
    lastUpdated: '2024-01-10'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    description: 'AI pair programmer',
    author: 'GitHub',
    version: '1.156.0',
    downloads: 8000000,
    rating: 4.5,
    ratingCount: 2100,
    category: 'tools',
    tags: ['ai', 'autocomplete', 'productivity'],
    icon: '🤖',
    installed: false,
    price: 10,
    lastUpdated: '2024-01-22'
  },
  {
    id: 'react-snippets',
    name: 'ES7+ React Snippets',
    description: 'Extensions for React, React-Native and Redux',
    author: 'dsznajder',
    version: '4.4.3',
    downloads: 5600000,
    rating: 4.7,
    ratingCount: 890,
    category: 'snippets',
    tags: ['react', 'snippets', 'javascript'],
    icon: '⚛️',
    installed: false,
    price: 0,
    lastUpdated: '2024-01-05'
  }
];

const CATEGORIES = [
  { value: 'all', label: 'All Categories', icon: Package },
  { value: 'themes', label: 'Themes', icon: Palette },
  { value: 'languages', label: 'Languages', icon: Languages },
  { value: 'formatters', label: 'Formatters', icon: FileCode },
  { value: 'linters', label: 'Linters', icon: Shield },
  { value: 'snippets', label: 'Snippets', icon: Code },
  { value: 'tools', label: 'Developer Tools', icon: Zap }
];

export function ExtensionsMarketplace({ projectId, className }: ExtensionsMarketplaceProps) {
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);
  const [filteredExtensions, setFilteredExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'recent'>('popular');
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('discover');
  const { toast } = useToast();

  useEffect(() => {
    filterAndSortExtensions();
  }, [selectedCategory, searchQuery, sortBy, extensions]);

  const filterAndSortExtensions = () => {
    let filtered = extensions;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(ext => ext.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ext => 
        ext.name.toLowerCase().includes(query) ||
        ext.description.toLowerCase().includes(query) ||
        ext.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by tab
    if (activeTab === 'installed') {
      filtered = filtered.filter(ext => ext.installed);
    } else if (activeTab === 'updates') {
      filtered = filtered.filter(ext => ext.hasUpdate);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.downloads - a.downloads;
        case 'rating':
          return b.rating - a.rating;
        case 'recent':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return 0;
      }
    });

    setFilteredExtensions(filtered);
  };

  const handleInstall = async (extension: Extension) => {
    setInstallingId(extension.id);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/extensions/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ extensionId: extension.id })
      });

      if (response.ok) {
        setExtensions(prev => prev.map(ext => 
          ext.id === extension.id ? { ...ext, installed: true } : ext
        ));
        toast({
          title: "Extension Installed",
          description: `${extension.name} has been installed successfully`,
        });
      }
    } catch (error) {
      toast({
        title: "Installation Failed",
        description: "Failed to install extension",
        variant: "destructive"
      });
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstall = async (extension: Extension) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/extensions/uninstall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ extensionId: extension.id })
      });

      if (response.ok) {
        setExtensions(prev => prev.map(ext => 
          ext.id === extension.id ? { ...ext, installed: false } : ext
        ));
        toast({
          title: "Extension Uninstalled",
          description: `${extension.name} has been uninstalled`,
        });
      }
    } catch (error) {
      toast({
        title: "Uninstall Failed",
        description: "Failed to uninstall extension",
        variant: "destructive"
      });
    }
  };

  const formatDownloads = (downloads: number) => {
    if (downloads >= 1000000) {
      return `${(downloads / 1000000).toFixed(1)}M`;
    } else if (downloads >= 1000) {
      return `${(downloads / 1000).toFixed(0)}K`;
    }
    return downloads.toString();
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Puzzle className="h-5 w-5 mr-2" />
              Extensions Marketplace
            </span>
            <Badge variant="secondary">
              {extensions.filter(e => e.installed).length} installed
            </Badge>
          </CardTitle>
          <CardDescription>
            Enhance your development experience with extensions
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="discover">Discover</TabsTrigger>
              <TabsTrigger value="installed">Installed</TabsTrigger>
              <TabsTrigger value="updates">
                Updates
                {extensions.filter(e => e.hasUpdate).length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1">
                    {extensions.filter(e => e.hasUpdate).length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search extensions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center">
                          <cat.icon className="h-4 w-4 mr-2" />
                          {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="recent">Recently Updated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Extensions List */}
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 pr-4">
                  {filteredExtensions.map((extension) => (
                    <Card 
                      key={extension.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedExtension(extension);
                        setShowDetailsDialog(true);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="text-2xl">{extension.icon}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{extension.name}</h4>
                                {extension.hasUpdate && (
                                  <Badge variant="secondary" className="text-xs">
                                    Update available
                                  </Badge>
                                )}
                                {extension.price > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    ${extension.price}/mo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {extension.description}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center">
                                  <Download className="h-3 w-3 mr-1" />
                                  {formatDownloads(extension.downloads)}
                                </span>
                                <span className="flex items-center">
                                  <Star className="h-3 w-3 mr-1 text-yellow-500" />
                                  {extension.rating} ({extension.ratingCount})
                                </span>
                                <span>{extension.author}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-4">
                            {extension.installed ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUninstall(extension);
                                }}
                              >
                                Uninstall
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInstall(extension);
                                }}
                                disabled={installingId === extension.id}
                              >
                                {installingId === extension.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Install'
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {filteredExtensions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No extensions found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Extension Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          {selectedExtension && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-3">
                  <span className="text-2xl">{selectedExtension.icon}</span>
                  <span>{selectedExtension.name}</span>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      {selectedExtension.author}
                    </span>
                    <span>v{selectedExtension.version}</span>
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Updated {new Date(selectedExtension.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                  {selectedExtension.price > 0 && (
                    <Badge variant="outline">${selectedExtension.price}/month</Badge>
                  )}
                </div>

                <p className="text-sm">{selectedExtension.description}</p>

                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="font-medium">{selectedExtension.rating}</span>
                    <span className="text-sm text-muted-foreground ml-1">
                      ({selectedExtension.ratingCount} ratings)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Download className="h-4 w-4 mr-1" />
                    <span className="text-sm">
                      {selectedExtension.downloads.toLocaleString()} downloads
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedExtension.tags.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {selectedExtension.hasUpdate && (
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription>
                      An update is available for this extension. Install it to get the latest features and fixes.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Close
                </Button>
                {selectedExtension.installed ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleUninstall(selectedExtension);
                      setShowDetailsDialog(false);
                    }}
                  >
                    Uninstall
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      handleInstall(selectedExtension);
                      setShowDetailsDialog(false);
                    }}
                  >
                    Install Extension
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}