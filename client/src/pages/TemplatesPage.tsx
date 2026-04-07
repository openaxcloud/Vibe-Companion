// @ts-nocheck
import { useState } from 'react';
import { useLocation } from 'wouter';
import { LazyMotionDiv } from '@/lib/motion';
import { useDebounce } from '@/hooks/use-debounce';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, Code2, Sparkles, Globe, Database, Gamepad2, Bot,
  Star, GitFork, Users, ArrowRight, Server, Smartphone,
  Play, Eye, Download, Heart, Filter, Cpu
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Template {
  id: number;
  name: string;
  description: string;
  author?: any;
  category?: string;
  difficulty?: string;
  technologies?: string[];
  stars?: number;
  forks?: number;
  users?: number;
  featured?: boolean;
  trending?: boolean;
  image?: string;
}

// Template categories
const categories = [
  { id: 'all', name: 'All Templates', icon: Code2, color: 'bg-gray-500' },
  { id: 'webapp', name: 'Web Apps', icon: Globe, color: 'bg-blue-500' },
  { id: 'api', name: 'APIs & Backend', icon: Server, color: 'bg-green-500' },
  { id: 'data', name: 'Data Science', icon: Database, color: 'bg-purple-500' },
  { id: 'game', name: 'Games', icon: Gamepad2, color: 'bg-yellow-500' },
  { id: 'mobile', name: 'Mobile', icon: Smartphone, color: 'bg-pink-500' },
  { id: 'ai', name: 'AI & ML', icon: Bot, color: 'bg-indigo-500' },
];

export default function TemplatesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch templates from API
  const buildQueryUrl = () => {
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.append('category', selectedCategory);
    if (debouncedSearch) params.append('q', debouncedSearch);
    const queryString = params.toString();
    return queryString ? `/api/marketplace/templates?${queryString}` : '/api/marketplace/templates';
  };

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: [buildQueryUrl()],
  });

  const templatesArr = Array.isArray(templates) ? templates : [];

  const useTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const data = await apiRequest<{ id: number }>('POST', '/api/projects', {
        name: `Project from Template #${templateId}`,
        templateId
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Project created",
        description: "Your project has been created from the template.",
      });
      navigate(`/ide/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const filteredTemplates = templatesArr.filter(Boolean);

  return (
    <PageShell>
      <PageHeader
        title="Templates"
        description="Start your project with a professional template"
      />

      <div className="space-y-6">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-templates"
            />
          </div>
          <Button variant="outline" data-testid="button-filter-templates">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Categories */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="flex-shrink-0"
                  data-testid={`button-category-${cat.id}`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {cat.name}
                </Button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Featured Templates Section */}
        {!isLoading && filteredTemplates.some(t => t?.featured) && selectedCategory === 'all' && !searchQuery && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Featured Templates</h2>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Curated by E-Code
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates
                .filter(t => t?.featured)
                .slice(0, 3)
                .map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={() => useTemplateMutation.mutate(template.id)}
                    index={index}
                  />
                ))}
            </div>
          </div>
        )}

        {/* All Templates */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              {selectedCategory === 'all' ? 'All Templates' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
            <span className="text-[13px] text-muted-foreground">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-40 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Code2 className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-[15px] font-semibold mb-2">No templates found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchQuery 
                    ? `No templates match "${searchQuery}". Try a different search term.`
                    : 'No templates available in this category yet.'}
                </p>
                {searchQuery && (
                  <Button variant="outline" onClick={() => setSearchQuery('')} data-testid="button-clear-search">
                    Clear Search
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template, index) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={() => useTemplateMutation.mutate(template.id)}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function TemplateCard({ template, onUse, index }: { template: Template; onUse: () => void; index: number }) {
  return (
    <div
      className="animate-slide-in-up opacity-0 hover:-translate-y-1 transition-transform"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
    >
      <Card className="h-full flex flex-col hover:shadow-lg transition-shadow" data-testid={`card-template-${template.id}`}>
        {template.image && (
          <div className="relative h-48 overflow-hidden rounded-t-lg">
            <img 
              src={template.image} 
              alt={template.name ?? 'Template'}
              className="w-full h-full object-cover"
            />
            {template.trending && (
              <Badge className="absolute top-2 right-2 bg-orange-500">
                <Sparkles className="h-3 w-3 mr-1" />
                Trending
              </Badge>
            )}
          </div>
        )}
        
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="line-clamp-1">{template.name}</CardTitle>
              <p className="text-[13px] text-muted-foreground mt-1">
                by {typeof template.author === 'object' ? template.author?.name : (template.author ?? 'Unknown')}
              </p>
            </div>
            {template.difficulty && (
              <Badge variant="outline" className="flex-shrink-0">
                {template.difficulty}
              </Badge>
            )}
          </div>
          <CardDescription className="line-clamp-2 mt-2">
            {template.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          {template.technologies && template.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.technologies.slice(0, 4).map((tech, i) => (
                <Badge key={i} variant="secondary" className="text-[11px]">
                  {tech}
                </Badge>
              ))}
              {template.technologies.length > 4 && (
                <Badge variant="secondary" className="text-[11px]">
                  +{template.technologies.length - 4}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
            {template.stars !== undefined && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {template.stars}
              </div>
            )}
            {template.forks !== undefined && (
              <div className="flex items-center gap-1">
                <GitFork className="h-3 w-3" />
                {template.forks}
              </div>
            )}
            {template.users !== undefined && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {template.users}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button 
            className="flex-1" 
            onClick={onUse}
            data-testid={`button-use-template-${template.id}`}
          >
            Use Template
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            data-testid={`button-preview-${template.id}`}
            onClick={() => navigate(`/ide/${template.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
