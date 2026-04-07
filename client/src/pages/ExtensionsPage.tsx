// @ts-nocheck
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Settings,
  Check,
  X,
  ExternalLink,
  User,
  Calendar,
  GitBranch,
  Tag,
  ChevronRight,
  Filter,
  Grid3X3,
  List,
  Loader2,
  Lock,
  Trash2,
  RefreshCw,
  History,
  Building2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  authorAvatar?: string;
  category: 'themes' | 'languages' | 'tools' | 'formatters' | 'linters' | 'snippets' | 'debuggers' | 'testing';
  icon: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  version: string;
  lastUpdated: Date;
  installed: boolean;
  verified: boolean;
  tags: string[];
  screenshots?: string[];
  changelog?: string;
  repository?: string;
  license?: string;
  size?: string;
  dependencies?: string[];
}

interface Review {
  id: string;
  author: string;
  rating: number;
  content: string;
  date: Date;
  helpful: number;
}

interface VersionHistory {
  version: string;
  date: Date;
  changes: string[];
}

export default function ExtensionsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [showPrivateMarketplace, setShowPrivateMarketplace] = useState(false);

  const [extensions, setExtensions] = useState<Extension[]>([
    {
      id: '1',
      name: 'Monokai Pro',
      description: 'A professional theme with vibrant colors and excellent readability. Perfect for long coding sessions.',
      author: 'MonokaiThemes',
      category: 'themes',
      icon: '🎨',
      downloads: 2150000,
      rating: 4.8,
      ratingCount: 12453,
      version: '2.1.0',
      lastUpdated: new Date(Date.now() - 86400000 * 3),
      installed: false,
      verified: true,
      tags: ['dark', 'colorful', 'popular', 'pro'],
      license: 'MIT',
      size: '2.4 MB',
    },
    {
      id: '2',
      name: 'Python Language Pack',
      description: 'Rich Python language support with IntelliSense, linting, debugging, Jupyter notebooks, and more.',
      author: 'E-Code Team',
      category: 'languages',
      icon: '🐍',
      downloads: 8900000,
      rating: 4.9,
      ratingCount: 45621,
      version: '3.0.5',
      lastUpdated: new Date(Date.now() - 86400000),
      installed: true,
      verified: true,
      tags: ['python', 'language', 'official', 'intellisense'],
      license: 'MIT',
      size: '15.8 MB',
      repository: 'https://github.com/ecode/python-extension',
    },
    {
      id: '3',
      name: 'GitLens',
      description: 'Supercharge Git within E-Code — Visualize code authorship, navigate history, and more.',
      author: 'GitKraken',
      category: 'tools',
      icon: '🔍',
      downloads: 4500000,
      rating: 4.7,
      ratingCount: 23456,
      version: '14.2.1',
      lastUpdated: new Date(Date.now() - 86400000 * 7),
      installed: false,
      verified: true,
      tags: ['git', 'productivity', 'visualization', 'history'],
      license: 'MIT',
      size: '8.2 MB',
    },
    {
      id: '4',
      name: 'Prettier',
      description: 'Code formatter using prettier - an opinionated code formatter that supports many languages.',
      author: 'Prettier',
      category: 'formatters',
      icon: '✨',
      downloads: 12000000,
      rating: 4.6,
      ratingCount: 67890,
      version: '10.5.0',
      lastUpdated: new Date(Date.now() - 86400000 * 2),
      installed: true,
      verified: true,
      tags: ['formatter', 'javascript', 'typescript', 'css', 'html'],
      license: 'MIT',
      size: '4.5 MB',
    },
    {
      id: '5',
      name: 'ESLint',
      description: 'Integrates ESLint JavaScript linter into E-Code. Find and fix problems in your JavaScript code.',
      author: 'ESLint Team',
      category: 'linters',
      icon: '⚡',
      downloads: 9800000,
      rating: 4.5,
      ratingCount: 34567,
      version: '3.4.0',
      lastUpdated: new Date(Date.now() - 86400000 * 5),
      installed: false,
      verified: true,
      tags: ['linter', 'javascript', 'quality', 'errors'],
      license: 'MIT',
      size: '6.1 MB',
    },
    {
      id: '6',
      name: 'React Developer Tools',
      description: 'ES7+ React/Redux/GraphQL/React-Native snippets with Babel plugin features.',
      author: 'dsznajder',
      category: 'snippets',
      icon: '⚛️',
      downloads: 5600000,
      rating: 4.8,
      ratingCount: 28901,
      version: '4.4.3',
      lastUpdated: new Date(Date.now() - 86400000 * 10),
      installed: false,
      verified: true,
      tags: ['react', 'snippets', 'productivity', 'jsx'],
      license: 'MIT',
      size: '1.2 MB',
    },
    {
      id: '7',
      name: 'Docker',
      description: 'Makes it easy to create, manage, and debug containerized applications.',
      author: 'Microsoft',
      category: 'tools',
      icon: '🐳',
      downloads: 7200000,
      rating: 4.7,
      ratingCount: 19876,
      version: '1.28.0',
      lastUpdated: new Date(Date.now() - 86400000 * 4),
      installed: true,
      verified: true,
      tags: ['docker', 'containers', 'devops', 'kubernetes'],
      license: 'MIT',
      size: '12.3 MB',
    },
    {
      id: '8',
      name: 'Jest Runner',
      description: 'Run and debug Jest tests from E-Code. Supports coverage, snapshots, and more.',
      author: 'first_try',
      category: 'testing',
      icon: '🃏',
      downloads: 3400000,
      rating: 4.6,
      ratingCount: 8765,
      version: '0.8.14',
      lastUpdated: new Date(Date.now() - 86400000 * 8),
      installed: false,
      verified: false,
      tags: ['jest', 'testing', 'javascript', 'react'],
      license: 'MIT',
      size: '3.8 MB',
    },
    {
      id: '9',
      name: 'Go Language Support',
      description: 'Rich Go language support with IntelliSense, code navigation, debugging, and more.',
      author: 'Go Team',
      category: 'languages',
      icon: '🔵',
      downloads: 4100000,
      rating: 4.8,
      ratingCount: 15432,
      version: '0.41.0',
      lastUpdated: new Date(Date.now() - 86400000 * 6),
      installed: false,
      verified: true,
      tags: ['go', 'golang', 'language', 'official'],
      license: 'BSD-3',
      size: '18.5 MB',
    },
    {
      id: '10',
      name: 'Dracula Official',
      description: 'Official Dracula Theme. A dark theme for many editors, shells, and more.',
      author: 'Dracula Theme',
      category: 'themes',
      icon: '🧛',
      downloads: 6800000,
      rating: 4.9,
      ratingCount: 42345,
      version: '2.24.3',
      lastUpdated: new Date(Date.now() - 86400000 * 15),
      installed: false,
      verified: true,
      tags: ['dark', 'purple', 'theme', 'popular'],
      license: 'MIT',
      size: '0.8 MB',
    },
    {
      id: '11',
      name: 'Debug Visualizer',
      description: 'A visual way to debug your code. Visualize data structures, expressions, and more.',
      author: 'hediet',
      category: 'debuggers',
      icon: '🔬',
      downloads: 890000,
      rating: 4.5,
      ratingCount: 3456,
      version: '2.5.0',
      lastUpdated: new Date(Date.now() - 86400000 * 20),
      installed: false,
      verified: false,
      tags: ['debug', 'visualization', 'data'],
      license: 'MIT',
      size: '5.2 MB',
    },
    {
      id: '12',
      name: 'Rust Analyzer',
      description: 'Rust language support with code completion, navigation, and more. Powered by rust-analyzer.',
      author: 'rust-lang',
      category: 'languages',
      icon: '🦀',
      downloads: 3200000,
      rating: 4.9,
      ratingCount: 18765,
      version: '0.3.1750',
      lastUpdated: new Date(Date.now() - 86400000 * 1),
      installed: false,
      verified: true,
      tags: ['rust', 'language', 'analyzer', 'official'],
      license: 'Apache-2.0',
      size: '25.1 MB',
    },
  ]);

  const [reviews] = useState<Review[]>([
    { id: '1', author: 'devuser123', rating: 5, content: 'Absolutely essential extension! Makes coding so much easier.', date: new Date(Date.now() - 86400000 * 2), helpful: 45 },
    { id: '2', author: 'codemaster', rating: 4, content: 'Great extension, but could use some performance improvements.', date: new Date(Date.now() - 86400000 * 5), helpful: 23 },
    { id: '3', author: 'newbie_dev', rating: 5, content: 'Perfect for beginners! Easy to set up and use.', date: new Date(Date.now() - 86400000 * 10), helpful: 18 },
  ]);

  const [versionHistory] = useState<VersionHistory[]>([
    { version: '2.1.0', date: new Date(Date.now() - 86400000 * 3), changes: ['Added new color scheme', 'Fixed memory leak', 'Improved performance'] },
    { version: '2.0.0', date: new Date(Date.now() - 86400000 * 30), changes: ['Major redesign', 'New features added', 'Breaking changes'] },
    { version: '1.9.5', date: new Date(Date.now() - 86400000 * 60), changes: ['Bug fixes', 'Minor improvements'] },
  ]);

  const categories = [
    { id: 'all', label: 'All Extensions', icon: Package, count: extensions.length },
    { id: 'themes', label: 'Themes', icon: Palette, count: extensions.filter(e => e.category === 'themes').length },
    { id: 'languages', label: 'Languages', icon: Code, count: extensions.filter(e => e.category === 'languages').length },
    { id: 'tools', label: 'Tools', icon: Terminal, count: extensions.filter(e => e.category === 'tools').length },
    { id: 'formatters', label: 'Formatters', icon: Zap, count: extensions.filter(e => e.category === 'formatters').length },
    { id: 'linters', label: 'Linters', icon: Shield, count: extensions.filter(e => e.category === 'linters').length },
    { id: 'snippets', label: 'Snippets', icon: Code, count: extensions.filter(e => e.category === 'snippets').length },
    { id: 'debuggers', label: 'Debuggers', icon: Terminal, count: extensions.filter(e => e.category === 'debuggers').length },
    { id: 'testing', label: 'Testing', icon: Check, count: extensions.filter(e => e.category === 'testing').length },
  ];

  const installedExtensions = extensions.filter(e => e.installed);

  const filteredExtensions = extensions.filter((ext) => {
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || ext.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedExtensions = [...filteredExtensions].sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return b.downloads - a.downloads;
      case 'rating':
        return b.rating - a.rating;
      case 'recent':
        return b.lastUpdated.getTime() - a.lastUpdated.getTime();
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const handleInstall = async (extension: Extension) => {
    setInstallingId(extension.id);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setExtensions(extensions.map(ext => {
      if (ext.id === extension.id) {
        return { ...ext, installed: !ext.installed };
      }
      return ext;
    }));
    setInstallingId(null);
    toast({
      title: extension.installed ? 'Extension uninstalled' : 'Extension installed',
      description: `${extension.name} has been ${extension.installed ? 'uninstalled' : 'installed'} successfully.`,
    });
  };

  const handleOpenDetail = (extension: Extension) => {
    setSelectedExtension(extension);
    setShowDetailDialog(true);
  };

  const formatDownloads = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const formatDate = (date: Date) => {
    const diff = Date.now() - date.getTime();
    if (diff < 86400000) return 'Today';
    if (diff < 86400000 * 2) return 'Yesterday';
    if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)} days ago`;
    if (diff < 86400000 * 30) return `${Math.floor(diff / (86400000 * 7))} weeks ago`;
    return date.toLocaleDateString();
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  const cardClassName = "border border-border bg-card shadow-sm";
  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";

  return (
    <PageShell>
      <div
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        data-testid="page-extensions"
      >
        <PageHeader
          title="Extensions Marketplace"
          description="Discover and install extensions to enhance your development experience."
          icon={Package}
          actions={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant={showPrivateMarketplace ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => setShowPrivateMarketplace(!showPrivateMarketplace)}
                data-testid="button-private-marketplace"
              >
                <Building2 className="h-4 w-4" />
                Private
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                data-testid="button-refresh-extensions"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                data-testid="button-extension-settings"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <div className="md:col-span-1 space-y-4">
            <Card className={cardClassName} data-testid="card-extension-categories">
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] font-medium">Categories</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1 px-2 pb-4">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all ${
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                        onClick={() => setSelectedCategory(cat.id)}
                        data-testid={`button-category-${cat.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {cat.label}
                        </div>
                        <Badge variant="secondary" className="text-[11px]">
                          {cat.count}
                        </Badge>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>

            <Card className={cardClassName} data-testid="card-installed-extensions">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[13px] font-medium">Installed</CardTitle>
                  <Badge variant="secondary">{installedExtensions.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[200px] px-2 pb-4">
                  <div className="space-y-2">
                    {installedExtensions.map((ext) => (
                      <div
                        key={ext.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-all"
                        onClick={() => handleOpenDetail(ext)}
                        data-testid={`installed-extension-${ext.id}`}
                      >
                        <span className="text-xl">{ext.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[13px] truncate">{ext.name}</div>
                          <div className="text-[11px] text-muted-foreground">v{ext.version}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleInstall(ext); }}
                          data-testid={`button-uninstall-sidebar-${ext.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-3 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-extensions">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <TabsList data-testid="tablist-extensions">
                  <TabsTrigger value="browse" data-testid="tab-browse">Browse</TabsTrigger>
                  <TabsTrigger value="installed" data-testid="tab-installed">
                    Installed ({installedExtensions.length})
                  </TabsTrigger>
                  <TabsTrigger value="trending" data-testid="tab-trending">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Trending
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search extensions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${inputClassName} pl-9`}
                      data-testid="input-search-extensions"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy} data-testid="select-sort-extensions">
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popular">Most Popular</SelectItem>
                      <SelectItem value="rating">Highest Rated</SelectItem>
                      <SelectItem value="recent">Recently Updated</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center border border-border rounded-md">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-r-none"
                      onClick={() => setViewMode('grid')}
                      data-testid="button-view-grid"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-l-none"
                      onClick={() => setViewMode('list')}
                      data-testid="button-view-list"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <TabsContent value="browse" className="mt-4">
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-extensions">
                    {sortedExtensions.map((ext) => (
                      <Card
                        key={ext.id}
                        className={`${cardClassName} cursor-pointer hover:border-primary/30 transition-all`}
                        onClick={() => handleOpenDetail(ext)}
                        data-testid={`extension-card-${ext.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-3xl">{ext.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground truncate">{ext.name}</h3>
                                {ext.verified && (
                                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-[11px]">
                                    <Check className="h-3 w-3 mr-0.5" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{ext.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Download className="h-3.5 w-3.5" />
                              {formatDownloads(ext.downloads)}
                            </div>
                            <div className="flex items-center gap-1">
                              {renderStars(ext.rating)}
                              <span className="ml-1">{ext.rating}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                            <span className="text-[11px] text-muted-foreground">{ext.author}</span>
                            <Button
                              size="sm"
                              variant={ext.installed ? 'outline' : 'default'}
                              disabled={installingId === ext.id}
                              onClick={(e) => { e.stopPropagation(); handleInstall(ext); }}
                              className="gap-1"
                              data-testid={`button-install-${ext.id}`}
                            >
                              {installingId === ext.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : ext.installed ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Installed
                                </>
                              ) : (
                                <>
                                  <Download className="h-3.5 w-3.5" />
                                  Install
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="list-extensions">
                    {sortedExtensions.map((ext) => (
                      <Card
                        key={ext.id}
                        className={`${cardClassName} cursor-pointer hover:border-primary/30 transition-all`}
                        onClick={() => handleOpenDetail(ext)}
                        data-testid={`extension-row-${ext.id}`}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <span className="text-2xl">{ext.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">{ext.name}</h3>
                              {ext.verified && (
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-[11px]">Verified</Badge>
                              )}
                              <Badge variant="outline" className="text-[11px]">{ext.category}</Badge>
                            </div>
                            <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-1">{ext.description}</p>
                          </div>
                          <div className="hidden sm:flex items-center gap-6 text-[13px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Download className="h-4 w-4" />
                              {formatDownloads(ext.downloads)}
                            </div>
                            <div className="flex items-center gap-1">
                              {renderStars(ext.rating)}
                            </div>
                            <span className="text-[11px]">{ext.author}</span>
                          </div>
                          <Button
                            size="sm"
                            variant={ext.installed ? 'outline' : 'default'}
                            disabled={installingId === ext.id}
                            onClick={(e) => { e.stopPropagation(); handleInstall(ext); }}
                            data-testid={`button-install-list-${ext.id}`}
                          >
                            {installingId === ext.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : ext.installed ? 'Uninstall' : 'Install'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="installed" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-installed">
                  {installedExtensions.map((ext) => (
                    <Card
                      key={ext.id}
                      className={`${cardClassName} cursor-pointer hover:border-primary/30 transition-all`}
                      onClick={() => handleOpenDetail(ext)}
                      data-testid={`installed-card-${ext.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-3xl">{ext.icon}</span>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate">{ext.name}</h3>
                            <p className="text-[11px] text-muted-foreground">v{ext.version} • by {ext.author}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={(e) => { e.stopPropagation(); }}
                            data-testid={`button-disable-${ext.id}`}
                          >
                            Disable
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleInstall(ext); }}
                            data-testid={`button-uninstall-${ext.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="trending" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-trending">
                  {[...extensions]
                    .sort((a, b) => b.downloads - a.downloads)
                    .slice(0, 6)
                    .map((ext, idx) => (
                      <Card
                        key={ext.id}
                        className={`${cardClassName} cursor-pointer hover:border-primary/30 transition-all relative overflow-hidden`}
                        onClick={() => handleOpenDetail(ext)}
                        data-testid={`trending-card-${ext.id}`}
                      >
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-primary text-primary-foreground">
                            #{idx + 1}
                          </Badge>
                        </div>
                        <CardContent className="p-4 pt-8">
                          <div className="flex items-start gap-3">
                            <span className="text-3xl">{ext.icon}</span>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{ext.name}</h3>
                              <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{ext.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                              {formatDownloads(ext.downloads)} downloads
                            </div>
                            <div className="flex items-center gap-1">
                              {renderStars(ext.rating)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          {selectedExtension && (
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden" data-testid="dialog-extension-detail">
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{selectedExtension.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl">{selectedExtension.name}</DialogTitle>
                      {selectedExtension.verified && (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                          <Check className="h-3 w-3 mr-0.5" />
                          Verified Publisher
                        </Badge>
                      )}
                    </div>
                    <DialogDescription className="mt-1">
                      By {selectedExtension.author} • v{selectedExtension.version}
                    </DialogDescription>
                  </div>
                  <Button
                    variant={selectedExtension.installed ? 'outline' : 'default'}
                    disabled={installingId === selectedExtension.id}
                    onClick={() => handleInstall(selectedExtension)}
                    className="gap-2"
                    data-testid="button-install-detail"
                  >
                    {installingId === selectedExtension.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : selectedExtension.installed ? (
                      <>
                        <Check className="h-4 w-4" />
                        Installed
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Install
                      </>
                    )}
                  </Button>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6">
                  <div className="flex items-center gap-6 text-[13px]">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDownloads(selectedExtension.downloads)} downloads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStars(selectedExtension.rating)}
                      <span>{selectedExtension.rating} ({selectedExtension.ratingCount} reviews)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Updated {formatDate(selectedExtension.lastUpdated)}</span>
                    </div>
                  </div>

                  <p className="text-muted-foreground">{selectedExtension.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {selectedExtension.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" data-testid={`tag-${tag}`}>
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">License</Label>
                      <p className="font-medium">{selectedExtension.license || 'MIT'}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Size</Label>
                      <p className="font-medium">{selectedExtension.size || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Category</Label>
                      <p className="font-medium capitalize">{selectedExtension.category}</p>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Version</Label>
                      <p className="font-medium">v{selectedExtension.version}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Version History
                    </h4>
                    <div className="space-y-3">
                      {versionHistory.map((v) => (
                        <div key={v.version} className="p-3 rounded-lg border border-border" data-testid={`version-${v.version}`}>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">v{v.version}</Badge>
                            <span className="text-[11px] text-muted-foreground">{formatDate(v.date)}</span>
                          </div>
                          <ul className="text-[13px] text-muted-foreground space-y-1">
                            {v.changes.map((change, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                                {change}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Reviews
                    </h4>
                    <div className="space-y-3">
                      {reviews.map((review) => (
                        <div key={review.id} className="p-3 rounded-lg border border-border" data-testid={`review-${review.id}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium">{review.author}</span>
                              {renderStars(review.rating)}
                            </div>
                            <span className="text-[11px] text-muted-foreground">{formatDate(review.date)}</span>
                          </div>
                          <p className="text-[13px] text-muted-foreground">{review.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
                              👍 {review.helpful} helpful
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <div className="flex items-center gap-2">
                  {selectedExtension.repository && (
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-repository">
                      <GitBranch className="h-4 w-4" />
                      Repository
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-report">
                    Report Issue
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setShowDetailDialog(false)} data-testid="button-close-detail">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </PageShell>
  );
}
