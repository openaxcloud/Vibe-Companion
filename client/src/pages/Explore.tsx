import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ECodeLoading } from '@/components/ECodeLoading';
import { ReplitLayout } from '@/components/layout/ReplitLayout';
import {
  Search,
  TrendingUp,
  Star,
  GitFork,
  Clock,
  Filter,
  Globe,
  Code2,
  Gamepad2,
  Palette,
  Database,
  Cpu,
  BookOpen,
  Music,
  Video,
  Shield,
} from 'lucide-react';

// Category type for type safety
interface Category {
  id: string;
  name: string;
  icon: typeof Globe;
}

// Language categories and icons
const categories: Category[] = [
  { id: 'all', name: 'All', icon: Globe },
  { id: 'web', name: 'Web', icon: Globe },
  { id: 'games', name: 'Games', icon: Gamepad2 },
  { id: 'art', name: 'Art', icon: Palette },
  { id: 'data', name: 'Data Science', icon: Database },
  { id: 'ai', name: 'AI/ML', icon: Cpu },
  { id: 'education', name: 'Education', icon: BookOpen },
  { id: 'music', name: 'Music', icon: Music },
  { id: 'video', name: 'Video', icon: Video },
  { id: 'security', name: 'Security', icon: Shield },
];

export default function Explore() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
  
  // Project type for explore page
  interface ExploreProject {
    id: number;
    name: string;
    description?: string;
    language?: string;
    stars?: number;
    forks?: number;
    views?: number;
    owner?: { username: string; avatar?: string };
    createdAt?: string;
    updatedAt?: string;
  }

  // Fetch public projects from API
  const { data: publicRepls = [], isLoading, error: exploreError } = useQuery<ExploreProject[]>({
    queryKey: ['/api/explore/projects', { category: selectedCategory, sort: sortBy, search: searchQuery }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey as [string, any];
      const searchParams = new URLSearchParams();
      if (params.category && params.category !== 'all') searchParams.append('category', params.category);
      if (params.sort) searchParams.append('sort', params.sort);
      if (params.search) searchParams.append('search', params.search);
      
      const response = await fetch(`/api/explore/projects?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    retry: 2,
  });

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      'JavaScript': 'bg-yellow-500',
      'TypeScript': 'bg-blue-500',
      'Python': 'bg-green-500',
      'Java': 'bg-orange-500',
      'Go': 'bg-cyan-500',
      'Rust': 'bg-red-500',
      'C++': 'bg-purple-500',
      'Ruby': 'bg-pink-500',
    };
    return colors[language] || 'bg-gray-500';
  };



  return (
    <ReplitLayout showSidebar={false}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold" data-testid="text-explore-title">Explore Community</h1>
              <Button variant="outline" onClick={() => navigate('/dashboard')} data-testid="button-back-dashboard">
                Back to Dashboard
              </Button>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search repls, tags, or descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-explore"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trending" data-testid="select-sort-trending">Trending</SelectItem>
                  <SelectItem value="popular" data-testid="select-sort-popular">Most Popular</SelectItem>
                  <SelectItem value="recent" data-testid="select-sort-recent">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 py-4 overflow-x-auto">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center gap-2 whitespace-nowrap"
                  data-testid={`button-category-${category.id}`}
                >
                  <Icon className="h-4 w-4" />
                  {category.name}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-muted-foreground">Total Repls</p>
                  <p className="text-2xl font-bold">12,345</p>
                </div>
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">3,456</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-muted-foreground">Total Runs</p>
                  <p className="text-2xl font-bold">456K</p>
                </div>
                <Globe className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-muted-foreground">Languages</p>
                  <p className="text-2xl font-bold">50+</p>
                </div>
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Repls Grid */}
        {isLoading ? (
          <div className="col-span-full py-12">
            <ECodeLoading />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicRepls.map((repl: any) => {
            const CategoryIcon = categories.find(c => c.id === repl.category)?.icon || Globe;
            return (
              <Card 
                key={repl.id} 
                className="cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(`/@${repl.author}/${repl.slug}`)}
                data-testid={`card-explore-project-${repl.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={repl.avatar || undefined} />
                        <AvatarFallback>{repl.author?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-[15px]">{repl.name}</CardTitle>
                        <p className="text-[13px] text-muted-foreground">by {repl.author}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`${getLanguageColor(repl.language)}`}>
                      {repl.language}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-[13px] text-muted-foreground line-clamp-2">
                    {repl.description}
                  </p>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {repl.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[11px]">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {repl.stars}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="h-3 w-3" />
                        {repl.forks}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {repl.runs}
                      </span>
                    </div>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {repl.lastUpdated}
                    </span>
                  </div>
                  
                  {/* Category */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[13px] text-muted-foreground">
                      {categories.find(c => c.id === repl.category)?.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        )}

        {!isLoading && publicRepls.length === 0 && (
          <div className="text-center py-12">
            <Code2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-[15px] font-semibold mb-2">No repls found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
      </div>
    </ReplitLayout>
  );
}