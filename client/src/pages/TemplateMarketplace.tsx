// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { 
  Search, Filter, Grid3x3, List, TrendingUp, Star, Download,
  Code2, Sparkles, Rocket, ChevronDown, X, Plus, Upload,
  GitBranch, Clock, Award, Users, Package, Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { TemplateSearch } from '@/components/marketplace/TemplateSearch';
import { TemplateFilters } from '@/components/marketplace/TemplateFilters';
import { TemplateCard } from '@/components/marketplace/TemplateCard';
import { TemplatePreview } from '@/components/marketplace/TemplatePreview';
import { CommunityHub } from '@/components/marketplace/CommunityHub';
import { cn } from '@/lib/utils';

export default function TemplateMarketplace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('popularity');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/marketplace/categories'],
    queryFn: async () => {
      return apiRequest('GET', '/api/marketplace/categories');
    },
  });

  // Fetch popular tags
  const { data: popularTags } = useQuery({
    queryKey: ['/api/marketplace/tags'],
    queryFn: async () => {
      return apiRequest('GET', '/api/marketplace/tags');
    },
  });

  // Fetch templates with filters
  const { data: templatesData, isLoading: templatesLoading, refetch } = useQuery({
    queryKey: ['/api/marketplace/templates', {
      query: searchQuery,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      tags: selectedTags,
      languages: selectedLanguages,
      difficulty: selectedDifficulty,
      maxPrice: priceRange[1],
      sortBy,
      page,
      featured: activeTab === 'featured' ? true : undefined,
      official: activeTab === 'official' ? true : undefined,
      community: activeTab === 'community' ? true : undefined,
    }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey as [string, any];
      const queryParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach(v => queryParams.append(key, String(v)));
            } else {
              queryParams.set(key, String(value));
            }
          }
        });
      }

      const response = await apiRequest('GET', `${url}?${queryParams}`);
      return response;
    },
  });

  // Fetch trending templates
  const { data: trendingTemplates } = useQuery({
    queryKey: ['/api/marketplace/trending'],
    queryFn: async () => {
      return apiRequest('GET', '/api/marketplace/trending?limit=5');
    },
  });

  // Track template action
  const trackAction = useMutation({
    mutationFn: async ({ templateId, action }: { templateId: string; action: string }) => {
      return apiRequest('POST', `/api/marketplace/template/${templateId}/track`, { action });
    },
  });

  const handleTemplateClick = (template: any) => {
    setSelectedTemplate(template);
    trackAction.mutate({ templateId: template.id, action: 'view' });
  };

  const handleDeploy = async (template: any) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to deploy templates',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await apiRequest('POST', `/api/marketplace/template/${template.id}/deploy`, {
        environment: 'production',
        type: 'static'
      });
      
      toast({
        title: 'Template Deployed',
        description: `${template.name} has been deployed successfully!`,
      });
      
      // Optionally navigate to the project
      if (response.project) {
        setTimeout(() => {
          navigate(`/project/${response.project.id}`);
        }, 1500);
      }
    } catch (error) {
      toast({
        title: 'Deployment Failed',
        description: 'Failed to deploy template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleFork = async (template: any) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to fork templates',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await apiRequest('POST', `/api/marketplace/template/${template.id}/fork`, {});
      
      toast({
        title: 'Template Forked',
        description: `Successfully forked "${template.name}" to your account!`,
      });
      
      // Navigate to the forked project
      if (response.project) {
        setTimeout(() => {
          navigate(`/project/${response.project.id}`);
        }, 1500);
      }
    } catch (error) {
      toast({
        title: 'Fork Failed',
        description: 'Failed to fork template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedTags([]);
    setSelectedLanguages([]);
    setSelectedDifficulty([]);
    setPriceRange([0, 100]);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory !== 'all' || 
    selectedTags.length > 0 || 
    selectedLanguages.length > 0 || 
    selectedDifficulty.length > 0 ||
    priceRange[1] < 100 ||
    searchQuery !== '';

  return (
    <PageShell data-testid="templates-marketplace">
      <PageHeader title="Template Marketplace" description="Discover and deploy production-ready templates for your next project">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="marketplace-title">Template Marketplace</h1>
              <p className="text-muted-foreground mt-2">
                Discover and deploy production-ready templates for your next project
              </p>
            </div>
            <div className="flex gap-2">
              {user && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => navigate('/templates/submit')}
                  data-testid="submit-template-button"
                >
                  <Upload className="h-4 w-4" />
                  Submit Template
                </Button>
              )}
              <Button
                variant="outline"
                className={cn("gap-2", !showFilters && "bg-accent")}
                onClick={() => setShowFilters(!showFilters)}
                data-testid="filter-toggle-button"
              >
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1" data-testid="active-filters-count">
                    {[
                      selectedCategory !== 'all' ? 1 : 0,
                      selectedTags.length,
                      selectedLanguages.length,
                      selectedDifficulty.length,
                      priceRange[1] < 100 ? 1 : 0,
                      searchQuery ? 1 : 0,
                    ].reduce((a, b) => a + b, 0)}
                  </Badge>
                )}
              </Button>
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setViewMode('grid')}
                  data-testid="grid-view-button"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setViewMode('list')}
                  data-testid="list-view-button"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <TemplateSearch
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={() => refetch()}
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="sort-select">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popularity">Most Popular</SelectItem>
                <SelectItem value="recent">Recently Added</SelectItem>
                <SelectItem value="trending">Trending</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="downloads">Most Downloaded</SelectItem>
                <SelectItem value="price">Price: Low to High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PageHeader>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <LazyAnimatePresence>
          {showFilters && (
            <LazyMotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-80 shrink-0"
            >
              <Card className="sticky top-4" data-testid="filters-panel">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Filters</h3>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-muted-foreground hover:text-foreground"
                        data-testid="clear-filters-button"
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <TemplateFilters
                    categories={categories || []}
                    tags={popularTags || []}
                    selectedCategory={selectedCategory}
                    selectedTags={selectedTags}
                    selectedLanguages={selectedLanguages}
                    selectedDifficulty={selectedDifficulty}
                    priceRange={priceRange}
                    onCategoryChange={setSelectedCategory}
                    onTagsChange={setSelectedTags}
                    onLanguagesChange={setSelectedLanguages}
                    onDifficultyChange={setSelectedDifficulty}
                    onPriceRangeChange={setPriceRange}
                  />
                </CardContent>
              </Card>
            </LazyMotionDiv>
          )}
        </LazyAnimatePresence>

        {/* Main Content */}
        <div className="flex-1 min-w-0" data-testid="templates-content">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-5 max-w-[600px]">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="featured" data-testid="tab-featured">Featured</TabsTrigger>
              <TabsTrigger value="official" data-testid="tab-official">Official</TabsTrigger>
              <TabsTrigger value="community" data-testid="tab-community">Community</TabsTrigger>
              <TabsTrigger value="trending" data-testid="tab-trending">Trending</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Trending Section */}
          {activeTab === 'all' && trendingTemplates && trendingTemplates.length > 0 && (
            <div className="mb-8" data-testid="trending-section">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <h2 className="text-[15px] font-semibold">Trending This Week</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {trendingTemplates.slice(0, 5).map((template: any) => (
                  <Card
                    key={template.id}
                    className="min-w-[200px] cursor-pointer hover:shadow-lg transition-shadow"
                    data-testid={`trending-card-${template.id}`}
                    onClick={() => handleTemplateClick(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-[11px]">
                          {template.category}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          {template.stats.rating.toFixed(1)}
                        </Badge>
                      </div>
                      <h4 className="font-medium line-clamp-1">{template.name}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {template.stats.downloads} downloads
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Templates Grid/List */}
          {templatesLoading ? (
            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' ? "grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            )} data-testid="templates-loading">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-[300px]" />
              ))}
            </div>
          ) : (
            <>
              <div className={cn(
                "grid gap-4",
                viewMode === 'grid' ? "grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
              )} data-testid="templates-grid">
                {templatesData?.templates?.map((template: any) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    viewMode={viewMode}
                    onClick={() => handleTemplateClick(template)}
                    onDeploy={() => handleDeploy(template)}
                    onFork={() => handleFork(template)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {templatesData && templatesData.total > templatesData.pageSize && (
                <div className="flex justify-center gap-2 mt-8" data-testid="pagination">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="pagination-prev"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2">
                    {[...Array(Math.ceil(templatesData.total / templatesData.pageSize))].map((_, i) => {
                      const pageNum = i + 1;
                      const showPage = pageNum === 1 || 
                                      pageNum === page ||
                                      pageNum === Math.ceil(templatesData.total / templatesData.pageSize) ||
                                      Math.abs(pageNum - page) <= 1;
                      
                      if (!showPage && pageNum !== page - 2 && pageNum !== page + 2) return null;
                      if (pageNum === page - 2 || pageNum === page + 2) return <span key={i}>...</span>;

                      return (
                        <Button
                          key={i}
                          variant={pageNum === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!templatesData.hasMore}
                    data-testid="pagination-next"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Community Hub Sidebar */}
        {activeTab === 'community' && (
          <aside className="w-80 shrink-0">
            <CommunityHub />
          </aside>
        )}
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          isOpen={!!selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onDeploy={() => handleDeploy(selectedTemplate)}
          onFork={() => handleFork(selectedTemplate)}
          onSelectTemplate={handleTemplateClick}
        />
      )}
    </PageShell>
  );
}