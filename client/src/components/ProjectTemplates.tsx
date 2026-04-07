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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
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
    author: { name: 'E-Code Team', verified: true },
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
    author: { name: 'E-Code Team', verified: true },
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
    author: { name: 'E-Code Team', verified: true },
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projectName, setProjectName] = useState('');

  // Icon mapping for template categories
  const iconMap: Record<string, React.ReactNode> = {
    'nextjs-blog': <FileCode className="h-8 w-8" />,
    'express-api': <Server className="h-8 w-8" />,
    'react-dashboard': <BarChart className="h-8 w-8" />,
    'discord-bot': <Bot className="h-8 w-8" />,
    'python-flask': <Globe className="h-8 w-8" />,
    'vue-spa': <Code className="h-8 w-8" />,
    'phaser-game': <Gamepad className="h-8 w-8" />,
    'default': <Code className="h-8 w-8" />
  };

  // Fetch templates from API
  const { data: apiTemplates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['/api/templates'],
  });

  // Map API templates with icons
  const templates = apiTemplates.map((template) => ({
    ...template,
    icon: iconMap[template.id] || iconMap.default
  }));

  // Create project from template mutation
  const createProjectMutation = useMutation({
    mutationFn: async ({ template, name }: { template: Template; name: string }) => {
      const response = await apiRequest('/api/projects/from-template', {
        method: 'POST',
        body: JSON.stringify({
          templateId: template.id,
          name: name || `My ${template.name}`,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create project');
      }
      return response.json();
    },
    onSuccess: (project) => {
      toast({
        title: 'Project created!',
        description: `"${project.name}" has been created successfully.`,
      });
      navigate(`/editor/${project.id}`);
      setShowCreateDialog(false);
      setShowPreviewDialog(false);
      setProjectName('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create project',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  });

  const handleUseTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setProjectName(`My ${template.name}`);
    setShowCreateDialog(true);
  };

  const handleCreateProject = () => {
    if (!selectedTemplate || !projectName.trim()) return;
    createProjectMutation.mutate({ template: selectedTemplate, name: projectName.trim() });
  };

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

          {/* Search and Filters - Mobile optimized */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-full sm:w-[180px] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="recent">Recently Added</SelectItem>
                <SelectItem value="stars">Most Stars</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categories - Mobile optimized horizontal scroll */}
          <div className="w-full -mx-3 sm:mx-0 px-3 sm:px-0">
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {TEMPLATE_CATEGORIES.map(category => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap h-8 sm:h-9 px-3 text-xs sm:text-sm"
                  >
                    <category.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{category.name}</span>
                    <span className="sm:hidden">
                      {category.name.split(' ')[0]}
                    </span>
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>

        {/* Templates Grid/List - Enhanced responsive layout */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredTemplates.map(template => (
              <Card 
                key={template.id}
                className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group hover:border-[var(--ecode-accent)]"
                onClick={() => handleTemplateClick(template)}
              >
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 sm:p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      {React.cloneElement(template.icon as React.ReactElement, { 
                        className: 'h-6 w-6 sm:h-8 sm:w-8' 
                      })}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      {template.isFeatured && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">
                          <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          <span className="hidden sm:inline">Featured</span>
                          <span className="sm:hidden">★</span>
                        </Badge>
                      )}
                      {template.isOfficial && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">
                          <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          <span className="hidden sm:inline">Official</span>
                          <span className="sm:hidden">✓</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-base sm:text-lg line-clamp-1">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs sm:text-sm mt-1">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 -mt-2">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
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
                        <Badge key={tag} variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {template.stats.uses > 999 ? `${(template.stats.uses/1000).toFixed(1)}k` : template.stats.uses}
                        </span>
                        <span className="flex items-center">
                          <Star className="h-3 w-3 mr-1" />
                          {template.stats.stars}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Avatar className="h-5 w-5 sm:h-6 sm:w-6">
                          <AvatarImage src={template.author.avatar} />
                          <AvatarFallback className="text-[8px] sm:text-[10px]">
                            {template.author.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                          {template.author.name}
                        </span>
                        {template.author.verified && (
                          <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
                {showCreateButton && (
                  <CardFooter className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <Button 
                      className="w-full h-8 sm:h-9 text-xs sm:text-sm"
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
                          handleUseTemplate(template);
                        }}
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
                onClick={() => handleUseTemplate(selectedTemplate)}
              >
                Use This Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Project Dialog */}
      {selectedTemplate && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Project from Template</DialogTitle>
              <DialogDescription>
                Give your new project a name to get started with the {selectedTemplate.name} template.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && projectName.trim()) {
                      handleCreateProject();
                    }
                  }}
                />
              </div>
              
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded bg-background">
                  {React.cloneElement(selectedTemplate.icon as React.ReactElement, { className: 'h-5 w-5' })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedTemplate.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedTemplate.language}</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false);
                  setProjectName('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!projectName.trim() || createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
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