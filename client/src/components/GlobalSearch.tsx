import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, X, File, FolderOpen, Code, FileText, Image, 
  Archive, GitBranch, Clock, Filter, ChevronRight,
  SortAsc, FileCode
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { ECodeSpinner } from '@/components/ECodeLoading';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onFileSelect: (file: { id: number; name: string; content?: string | null; isFolder: boolean; parentId: number | null; projectId: number; createdAt: Date; updatedAt: Date }) => void;
}

interface SearchResult {
  id: number;
  name: string;
  path: string;
  type: 'file' | 'folder';
  matches: SearchMatch[];
  size?: number;
  lastModified?: string;
  language?: string;
}

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  context: string;
}

interface SearchFilters {
  fileTypes: string[];
  excludePaths: string[];
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  js: <FileCode className="h-4 w-4 text-yellow-500" />,
  ts: <FileCode className="h-4 w-4 text-blue-500" />,
  jsx: <FileCode className="h-4 w-4 text-yellow-500" />,
  tsx: <FileCode className="h-4 w-4 text-blue-500" />,
  py: <FileCode className="h-4 w-4 text-green-500" />,
  json: <Code className="h-4 w-4 text-gray-500" />,
  md: <FileText className="h-4 w-4 text-gray-600" />,
  css: <FileCode className="h-4 w-4 text-purple-500" />,
  html: <FileCode className="h-4 w-4 text-orange-500" />,
  default: <File className="h-4 w-4 text-gray-400" />
};

export function GlobalSearch({ isOpen, onClose, projectId, onFileSelect }: GlobalSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'files' | 'content' | 'symbols'>('content');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<number>(0);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<SearchFilters>({
    fileTypes: [],
    excludePaths: ['node_modules', '.git', 'dist', 'build'],
    caseSensitive: false,
    wholeWord: false,
    useRegex: false
  });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const debouncedQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (debouncedQuery && isOpen) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [debouncedQuery, searchType, filters]);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('replit-recent-searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: debouncedQuery,
          type: searchType,
          filters
        })
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data.results || []);
      
      // Add to recent searches
      if (!recentSearches.includes(debouncedQuery)) {
        const updated = [debouncedQuery, ...recentSearches.slice(0, 9)];
        setRecentSearches(updated);
        localStorage.setItem('replit-recent-searches', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Search error:', error);
      // For now, show mock results
      setResults(getMockResults(debouncedQuery, searchType));
    } finally {
      setIsSearching(false);
    }
  };

  const getMockResults = (query: string, type: string): SearchResult[] => {
    if (!query) return [];
    
    // Mock results for demonstration
    if (type === 'files') {
      return [
        {
          id: 1,
          name: 'App.tsx',
          path: '/src/App.tsx',
          type: 'file',
          matches: [],
          size: 2048,
          lastModified: '2 hours ago',
          language: 'typescript'
        },
        {
          id: 2,
          name: 'index.ts',
          path: '/src/index.ts',
          type: 'file',
          matches: [],
          size: 512,
          lastModified: '1 day ago',
          language: 'typescript'
        }
      ];
    } else if (type === 'content') {
      return [
        {
          id: 1,
          name: 'App.tsx',
          path: '/src/App.tsx',
          type: 'file',
          language: 'typescript',
          matches: [
            {
              line: 42,
              column: 15,
              text: query,
              context: `function ${query}Component() { return <div>${query}</div>; }`
            },
            {
              line: 78,
              column: 8,
              text: query,
              context: `const ${query} = useState('');`
            }
          ]
        },
        {
          id: 2,
          name: 'utils.ts',
          path: '/src/utils.ts',
          type: 'file',
          language: 'typescript',
          matches: [
            {
              line: 15,
              column: 0,
              text: query,
              context: `export function ${query}Helper(data: any) {`
            }
          ]
        }
      ];
    } else {
      return [
        {
          id: 1,
          name: `${query}Component`,
          path: '/src/components/App.tsx',
          type: 'file',
          matches: [{
            line: 10,
            column: 0,
            text: 'function',
            context: `export function ${query}Component() {`
          }]
        },
        {
          id: 2,
          name: `use${query}`,
          path: '/src/hooks/useQuery.ts',
          type: 'file',
          matches: [{
            line: 5,
            column: 0,
            text: 'hook',
            context: `export const use${query} = () => {`
          }]
        }
      ];
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResult(Math.min(selectedResult + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResult(Math.max(selectedResult - 1, 0));
    } else if (e.key === 'Enter' && results[selectedResult]) {
      e.preventDefault();
      handleResultClick(results[selectedResult]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleResultClick = async (result: SearchResult) => {
    try {
      // Fetch full file details
      const response = await fetch(`/api/files/${result.id}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const file = await response.json();
        onFileSelect(file);
        onClose();
      }
    } catch (error) {
      toast({
        title: 'Failed to open file',
        description: 'Could not load file details',
        variant: 'destructive'
      });
    }
  };

  const toggleResultExpanded = (resultId: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedResults(newExpanded);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return FILE_TYPE_ICONS[ext] || FILE_TYPE_ICONS.default;
  };

  const renderSearchResult = (result: SearchResult, index: number) => {
    const isExpanded = expandedResults.has(result.id);
    const isSelected = index === selectedResult;

    return (
      <div
        key={result.id}
        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-accent border-accent' : 'hover:bg-accent/50'
        }`}
        onClick={() => handleResultClick(result)}
        onMouseEnter={() => setSelectedResult(index)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2 flex-1">
            {getFileIcon(result.name)}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm">{result.name}</span>
                <span className="text-xs text-muted-foreground">{result.path}</span>
              </div>
              
              {result.matches.length > 0 && (
                <div className="mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleResultExpanded(result.id);
                    }}
                  >
                    <ChevronRight className={`h-3 w-3 mr-1 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`} />
                    {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
                  </Button>
                </div>
              )}

              {isExpanded && result.matches.length > 0 && (
                <div className="mt-2 space-y-2">
                  {result.matches.map((match, matchIndex) => (
                    <div key={matchIndex} className="pl-4 border-l-2 border-muted">
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>Line {match.line}</span>
                        <span>•</span>
                        <span>Column {match.column}</span>
                      </div>
                      <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                        <code>{match.context}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {result.language && (
            <Badge variant="secondary" className="text-xs">
              {result.language}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0">
        <div className="flex flex-col h-full">
          {/* Search Header */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search files, content, or symbols..."
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Search Type Tabs */}
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as any)} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="symbols">Symbols</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search Filters */}
          <div className="px-4 py-2 border-b bg-muted/20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="case-sensitive"
                  checked={filters.caseSensitive}
                  onCheckedChange={(checked) => 
                    setFilters({ ...filters, caseSensitive: !!checked })
                  }
                />
                <Label htmlFor="case-sensitive" className="text-xs">
                  Case sensitive
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whole-word"
                  checked={filters.wholeWord}
                  onCheckedChange={(checked) => 
                    setFilters({ ...filters, wholeWord: !!checked })
                  }
                />
                <Label htmlFor="whole-word" className="text-xs">
                  Whole word
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-regex"
                  checked={filters.useRegex}
                  onCheckedChange={(checked) => 
                    setFilters({ ...filters, useRegex: !!checked })
                  }
                />
                <Label htmlFor="use-regex" className="text-xs">
                  Regex
                </Label>
              </div>

              <Button variant="ghost" size="sm" className="ml-auto">
                <Filter className="h-3 w-3 mr-1" />
                More filters
              </Button>
            </div>
          </div>

          {/* Search Results */}
          <ScrollArea className="flex-1 p-4">
            {!searchQuery && recentSearches.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Recent Searches
                </h3>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="justify-start w-full"
                      onClick={() => setSearchQuery(search)}
                    >
                      <Search className="h-3 w-3 mr-2" />
                      {search}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <ECodeSpinner size={32} className="mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Searching...</p>
                </div>
              </div>
            )}

            {!isSearching && searchQuery && results.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">No results found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your search query or filters
                  </p>
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2" ref={resultsRef}>
                {results.map((result, index) => renderSearchResult(result, index))}
              </div>
            )}
          </ScrollArea>

          {/* Search Footer */}
          {results.length > 0 && (
            <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{results.length} results found</span>
                <div className="flex items-center space-x-4">
                  <span>↑↓ Navigate</span>
                  <span>Enter Open</span>
                  <span>Esc Close</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}