// @ts-nocheck
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Star, GitFork, Eye, Search, Filter, Grid3X3, List, 
  Sparkles, TrendingUp, Clock, Download, X, ExternalLink,
  ChevronDown, Loader2, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  authorId: number | null;
  authorName: string;
  authorVerified: boolean;
  uses: number;
  stars: number;
  forks: number;
  language: string;
  framework: string | null;
  difficulty: string;
  estimatedTime: number;
  features: string[];
  isFeatured: boolean;
  isOfficial: boolean;
  published: boolean;
  isCommunity: boolean;
  status: string;
  githubUrl: string | null;
  demoUrl: string | null;
  livePreviewUrl: string | null;
  thumbnailUrl: string | null;
  version: string;
  license: string;
  price: string;
  downloads: number;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  templateCount: number;
  order: number;
  isActive: boolean;
}

interface TemplatesResponse {
  templates: Template[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface FeaturedResponse {
  templates: Template[];
  total: number;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  expert: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const SORT_OPTIONS = [
  { value: 'downloads', label: 'Most Downloads' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'recent', label: 'Recently Added' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'forks', label: 'Most Forked' },
];

export function TemplatesMarketplace() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('downloads');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userReview, setUserReview] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 12;

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (sortBy) params.set('sortBy', sortBy);
    if (minRating) params.set('minRating', minRating.toString());
    if (difficulty) params.set('difficulty', difficulty);
    params.set('limit', limit.toString());
    params.set('offset', (page * limit).toString());
    return params.toString();
  }, [searchQuery, selectedCategory, sortBy, minRating, difficulty, page]);

  const { data: templatesData, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery<TemplatesResponse>({
    queryKey: ['/api/templates', buildQueryParams()],
  });

  const { data: featuredData, isLoading: featuredLoading } = useQuery<FeaturedResponse>({
    queryKey: ['/api/templates/featured'],
  });

  const { data: categories } = useQuery<TemplateCategory[]>({
    queryKey: ['/api/templates/categories'],
  });

  const rateMutation = useMutation({
    mutationFn: async ({ templateId, rating, review }: { templateId: string; rating: number; review: string }) => {
      return apiRequest('POST', `/api/templates/${templateId}/rate`, { rating, review });
    },
    onSuccess: () => {
      toast({
        title: 'Rating Submitted',
        description: 'Thank you for rating this template!',
      });
      setRatingModalOpen(false);
      setUserRating(0);
      setUserReview('');
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Rating Failed',
        description: error.message || 'Failed to submit rating',
        variant: 'destructive',
      });
    },
  });

  const forkMutation = useMutation({
    mutationFn: async ({ templateId, projectName }: { templateId: string; projectName?: string }) => {
      return apiRequest('POST', `/api/templates/${templateId}/fork`, { projectName });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Template Forked!',
        description: `Project "${data.project?.name}" has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fork Failed',
        description: error.message || 'Failed to fork template',
        variant: 'destructive',
      });
    },
  });

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    refetchTemplates();
  }, [refetchTemplates]);

  const handleFork = useCallback((template: Template) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to fork this template',
        variant: 'destructive',
      });
      return;
    }
    forkMutation.mutate({ templateId: template.id });
  }, [user, forkMutation, toast]);

  const handleRate = useCallback((template: Template) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to rate this template',
        variant: 'destructive',
      });
      return;
    }
    setSelectedTemplate(template);
    setRatingModalOpen(true);
  }, [user, toast]);

  const handleSubmitRating = useCallback(() => {
    if (!selectedTemplate || userRating === 0) return;
    rateMutation.mutate({
      templateId: selectedTemplate.id,
      rating: userRating,
      review: userReview,
    });
  }, [selectedTemplate, userRating, userReview, rateMutation]);

  const handlePreview = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  }, []);

  const StarRating = ({ rating, size = 'sm', interactive = false, onRate }: { 
    rating: number; 
    size?: 'sm' | 'md' | 'lg';
    interactive?: boolean;
    onRate?: (rating: number) => void;
  }) => {
    const sizeClasses = {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    };
    
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onRate?.(star)}
            className={cn(
              "transition-colors",
              interactive && "cursor-pointer hover:scale-110"
            )}
            data-testid={`star-rating-${star}`}
          >
            <Star
              className={cn(
                sizeClasses[size],
                star <= rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-gray-300 dark:text-gray-600"
              )}
            />
          </button>
        ))}
      </div>
    );
  };

  const TemplateCardSkeleton = () => (
    <Card className="h-full">
      <div className="relative h-40">
        <Skeleton className="w-full h-full" />
      </div>
      <CardContent className="p-4">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );

  const TemplateCard = ({ template }: { template: Template }) => (
    <LazyMotionDiv
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="h-full hover:shadow-lg transition-all duration-300 overflow-hidden group"
        data-testid={`template-card-${template.id}`}
      >
        <div 
          className="relative h-40 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/10 cursor-pointer overflow-hidden"
          onClick={() => handlePreview(template)}
        >
          {template.thumbnailUrl ? (
            <img
              src={template.thumbnailUrl}
              alt={template.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl font-bold text-orange-500/30">
                {template.language?.substring(0, 2).toUpperCase() || 'TP'}
              </span>
            </div>
          )}
          
          <div className="absolute top-2 left-2 flex gap-1.5">
            {template.isFeatured && (
              <Badge 
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid={`featured-badge-${template.id}`}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
            {template.isOfficial && (
              <Badge variant="secondary">Official</Badge>
            )}
          </div>
          
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(template);
              }}
              data-testid={`preview-button-${template.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="mb-2">
            <h3 
              className="font-semibold text-base line-clamp-1 cursor-pointer hover:text-orange-500 transition-colors"
              onClick={() => handlePreview(template)}
              data-testid={`template-name-${template.id}`}
            >
              {template.name}
            </h3>
            <p className="text-[13px] text-muted-foreground line-clamp-2 mt-1">
              {template.description}
            </p>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[11px]">
                {template.authorName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground">
              {template.authorName}
            </span>
            {template.authorVerified && (
              <Badge variant="outline" className="text-[11px] py-0 px-1">
                Verified
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between mb-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span 
                className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                onClick={() => handleRate(template)}
                data-testid={`rating-display-${template.id}`}
              >
                <StarRating rating={template.rating} />
                <span className="ml-1">
                  {template.rating?.toFixed(1) || '0.0'} ({template.reviewCount || 0})
                </span>
              </span>
            </div>
            <span 
              className="flex items-center gap-1"
              data-testid={`fork-count-${template.id}`}
            >
              <GitFork className="h-3 w-3" />
              {template.forks}
            </span>
          </div>

          <div className="flex gap-1.5 flex-wrap mb-3">
            <Badge variant="secondary" className="text-[11px]">
              {template.language}
            </Badge>
            {template.framework && (
              <Badge variant="outline" className="text-[11px]">
                {template.framework}
              </Badge>
            )}
            <Badge className={cn("text-[11px]", DIFFICULTY_COLORS[template.difficulty])}>
              {template.difficulty}
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleFork(template)}
              disabled={forkMutation.isPending}
              data-testid={`fork-button-${template.id}`}
            >
              {forkMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <GitFork className="h-3 w-3 mr-1" />
              )}
              Fork
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              onClick={() => handlePreview(template)}
              data-testid={`use-template-button-${template.id}`}
            >
              Use Template
            </Button>
          </div>
        </CardContent>
      </Card>
    </LazyMotionDiv>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="templates-marketplace">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="marketplace-title">
              Templates Marketplace
            </h1>
            <p className="text-muted-foreground mt-1">
              Discover and use professional templates to kickstart your projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchTemplates()}
              data-testid="refresh-button"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('grid')}
                data-testid="grid-view-button"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('list')}
                data-testid="list-view-button"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {!featuredLoading && featuredData?.templates && featuredData.templates.length > 0 && (
          <section className="mb-10" data-testid="featured-section">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl font-semibold">Featured Templates</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredData.templates.slice(0, 4).map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </section>
        )}

        <div className="mb-6 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Button type="submit" data-testid="search-button">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="filter-toggle-button"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              <ChevronDown className={cn(
                "h-4 w-4 ml-1 transition-transform",
                showFilters && "rotate-180"
              )} />
            </Button>
          </form>

          <div className={cn("collapsible-content", showFilters && "expanded")}>
            <div>
              <Card className="p-4" data-testid="filters-panel">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-[13px] mb-2 block">Category</Label>
                      <Select
                        value={selectedCategory}
                        onValueChange={(value) => {
                          setSelectedCategory(value);
                          setPage(0);
                        }}
                      >
                        <SelectTrigger data-testid="category-select">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.slug}>
                              {cat.name} ({cat.templateCount})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[13px] mb-2 block">Sort By</Label>
                      <Select
                        value={sortBy}
                        onValueChange={(value) => {
                          setSortBy(value);
                          setPage(0);
                        }}
                      >
                        <SelectTrigger data-testid="sort-select">
                          <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SORT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[13px] mb-2 block">Minimum Rating</Label>
                      <Select
                        value={minRating?.toString() || 'any'}
                        onValueChange={(value) => {
                          setMinRating(value === 'any' ? null : parseInt(value));
                          setPage(0);
                        }}
                      >
                        <SelectTrigger data-testid="rating-filter-select">
                          <SelectValue placeholder="Any rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any Rating</SelectItem>
                          <SelectItem value="4">4+ Stars</SelectItem>
                          <SelectItem value="3">3+ Stars</SelectItem>
                          <SelectItem value="2">2+ Stars</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[13px] mb-2 block">Difficulty</Label>
                      <Select
                        value={difficulty || 'any'}
                        onValueChange={(value) => {
                          setDifficulty(value === 'any' ? null : value);
                          setPage(0);
                        }}
                      >
                        <SelectTrigger data-testid="difficulty-filter-select">
                          <SelectValue placeholder="Any difficulty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any Difficulty</SelectItem>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSortBy('downloads');
                        setMinRating(null);
                        setDifficulty(null);
                        setSearchQuery('');
                        setPage(0);
                      }}
                      data-testid="clear-filters-button"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear Filters
                    </Button>
                  </div>
                </Card>
            </div>
          </div>
        </div>

        <section data-testid="templates-grid">
          {templatesLoading ? (
            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' 
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid-cols-1"
            )}>
              {Array.from({ length: 8 }).map((_, i) => (
                <TemplateCardSkeleton key={i} />
              ))}
            </div>
          ) : templatesData?.templates && templatesData.templates.length > 0 ? (
            <>
              <div className={cn(
                "grid gap-4",
                viewMode === 'grid' 
                  ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid-cols-1"
              )}>
                <AnimatePresence mode="popLayout">
                  {templatesData.templates.map((template) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </AnimatePresence>
              </div>

              {templatesData.pagination.hasMore && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    data-testid="load-more-button"
                  >
                    Load More Templates
                  </Button>
                </div>
              )}

              <div className="text-center text-[13px] text-muted-foreground mt-4">
                Showing {templatesData.templates.length} of {templatesData.pagination.total} templates
              </div>
            </>
          ) : (
            <div className="text-center py-12" data-testid="empty-state">
              <div className="text-muted-foreground mb-4">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-[15px] font-medium">No templates found</h3>
                <p className="mt-1">Try adjusting your search or filters</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setMinRating(null);
                  setDifficulty(null);
                  setPage(0);
                }}
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </section>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  {selectedTemplate?.name}
                  {selectedTemplate?.isFeatured && (
                    <Badge className="bg-orange-500">Featured</Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {selectedTemplate?.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="preview" className="flex-1 flex flex-col h-full">
            <TabsList className="mx-6 mt-2 w-auto justify-start">
              <TabsTrigger value="preview" data-testid="preview-tab">
                <Eye className="h-4 w-4 mr-2" />
                Live Preview
              </TabsTrigger>
              <TabsTrigger value="details" data-testid="details-tab">
                Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="flex-1 m-0 p-0">
              {selectedTemplate?.livePreviewUrl ? (
                <iframe
                  src={selectedTemplate.livePreviewUrl}
                  className="w-full h-full border-0"
                  title={`Preview of ${selectedTemplate.name}`}
                  sandbox="allow-scripts allow-same-origin"
                  data-testid="live-preview-iframe"
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-muted/50">
                  <div className="text-center">
                    <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No live preview available</p>
                    {selectedTemplate?.demoUrl && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(selectedTemplate.demoUrl!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Demo URL
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="details" className="flex-1 m-0 overflow-auto">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[13px] text-muted-foreground">Language</Label>
                      <p className="font-medium">{selectedTemplate?.language}</p>
                    </div>
                    <div>
                      <Label className="text-[13px] text-muted-foreground">Framework</Label>
                      <p className="font-medium">{selectedTemplate?.framework || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-[13px] text-muted-foreground">Difficulty</Label>
                      <Badge className={DIFFICULTY_COLORS[selectedTemplate?.difficulty || 'beginner']}>
                        {selectedTemplate?.difficulty}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-[13px] text-muted-foreground">Estimated Time</Label>
                      <p className="font-medium">{selectedTemplate?.estimatedTime} min</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-[13px] text-muted-foreground mb-2 block">Stats</Label>
                    <div className="flex gap-6 text-[13px]">
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400" />
                        {selectedTemplate?.rating?.toFixed(1)} ({selectedTemplate?.reviewCount} reviews)
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="h-4 w-4" />
                        {selectedTemplate?.forks} forks
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        {selectedTemplate?.downloads} downloads
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {selectedTemplate?.features && selectedTemplate.features.length > 0 && (
                    <div>
                      <Label className="text-[13px] text-muted-foreground mb-2 block">Features</Label>
                      <ul className="space-y-1">
                        {selectedTemplate.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-[13px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Separator />

                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600"
                      onClick={() => selectedTemplate && handleFork(selectedTemplate)}
                      disabled={forkMutation.isPending}
                      data-testid="modal-fork-button"
                    >
                      {forkMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <GitFork className="h-4 w-4 mr-2" />
                      )}
                      Fork Template
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => selectedTemplate && handleRate(selectedTemplate)}
                      data-testid="modal-rate-button"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Rate
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={ratingModalOpen} onOpenChange={setRatingModalOpen}>
        <DialogContent className="max-w-md" data-testid="rating-modal">
          <DialogHeader>
            <DialogTitle>Rate Template</DialogTitle>
            <DialogDescription>
              Share your experience with "{selectedTemplate?.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[13px] mb-3 block">Your Rating</Label>
              <div className="flex gap-2 justify-center">
                <StarRating
                  rating={userRating}
                  size="lg"
                  interactive
                  onRate={setUserRating}
                />
              </div>
              <p className="text-center text-[13px] text-muted-foreground mt-2">
                {userRating === 0 && 'Click a star to rate'}
                {userRating === 1 && 'Poor'}
                {userRating === 2 && 'Fair'}
                {userRating === 3 && 'Good'}
                {userRating === 4 && 'Very Good'}
                {userRating === 5 && 'Excellent!'}
              </p>
            </div>

            <div>
              <Label htmlFor="review" className="text-[13px] mb-2 block">
                Review (Optional)
              </Label>
              <Textarea
                id="review"
                placeholder="Share your experience with this template..."
                value={userReview}
                onChange={(e) => setUserReview(e.target.value)}
                rows={4}
                data-testid="review-textarea"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRatingModalOpen(false)}
              data-testid="cancel-rating-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRating}
              disabled={userRating === 0 || rateMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="submit-rating-button"
            >
              {rateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Submit Rating
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TemplatesMarketplace;
