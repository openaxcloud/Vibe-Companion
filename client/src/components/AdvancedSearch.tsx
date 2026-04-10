import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Search, Code, Users, FileText, Package, Folder,
  Clock, Star, TrendingUp, Filter, X, ChevronDown,
  Calendar, Tag, GitBranch, Globe, Lock, Eye
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SearchResult {
  id: string;
  type: 'project' | 'file' | 'user' | 'code' | 'template';
  title: string;
  description?: string;
  icon?: React.ReactNode;
  metadata?: {
    language?: string;
    owner?: string;
    stars?: number;
    lastModified?: string;
    visibility?: string;
    matches?: number;
    lineNumber?: number;
    preview?: string;
  };
  url: string;
}

interface SearchFilters {
  type: string[];
  language: string[];
  visibility: string[];
  dateRange: string;
  sortBy: string;
  owner?: string;
}

const SEARCH_TYPES = [
  { id: 'all', name: 'All', icon: Search },
  { id: 'projects', name: 'Projects', icon: Folder },
  { id: 'files', name: 'Files', icon: FileText },
  { id: 'code', name: 'Code', icon: Code },
  { id: 'users', name: 'Users', icon: Users },
  { id: 'templates', name: 'Templates', icon: Package },
];

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'go', 
  'rust', 'cpp', 'c', 'ruby', 'php', 'swift', 'kotlin'
];

const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'recent', label: 'Recently updated' },
  { value: 'stars', label: 'Most stars' },
  { value: 'name', label: 'Name (A-Z)' },
];

export function AdvancedSearch({ initialQuery = '' }: { initialQuery?: string }) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    type: [],
    language: [],
    visibility: ['public', 'private', 'unlisted'],
    dateRange: 'all',
    sortBy: 'relevance',
  });

  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      `/api/search?${new URLSearchParams({
        q: debouncedQuery,
        type: activeTab === 'all' ? '' : activeTab,
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [
            key, 
            Array.from(Array.isArray(value) ? value : [value]).join(',')
          ])
        ),
      }).toString()}`
    ],
    enabled: debouncedQuery.length > 0,
  });

  const displayResults = data ? (Array.isArray(data) ? data : (data as any).results || []) : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: [],
      language: [],
      visibility: ['public', 'private', 'unlisted'],
      dateRange: 'all',
      sortBy: 'relevance',
    });
  };

  const getResultIcon = (result: SearchResult) => {
    switch (result?.type) {
      case 'project':
        return <Folder className="h-4 w-4" />;
      case 'file':
        return <FileText className="h-4 w-4" />;
      case 'code':
        return <Code className="h-4 w-4" />;
      case 'user':
        return <Users className="h-4 w-4" />;
      case 'template':
        return <Package className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getLanguageColor = (language?: string) => {
    const colors: Record<string, string> = {
      javascript: 'bg-yellow-500',
      typescript: 'bg-blue-500',
      python: 'bg-green-500',
      java: 'bg-red-500',
      go: 'bg-cyan-500',
      rust: 'bg-orange-500',
    };
    return colors[language || ''] || 'bg-gray-500';
  };

  const filteredResults = displayResults.filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Search Header */}
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, files, code, users..."
            className="pl-10 pr-24 h-12 text-[15px]"
            autoFocus
            data-testid="input-search"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Button
              type="button"
              variant={showFilters ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {Object.values(filters).some(v => 
                Array.isArray(v) ? v.length > 0 : v !== 'all' && v !== 'relevance'
              ) && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {Object.values(filters).filter(v => 
                    Array.isArray(v) ? v.length > 0 : v !== 'all' && v !== 'relevance'
                  ).length}
                </Badge>
              )}
            </Button>
          </div>
        </form>

        {/* Search Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-search-type">
          <TabsList className="h-auto p-1 bg-muted/50">
            {SEARCH_TYPES.map(type => (
              <TabsTrigger
                key={type.id}
                value={type.id}
                className="flex items-center gap-2 data-[state=active]:bg-background"
                data-testid={`tab-search-${type.id}`}
              >
                <type.icon className="h-4 w-4" />
                {type.name}
                {filteredResults.filter((r: SearchResult) => 
                  type.id === 'all' || r?.type === type.id.slice(0, -1)
                ).length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {filteredResults.filter((r: SearchResult) => 
                      type.id === 'all' || r?.type === type.id.slice(0, -1)
                    ).length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Search Filters</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-[11px]"
                data-testid="button-clear-filters"
              >
                Clear all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Language Filter */}
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Language</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                      data-testid="button-language-filter"
                    >
                      {filters.language.length > 0 
                        ? `${filters.language.length} selected`
                        : 'Any language'
                      }
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <ScrollArea className="h-[300px]">
                      <div className="p-2 space-y-1">
                        {LANGUAGES.map(lang => (
                          <div key={lang} className="flex items-center space-x-2 p-2 hover:bg-surface-hover-solid rounded-sm">
                            <Checkbox
                              checked={filters.language.includes(lang)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  updateFilter('language', [...filters.language, lang]);
                                } else {
                                  updateFilter('language', filters.language.filter(l => l !== lang));
                                }
                              }}
                            />
                            <Label className="text-[13px] font-normal cursor-pointer flex-1">
                              {lang}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Visibility Filter */}
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Visibility</Label>
                <Select
                  value={filters.visibility.join(',')}
                  onValueChange={(value) => updateFilter('visibility', value.split(','))}
                >
                  <SelectTrigger className="h-9" data-testid="select-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public,private,unlisted">All</SelectItem>
                    <SelectItem value="public">Public only</SelectItem>
                    <SelectItem value="private">Private only</SelectItem>
                    <SelectItem value="unlisted">Unlisted only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Date Range</Label>
                <Select
                  value={filters.dateRange}
                  onValueChange={(value) => updateFilter('dateRange', value)}
                >
                  <SelectTrigger className="h-9" data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By Filter */}
              <div className="space-y-2">
                <Label className="text-[13px] font-medium">Sort By</Label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value) => updateFilter('sortBy', value)}
                >
                  <SelectTrigger className="h-9" data-testid="select-sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      <div className="space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-[250px]" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-[150px]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredResults.length === 0 && query && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-[15px] font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground max-w-sm">
                Try adjusting your search query or filters to find what you're looking for.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && filteredResults.map((result: SearchResult) => (
          <Card 
            key={result?.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => result?.url && navigate(result.url)}
            data-testid={`card-result-${result?.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-lg",
                  result?.type === 'project' && "bg-blue-500/10 text-blue-500",
                  result?.type === 'file' && "bg-green-500/10 text-green-500",
                  result?.type === 'code' && "bg-purple-500/10 text-purple-500",
                  result?.type === 'user' && "bg-orange-500/10 text-orange-500",
                  result?.type === 'template' && "bg-pink-500/10 text-pink-500"
                )}>
                  {getResultIcon(result)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold flex items-center gap-2">
                        {result?.title}
                        {result?.metadata?.visibility && (
                          <Badge variant="outline" className="text-[11px]">
                            {result.metadata.visibility === 'public' && <Globe className="h-3 w-3 mr-1" />}
                            {result.metadata.visibility === 'private' && <Lock className="h-3 w-3 mr-1" />}
                            {result.metadata.visibility === 'unlisted' && <Eye className="h-3 w-3 mr-1" />}
                            {result.metadata.visibility ?? ''}
                          </Badge>
                        )}
                      </h3>
                      {result?.description && (
                        <p className="text-[13px] text-muted-foreground mt-1">
                          {result.description}
                        </p>
                      )}
                      
                      {result?.type === 'code' && result?.metadata?.preview && (
                        <pre className="mt-2 p-2 bg-muted rounded text-[11px] overflow-x-auto">
                          <code>{result.metadata.preview}</code>
                        </pre>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                        {result?.metadata?.language && (
                          <span className="flex items-center gap-1">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              getLanguageColor(result.metadata.language)
                            )} />
                            {result.metadata.language}
                          </span>
                        )}
                        {result?.metadata?.owner && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {result.metadata.owner}
                          </span>
                        )}
                        {result?.metadata?.stars !== undefined && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {result.metadata.stars}
                          </span>
                        )}
                        {result?.metadata?.lastModified && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {result.metadata.lastModified}
                          </span>
                        )}
                        {result?.metadata?.matches !== undefined && (
                          <Badge variant="secondary" className="h-5">
                            {result.metadata.matches} matches
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {result?.type === 'user' && (
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>
                          {result.title?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!isLoading && !query && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-[15px] font-semibold mb-2">Start searching</h3>
              <p className="text-muted-foreground max-w-sm">
                Search for projects, files, code snippets, users, and templates across the platform.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => setQuery('typescript react')}
                >
                  typescript react
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => setQuery('python machine learning')}
                >
                  python machine learning
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => setQuery('next.js template')}
                >
                  next.js template
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}