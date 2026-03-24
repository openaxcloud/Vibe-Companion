// @ts-nocheck
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { 
  Store, 
  Search, 
  Star, 
  Download, 
  Filter,
  Package,
  Zap,
  Paintbrush,
  Code,
  Shield,
  Globe,
  Smartphone,
  Database,
  BarChart3,
  FileText,
  MessageSquare,
  Heart,
  ExternalLink,
  Settings,
  TrendingUp,
  Crown,
  CheckCircle2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Marketplace() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('extensions');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [usingTemplateId, setUsingTemplateId] = useState<number | null>(null);

  const handleUseTemplate = async (templateId: number) => {
    setUsingTemplateId(templateId);
    try {
      const result = await apiRequest<{ project: { id: number } }>('POST', `/api/templates/${templateId}/fork`, {});
      if (result?.project?.id) {
        navigate(`/ide/${result.project.id}`);
      }
    } catch (err: any) {
      toast({ title: 'Failed to use template', description: err?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setUsingTemplateId(null);
    }
  };

  const { data: extensions = [], isLoading: isExtensionsLoading } = useQuery<any[]>({
    queryKey: ['/api/marketplace/extensions'],
  });

  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery<any>({
    queryKey: ['/api/marketplace/templates'],
  });
  const templates = (Array.isArray(templatesData) ? templatesData : (templatesData as any)?.templates || []).filter(Boolean);

  const { data: categoriesData = [] } = useQuery<any[]>({
    queryKey: ['/api/marketplace/categories'],
  });
  
  const iconMap: Record<string, any> = {
    ai: Zap,
    themes: Paintbrush,
    languages: Code,
    formatters: FileText,
    security: Shield,
    tools: Package,
    snippets: MessageSquare,
    frontend: Globe,
    backend: Database,
    mobile: Smartphone,
    fullstack: BarChart3,
  };
  
  const categoriesArr = Array.isArray(categoriesData) ? categoriesData : [];
  const categories = [
    { id: 'all', name: 'All Categories', icon: Store, count: categoriesArr.reduce((sum: number, c: any) => sum + (c?.count || 0), 0) || 0 },
    ...categoriesArr.map((cat: any) => ({
      id: cat?.slug || cat?.id || 'unknown',
      name: cat?.name || 'Unknown',
      icon: iconMap[(cat?.slug || '').toLowerCase()] || Package,
      count: cat?.count || 0
    }))
  ];

  const { data: publishers = [] } = useQuery<any[]>({
    queryKey: ['/api/marketplace/publishers'],
  });

  const extensionsArr = Array.isArray(extensions) ? extensions : [];
  const filteredExtensions = extensionsArr.filter((ext: any) => {
    if (!ext) return false;
    const q = searchQuery.toLowerCase();
    const matchesSearch = (ext.name || '').toLowerCase().includes(q) ||
                         (ext.description || '').toLowerCase().includes(q) ||
                         (Array.isArray(ext.tags) ? ext.tags : []).some((tag: string) => (tag || '').toLowerCase().includes(q));
    const matchesCategory = selectedCategory === 'all' || (ext.category || '').toLowerCase().includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const ExtensionCard = ({ extension }: { extension: any }) => {
    if (!extension) return null;
    return (
      <Card className="group hover:shadow-md transition-shadow" data-testid={`card-extension-${extension.id}`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold">
              {(extension.name || '?').charAt(0)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-[15px] group-hover:text-primary transition-colors" data-testid={`text-extension-name-${extension.id}`}>
                    {extension.name}
                  </h3>
                  <p className="text-[13px] text-muted-foreground" data-testid={`text-extension-author-${extension.id}`}>by {typeof extension.author === 'object' ? extension.author?.name : (extension.author ?? 'Unknown')}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {extension.featured && (
                    <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500" data-testid={`badge-extension-featured-${extension.id}`}>
                      <Crown className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                  {extension.installed && (
                    <Badge variant="outline" className="text-green-600 border-green-600" data-testid={`badge-extension-installed-${extension.id}`}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Installed
                    </Badge>
                  )}
                </div>
              </div>
              
              <p className="text-[13px] text-muted-foreground mb-3 line-clamp-2" data-testid={`text-extension-description-${extension.id}`}>
                {extension.description}
              </p>
              
              <div className="flex flex-wrap gap-1 mb-3">
                {(Array.isArray(extension.tags) ? extension.tags : []).map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-[11px]" data-testid={`badge-extension-tag-${extension.id}-${index}`}>
                    {tag}
                  </Badge>
                ))}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                  <div className="flex items-center gap-1" data-testid={`text-extension-rating-${extension.id}`}>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{extension.rating ?? 0}</span>
                    <span>({(extension.reviews ?? 0).toLocaleString()})</span>
                  </div>
                  <div className="flex items-center gap-1" data-testid={`text-extension-downloads-${extension.id}`}>
                    <Download className="h-4 w-4" />
                    <span>{(extension.downloads ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px]" data-testid={`text-extension-price-${extension.id}`}>{extension.price || 'Free'}</span>
                  <Button size="sm" variant={extension.installed ? "outline" : "default"} data-testid={`button-extension-install-${extension.id}`}>
                    {extension.installed ? 'Uninstall' : 'Install'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const TemplateCard = ({ template }: { template: any }) => {
    if (!template) return null;
    return (
      <Card className="group hover:shadow-md transition-shadow" data-testid={`card-template-${template.id}`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-[15px]">
              {(template?.framework || template?.language || template?.name || '?').toString().charAt(0)}
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-[15px] group-hover:text-primary transition-colors" data-testid={`text-template-name-${template.id}`}>
                    {template.name}
                  </h3>
                  <p className="text-[13px] text-muted-foreground" data-testid={`text-template-author-${template.id}`}>by {typeof template.author === 'object' ? template.author?.name : (template.author ?? 'Unknown')}</p>
                </div>
                
                {template.featured && (
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500" data-testid={`badge-template-featured-${template.id}`}>
                    <Crown className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>
              
              <p className="text-[13px] text-muted-foreground mb-3" data-testid={`text-template-description-${template.id}`}>
                {template.description}
              </p>
              
              <div className="flex flex-wrap gap-1 mb-3">
                {(Array.isArray(template.tags) ? template.tags : []).map((tag: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-[11px]" data-testid={`badge-template-tag-${template.id}-${index}`}>
                    {tag}
                  </Badge>
                ))}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                  <div className="flex items-center gap-1" data-testid={`text-template-rating-${template.id}`}>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{template.rating ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1" data-testid={`text-template-downloads-${template.id}`}>
                    <Download className="h-4 w-4" />
                    <span>{(template.downloads ?? 0).toLocaleString()}</span>
                  </div>
                  <Badge variant="outline" data-testid={`badge-template-category-${template.id}`}>{template.category}</Badge>
                </div>
                
                <Button size="sm" data-testid={`button-use-template-${template.id}`} disabled={usingTemplateId === template.id} onClick={() => handleUseTemplate(template.id)}>
                  {usingTemplateId === template.id ? 'Creating...' : 'Use Template'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-marketplace">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-marketplace-title">Marketplace</h1>
            <p className="text-muted-foreground" data-testid="text-marketplace-subtitle">Discover extensions, themes, and templates for E-Code</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" data-testid="button-my-extensions">
              <Package className="h-4 w-4 mr-2" />
              My Extensions
            </Button>
            <Button variant="outline" size="sm" data-testid="button-publish">
              <Settings className="h-4 w-4 mr-2" />
              Publish
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search extensions, themes, and templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-marketplace-search"
              />
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-category-filter">
                <Filter className="h-4 w-4 mr-2" />
                Category
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {categories.map((category) => (
                <DropdownMenuItem 
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  data-testid={`menu-item-category-${category.id}`}
                >
                  <category.icon className="h-4 w-4 mr-2" />
                  {category.name} ({category.count})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="extensions" data-testid="tab-extensions">
              Extensions ({extensions.length})
            </TabsTrigger>
            <TabsTrigger value="themes" data-testid="tab-themes">
              Themes
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              Templates ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="publishers" data-testid="tab-publishers">
              Publishers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extensions" className="space-y-6">
            {/* Featured Extensions */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Featured Extensions</h2>
              <div className="grid gap-4">
                {filteredExtensions.filter((ext: any) => ext.featured).map((extension: any) => (
                  <ExtensionCard key={extension.id} extension={extension} />
                ))}
              </div>
            </div>

            {/* All Extensions */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">All Extensions</h2>
              <div className="grid gap-4">
                {filteredExtensions.filter((ext: any) => !ext.featured).map((extension: any) => (
                  <ExtensionCard key={extension.id} extension={extension} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="themes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: 'Dark+ Professional', preview: 'dark', downloads: 245678 },
                { name: 'GitHub Light', preview: 'light', downloads: 189432 },
                { name: 'Monokai Pro', preview: 'dark', downloads: 156789 },
                { name: 'Material Ocean', preview: 'dark', downloads: 134567 },
                { name: 'Nord', preview: 'dark', downloads: 98765 },
                { name: 'Solarized Light', preview: 'light', downloads: 87654 }
              ].map((theme, index) => (
                <Card key={index} data-testid={`card-theme-${index}`}>
                  <CardContent className="p-4">
                    <div className={`h-32 rounded-lg mb-3 ${theme.preview === 'dark' ? 'bg-gray-900' : 'bg-gray-100'} flex items-center justify-center`}>
                      <Code className={`h-8 w-8 ${theme.preview === 'dark' ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <h3 className="font-semibold mb-1" data-testid={`text-theme-name-${index}`}>{theme.name}</h3>
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                      <span data-testid={`text-theme-downloads-${index}`}>{(theme.downloads ?? 0).toLocaleString()} downloads</span>
                      <Button size="sm" data-testid={`button-apply-theme-${index}`}>Apply</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <div className="space-y-4">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="publishers" className="space-y-6">
            <div className="grid gap-4">
              {publishers.map((publisher) => (
                <Card key={publisher.id} data-testid={`card-publisher-${publisher.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16" data-testid={`avatar-publisher-${publisher.id}`}>
                        <AvatarFallback>{publisher.avatar}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[15px] font-semibold" data-testid={`text-publisher-name-${publisher.id}`}>{publisher.name}</h3>
                          {publisher.verified && (
                            <Badge variant="outline" className="text-blue-600 border-blue-600" data-testid={`badge-publisher-verified-${publisher.id}`}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-6 text-[13px] text-muted-foreground">
                          <span data-testid={`text-publisher-extensions-${publisher.id}`}>{publisher.extensions} extensions</span>
                          <span data-testid={`text-publisher-downloads-${publisher.id}`}>{(publisher.downloads ?? 0).toLocaleString()} total downloads</span>
                        </div>
                      </div>
                      
                      <Button variant="outline" data-testid={`button-view-extensions-${publisher.id}`}>
                        View Extensions
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}