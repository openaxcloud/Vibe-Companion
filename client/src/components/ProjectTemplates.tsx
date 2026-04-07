import React, { useState } from 'react';
import { 
  Code, Zap, Package, Globe, Database, Shield, 
  Smartphone, Gamepad, FileCode, Terminal, Server,
  Bot, BarChart, Palette, Music, Camera, Video,
  Heart, Star, Users, TrendingUp, Clock, Filter,
  Search, Grid, List, ChevronRight, ExternalLink,
  GitBranch, CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  tags: string[];
  author: {
    name: string;
    avatar?: string;
    verified?: boolean;
  };
  stats: {
    uses: number;
    stars: number;
    forks: number;
  };
  language: string;
  framework?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  features: string[];
  preview?: string;
  isFeatured?: boolean;
  isOfficial?: boolean;
  createdAt: string;
}

const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: Grid },
  { id: 'web', name: 'Web Apps', icon: Globe },
  { id: 'api', name: 'APIs & Backend', icon: Server },
  { id: 'game', name: 'Games', icon: Gamepad },
  { id: 'mobile', name: 'Mobile', icon: Smartphone },
  { id: 'data', name: 'Data & ML', icon: BarChart },
  { id: 'bot', name: 'Bots & Automation', icon: Bot },
  { id: 'starter', name: 'Starter Projects', icon: Zap },
  { id: 'tools', name: 'Dev Tools', icon: Terminal },
];

const MOCK_TEMPLATES: Template[] = [
  {
    id: 'nextjs-blog',
    name: 'Next.js Blog Starter',
    description: 'A modern blog with MDX support, dark mode, and SEO optimization',
    icon: <FileCode className="h-8 w-8" />,
    category: 'web',
    tags: ['nextjs', 'react', 'blog', 'mdx'],
    author: { name: 'Replit Team', verified: true },
    stats: { uses: 15420, stars: 892, forks: 234 },
    language: 'TypeScript',
    framework: 'Next.js',
    difficulty: 'beginner',
    estimatedTime: '5 mins',
    features: ['MDX blog posts', 'Dark mode', 'SEO optimized', 'RSS feed'],
    isFeatured: true,
    isOfficial: true,
    createdAt: '2024-01-15'
  },
  {
    id: 'express-api',
    name: 'Express REST API',
    description: 'Production-ready REST API with authentication and PostgreSQL',
    icon: <Server className="h-8 w-8" />,
    category: 'api',
    tags: ['express', 'nodejs', 'api', 'postgresql'],
    author: { name: 'Replit Team', verified: true },
    stats: { uses: 23100, stars: 1243, forks: 567 },
    language: 'JavaScript',
    framework: 'Express.js',
    difficulty: 'intermediate',
    estimatedTime: '10 mins',
    features: ['JWT auth', 'PostgreSQL', 'API docs', 'Rate limiting'],
    isFeatured: true,
    isOfficial: true,
    createdAt: '2024-01-10'
  },
  {
    id: 'react-dashboard',
    name: 'React Admin Dashboard',
    description: 'Beautiful admin dashboard with charts, tables, and real-time data',
    icon: <BarChart className="h-8 w-8" />,
    category: 'web',
    tags: ['react', 'dashboard', 'admin', 'charts'],
    author: { name: 'johndoe', avatar: 'https://github.com/johndoe.png' },
    stats: { uses: 8920, stars: 456, forks: 123 },
    language: 'TypeScript',
    framework: 'React',
    difficulty: 'intermediate',
    estimatedTime: '15 mins',
    features: ['Real-time charts', 'Data tables', 'User management', 'Dark mode'],
    createdAt: '2024-01-20'
  },
  {
    id: 'discord-bot',
    name: 'Discord Bot Starter',
    description: 'Feature-rich Discord bot with commands, events, and database',
    icon: <Bot className="h-8 w-8" />,
    category: 'bot',
    tags: ['discord', 'bot', 'nodejs'],
    author: { name: 'Replit Team', verified: true },
    stats: { uses: 12500, stars: 678, forks: 234 },
    language: 'JavaScript',
    framework: 'Discord.js',
    difficulty: 'beginner',
    estimatedTime: '5 mins',
    features: ['Slash commands', 'Event handling', 'Database integration', 'Moderation tools'],
    isOfficial: true,
    createdAt: '2024-01-12'
  },
  {
    id: 'python-ml',
    name: 'Machine Learning Starter',
    description: 'Get started with ML using scikit-learn and pandas',
    icon: <BarChart className="h-8 w-8" />,
    category: 'data',
    tags: ['python', 'ml', 'scikit-learn', 'pandas'],
    author: { name: 'dataexpert', avatar: 'https://github.com/dataexpert.png' },
    stats: { uses: 5670, stars: 345, forks: 89 },
    language: 'Python',
    difficulty: 'intermediate',
    estimatedTime: '20 mins',
    features: ['Data preprocessing', 'Model training', 'Visualization', 'Jupyter notebooks'],
    createdAt: '2024-01-18'
  },
  {
    id: 'phaser-game',
    name: 'Phaser Game Starter',
    description: '2D game development with Phaser.js game engine',
    icon: <Gamepad className="h-8 w-8" />,
    category: 'game',
    tags: ['phaser', 'game', 'javascript', '2d'],
    author: { name: 'gamedev', avatar: 'https://github.com/gamedev.png' },
    stats: { uses: 3420, stars: 234, forks: 67 },
    language: 'JavaScript',
    framework: 'Phaser.js',
    difficulty: 'intermediate',
    estimatedTime: '15 mins',
    features: ['Physics engine', 'Sprite animations', 'Sound effects', 'Mobile support'],
    createdAt: '2024-01-22'
  }
];

interface ProjectTemplatesProps {
  onSelectTemplate?: (template: Template) => void;
  showCreateButton?: boolean;
}

export function ProjectTemplates({ onSelectTemplate, showCreateButton = true }: ProjectTemplatesProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'stars'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Fetch templates from API
  const { data: templates = MOCK_TEMPLATES, isLoading } = useQuery({
    queryKey: ['/api/templates', selectedCategory, searchQuery, sortBy],
    queryFn: async () => {
      // For now, return mock data
      return MOCK_TEMPLATES;
    }
  });

  // Create project from template mutation
  const createProjectMutation = useMutation({
    mutationFn: async (template: Template) => {
      const res = await apiRequest('POST', '/api/projects/from-template', {
        templateId: template.id,
        name: `My ${template.name}`,
      });
      if (!res.ok) throw new Error('Failed to create project');
      return res.json();
    },
    onSuccess: (project) => {
      toast({
        title: 'Project created',
        description: 'Your project has been created from the template',
      });
      navigate(`/editor/${project.id}`);
    },
    onError: () => {
      toast({
        title: 'Failed to create project',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  });

  // Filter and sort templates
  const filteredTemplates = templates
    .filter(template => {
      if (selectedCategory !== 'all' && template.category !== selectedCategory) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          template.name.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.stats.uses - a.stats.uses;
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'stars':
          return b.stats.stars - a.stats.stars;
        default:
          return 0;
      }
    });

  const handleTemplateClick = (template: Template) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    } else {
      setSelectedTemplate(template);
      setShowPreviewDialog(true);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-500';
      case 'intermediate':
        return 'text-yellow-500';
      case 'advanced':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Project Templates</h2>
              <p className="text-muted-foreground">
                Start with a pre-configured template to jumpstart your project
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="recent">Recently Added</SelectItem>
                <SelectItem value="stars">Most Stars</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categories */}
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex gap-2">
              {TEMPLATE_CATEGORIES.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center gap-2"
                >
                  <category.icon className="h-4 w-4" />
                  {category.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Templates Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <Card 
                key={template.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleTemplateClick(template)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-3 rounded-lg bg-primary/10">
                      {template.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      {template.isFeatured && (
                        <Badge variant="secondary">
                          <Star className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      {template.isOfficial && (
                        <Badge variant="secondary">
                          <Shield className="h-3 w-3 mr-1" />
                          Official
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <Code className="h-3 w-3 mr-1" />
                        {template.language}
                      </span>
                      {template.framework && (
                        <span className="flex items-center">
                          <Package className="h-3 w-3 mr-1" />
                          {template.framework}
                        </span>
                      )}
                      <span className={`flex items-center ${getDifficultyColor(template.difficulty)}`}>
                        <Zap className="h-3 w-3 mr-1" />
                        {template.difficulty}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {template.stats.uses.toLocaleString()}
                        </span>
                        <span className="flex items-center">
                          <Star className="h-3 w-3 mr-1" />
                          {template.stats.stars}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={template.author.avatar} />
                          <AvatarFallback>
                            {template.author.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          {template.author.name}
                        </span>
                        {template.author.verified && (
                          <Shield className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
                {showCreateButton && (
                  <CardFooter>
                    <Button 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        createProjectMutation.mutate(template);
                      }}
                      disabled={createProjectMutation.isPending}
                    >
                      {createProjectMutation.isPending ? 'Creating...' : 'Use Template'}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map(template => (
              <Card 
                key={template.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleTemplateClick(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        {React.cloneElement(template.icon as React.ReactElement, { className: 'h-6 w-6' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{template.name}</h3>
                          {template.isOfficial && (
                            <Shield className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {template.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{template.language}</span>
                          <span className={getDifficultyColor(template.difficulty)}>
                            {template.difficulty}
                          </span>
                          <span>{template.estimatedTime}</span>
                          <span className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            {template.stats.uses.toLocaleString()} uses
                          </span>
                        </div>
                      </div>
                    </div>
                    {showCreateButton && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          createProjectMutation.mutate(template);
                        }}
                        disabled={createProjectMutation.isPending}
                      >
                        Use Template
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>

      {/* Template Preview Dialog */}
      {selectedTemplate && (
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  {selectedTemplate.icon}
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl mb-1">
                    {selectedTemplate.name}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedTemplate.description}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Author and Stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedTemplate.author.avatar} />
                    <AvatarFallback>
                      {selectedTemplate.author.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{selectedTemplate.author.name}</p>
                    <p className="text-xs text-muted-foreground">Template author</p>
                  </div>
                  {selectedTemplate.author.verified && (
                    <Shield className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {selectedTemplate.stats.uses.toLocaleString()} uses
                  </span>
                  <span className="flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    {selectedTemplate.stats.stars} stars
                  </span>
                  <span className="flex items-center">
                    <GitBranch className="h-4 w-4 mr-1" />
                    {selectedTemplate.stats.forks} forks
                  </span>
                </div>
              </div>

              <Separator />

              {/* Template Details */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Technical Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Language</span>
                        <span>{selectedTemplate.language}</span>
                      </div>
                      {selectedTemplate.framework && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Framework</span>
                          <span>{selectedTemplate.framework}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Difficulty</span>
                        <span className={getDifficultyColor(selectedTemplate.difficulty)}>
                          {selectedTemplate.difficulty}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Setup Time</span>
                        <span>{selectedTemplate.estimatedTime}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Features</h4>
                  <ul className="space-y-1">
                    {selectedTemplate.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {selectedTemplate.preview && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Preview</h4>
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <img 
                        src={selectedTemplate.preview} 
                        alt={`${selectedTemplate.name} preview`}
                        className="w-full rounded"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  createProjectMutation.mutate(selectedTemplate);
                  setShowPreviewDialog(false);
                }}
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Use This Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// Export individual template categories for reuse
export { TEMPLATE_CATEGORIES, MOCK_TEMPLATES };
export type { Template };