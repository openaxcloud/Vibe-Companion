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
import { apiRequest } from '@/lib/queryClient';
import { ECodeSpinner } from '@/components/ECodeLoading';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | number; // Support both UUID strings and numeric IDs
  onFileSelect: (file: { id: number; name: string; content?: string | null; isFolder: boolean; parentId: number | null; projectId: number; createdAt: Date; updatedAt: Date }) => void;
  inline?: boolean; // When true, render as panel content (no Dialog modal overlay)
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

export function GlobalSearch({ isOpen, onClose, projectId, onFileSelect, inline = false }: GlobalSearchProps) {
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
      const response = await apiRequest('POST', `/api/search/global`, {
        query: debouncedQuery,
        projectId: String(projectId),
        type: searchType,
        caseSensitive: filters.caseSensitive,
        wholeWord: filters.wholeWord,
        useRegex: filters.useRegex,
        excludePattern: filters.excludePaths?.join(','),
        filePattern: filters.fileTypes?.join(',')
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
      setResults([]);
      toast({
        title: "Search failed",
        description: "Unable to search files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
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
        className={`px-2 py-1.5 rounded cursor-pointer transition-colors ${
          isSelected ? 'bg-accent' : 'hover:bg-muted/50'
        }`}
        onClick={() => handleResultClick(result)}
        onMouseEnter={() => setSelectedResult(index)}
      >
        <div className="flex items-center gap-2">
          <span className="shrink-0">{getFileIcon(result.name)}</span>
          <span className="font-medium text-xs truncate">{result.name}</span>
          <span className="text-[10px] text-muted-foreground truncate flex-1">{result.path}</span>
          {result.language && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">
              {result.language}
            </Badge>
          )}
        </div>
        
        {result.matches.length > 0 && (
          <div className="ml-6 mt-1">
            <button
              className="flex items-center text-[10px] text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleResultExpanded(result.id);
              }}
            >
              <ChevronRight className={`h-3 w-3 mr-0.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
            </button>
            
            {isExpanded && (
              <div className="mt-1 space-y-1">
                {result.matches.slice(0, 3).map((match, matchIndex) => (
                  <div key={matchIndex} className="pl-3 border-l border-muted">
                    <span className="text-[10px] text-muted-foreground">L{match.line}:{match.column}</span>
                    <pre className="text-[10px] mt-0.5 p-1 bg-muted/50 rounded text-xs overflow-x-auto">
                      <code>{match.context}</code>
                    </pre>
                  </div>
                ))}
                {result.matches.length > 3 && (
                  <span className="text-[10px] text-muted-foreground pl-3">
                    +{result.matches.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const searchContent = (
        <div className="flex flex-col h-full min-h-0">
          {/* Search Header */}
          <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
            <div className="relative pr-8">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search files, content, or symbols..."
                className="pl-8 pr-8 h-8 text-sm"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Search Type Tabs */}
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as any)} className="mt-2">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="files" className="text-xs">Files</TabsTrigger>
                <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
                <TabsTrigger value="symbols" className="text-xs">Symbols</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search Filters */}
          <div className="px-3 py-1.5 border-b bg-muted/50 shrink-0">
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  id="case-sensitive"
                  checked={filters.caseSensitive}
                  onCheckedChange={(checked) => setFilters({ ...filters, caseSensitive: !!checked })}
                  className="h-3.5 w-3.5"
                />
                <span className="text-[11px]">Case sensitive</span>
              </label>
              
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  id="whole-word"
                  checked={filters.wholeWord}
                  onCheckedChange={(checked) => setFilters({ ...filters, wholeWord: !!checked })}
                  className="h-3.5 w-3.5"
                />
                <span className="text-[11px]">Whole word</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  id="use-regex"
                  checked={filters.useRegex}
                  onCheckedChange={(checked) => setFilters({ ...filters, useRegex: !!checked })}
                  className="h-3.5 w-3.5"
                />
                <span className="text-[11px]">Regex</span>
              </label>

              <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[11px]">
                <Filter className="h-3 w-3 mr-1" />
                More filters
              </Button>
            </div>
          </div>

          {/* Search Results */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3">
              {!searchQuery && recentSearches.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-medium mb-2 flex items-center text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1.5" />
                    Recent Searches
                  </h3>
                  <div className="space-y-0.5">
                    {recentSearches.slice(0, 5).map((search, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        className="justify-start w-full h-7 text-xs"
                        onClick={() => setSearchQuery(search)}
                      >
                        <Search className="h-3 w-3 mr-2 opacity-50" />
                        {search}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {isSearching && (
                <div className="flex items-center justify-center py-6">
                  <div className="text-center">
                    <ECodeSpinner size={24} className="mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Searching...</p>
                  </div>
                </div>
              )}

              {!isSearching && searchQuery && results.length === 0 && (
                <div className="flex items-center justify-center py-6">
                  <div className="text-center">
                    <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs text-muted-foreground">No results found</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Try different keywords or filters
                    </p>
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-1.5" ref={resultsRef}>
                  {results.map((result, index) => renderSearchResult(result, index))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Search Footer */}
          {results.length > 0 && (
            <div className="px-3 py-1.5 border-t bg-muted/50 text-[10px] text-muted-foreground shrink-0">
              <div className="flex items-center justify-between">
                <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-3">
                  <span>↑↓ Navigate</span>
                  <span>↵ Open</span>
                  <span>Esc Close</span>
                </div>
              </div>
            </div>
          )}
        </div>
  );

  if (inline) {
    return <div className="flex flex-col h-full overflow-hidden">{searchContent}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[70vh] p-0 flex flex-col overflow-hidden gap-0">
        <div className="absolute right-2 top-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        {searchContent}
      </DialogContent>
    </Dialog>
  );
}