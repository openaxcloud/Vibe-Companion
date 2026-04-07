import { useState, useMemo, useCallback, useEffect } from 'react';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Code,
  FileText,
  Filter,
  Star,
  StarOff,
  Clock,
  Trash2,
  Copy,
  ChevronRight,
  File,
  Folder,
  Hash,
  Regex,
  MessageSquare,
  X,
  History,
  Bookmark,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TABLET_GRID_CLASSES } from '@shared/responsive-config';
import Fuse from 'fuse.js';

interface SearchResult {
  id: string;
  file: string;
  path: string;
  line: number;
  column: number;
  content: string;
  context: string[];
  language: string;
  matchType: 'exact' | 'fuzzy' | 'regex';
}

interface SavedSearch {
  id: string;
  query: string;
  isRegex: boolean;
  filters: string[];
  timestamp: Date;
}

interface RecentSearch {
  id: string;
  query: string;
  resultCount: number;
  timestamp: Date;
}

const LANGUAGE_FILTERS = [
  { id: 'typescript', label: 'TypeScript', ext: '.ts,.tsx' },
  { id: 'javascript', label: 'JavaScript', ext: '.js,.jsx' },
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'css', label: 'CSS', ext: '.css,.scss,.less' },
  { id: 'html', label: 'HTML', ext: '.html,.htm' },
  { id: 'json', label: 'JSON', ext: '.json' },
  { id: 'markdown', label: 'Markdown', ext: '.md' },
  { id: 'yaml', label: 'YAML', ext: '.yaml,.yml' },
];

const FILE_TYPE_FILTERS = [
  { id: 'components', label: 'Components', pattern: '**/components/**' },
  { id: 'pages', label: 'Pages', pattern: '**/pages/**' },
  { id: 'hooks', label: 'Hooks', pattern: '**/hooks/**' },
  { id: 'utils', label: 'Utilities', pattern: '**/utils/**,**/lib/**' },
  { id: 'tests', label: 'Tests', pattern: '**/*.test.*,**/*.spec.*' },
  { id: 'config', label: 'Config', pattern: '*.config.*,.*rc*' },
];

type CodeIndexItem = {
  id: string;
  file: string;
  path: string;
  content: string;
  language: string;
  line: number;
};

const CODE_INDEX: CodeIndexItem[] = [];

export default function CodeSearchPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegexMode, setIsRegexMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [activeTab, setActiveTab] = useState('results');

  const fuse = useMemo(() => new Fuse(CODE_INDEX, {
    keys: ['content', 'file', 'path'],
    threshold: 0.3,
    includeScore: true,
    includeMatches: true,
  }), []);

  const performSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    setTimeout(() => {
      let searchResults: SearchResult[] = [];

      if (isRegexMode) {
        try {
          const regex = new RegExp(searchQuery, 'gi');
          searchResults = CODE_INDEX
            .filter(item => {
              const matchesLanguage = selectedLanguages.length === 0 || selectedLanguages.includes(item.language);
              return matchesLanguage && regex.test(item.content);
            })
            .map(item => ({
              id: item.id,
              file: item.file,
              path: item.path,
              line: item.line,
              column: 0,
              content: item.content,
              context: ['// Previous line...', item.content, '// Next line...'],
              language: item.language,
              matchType: 'regex' as const,
            }));
        } catch {
          toast({ title: 'Invalid regex', description: 'Please check your regex pattern.', variant: 'destructive' });
          setIsSearching(false);
          return;
        }
      } else {
        const fuseResults = fuse.search(searchQuery);
        searchResults = fuseResults
          .filter(result => {
            const item = result.item;
            const matchesLanguage = selectedLanguages.length === 0 || selectedLanguages.includes(item.language);
            return matchesLanguage;
          })
          .slice(0, 50)
          .map(result => ({
            id: result.item.id,
            file: result.item.file,
            path: result.item.path,
            line: result.item.line,
            column: 0,
            content: result.item.content,
            context: ['// Previous line...', result.item.content, '// Next line...'],
            language: result.item.language,
            matchType: (result.score && result.score < 0.1 ? 'exact' : 'fuzzy') as 'exact' | 'fuzzy',
          }));
      }

      setResults(searchResults);

      const newRecent: RecentSearch = {
        id: Date.now().toString(),
        query: searchQuery,
        resultCount: searchResults.length,
        timestamp: new Date(),
      };
      setRecentSearches(prev => [newRecent, ...prev.slice(0, 9)]);

      setIsSearching(false);
    }, 300);
  }, [searchQuery, isRegexMode, selectedLanguages, fuse, toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, performSearch]);

  const saveSearch = () => {
    if (!searchQuery.trim()) return;
    const newSaved: SavedSearch = {
      id: Date.now().toString(),
      query: searchQuery,
      isRegex: isRegexMode,
      filters: selectedLanguages,
      timestamp: new Date(),
    };
    setSavedSearches(prev => [newSaved, ...prev]);
    toast({ title: 'Search saved', description: 'Your search has been saved for quick access.' });
  };

  const loadSavedSearch = (saved: SavedSearch) => {
    setSearchQuery(saved.query);
    setIsRegexMode(saved.isRegex);
    setSelectedLanguages(saved.filters);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Path copied to clipboard.' });
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      typescript: 'bg-blue-500',
      javascript: 'bg-yellow-500',
      python: 'bg-green-500',
      css: 'bg-purple-500',
      html: 'bg-orange-500',
      json: 'bg-gray-500',
    };
    return colors[lang] || 'bg-gray-400';
  };

  const cardClassName = "border border-border bg-card shadow-sm";
  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";

  return (
    <PageShell>
      <div
        className="min-h-screen bg-background -mx-4 -mt-4 md:-mx-6 md:-mt-6 lg:-mx-8 lg:-mt-8 px-4 pt-4 pb-8 md:px-6 md:pt-6 lg:px-8 lg:pt-8"
        style={{ fontFamily: 'var(--ecode-font-sans)' }}
        data-testid="page-code-search"
      >
        <PageHeader
          title="Code Search"
          description="Search across your entire codebase with powerful regex and natural language support."
          icon={Search}
          actions={(
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2 border-border bg-card"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={saveSearch}
                disabled={!searchQuery.trim()}
                data-testid="button-save-search"
              >
                <Bookmark className="h-4 w-4" />
                Save Search
              </Button>
            </div>
          )}
        />

        <div className="mt-6 space-y-4">
          <Card className={cardClassName} data-testid="card-search-bar">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isRegexMode ? (
                      <Regex className="h-4 w-4 text-primary" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <Input
                    placeholder={isRegexMode ? 'Enter regex pattern...' : 'Search code naturally...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${inputClassName} pl-10 pr-10 font-mono`}
                    data-testid="input-search-query"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                      onClick={() => setSearchQuery('')}
                      data-testid="button-clear-search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isRegexMode}
                      onCheckedChange={setIsRegexMode}
                      data-testid="switch-regex-mode"
                    />
                    <Label className="text-[13px] whitespace-nowrap">Regex</Label>
                  </div>
                  <Button
                    onClick={performSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]"
                    data-testid="button-search"
                  >
                    {isSearching ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className={`grid gap-6 ${showFilters ? 'grid-cols-1 lg:grid-cols-4' : 'grid-cols-1'}`}>
            {showFilters && (
              <div className="lg:col-span-1 space-y-4">
                <Card className={cardClassName} data-testid="card-language-filters">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[13px] flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Languages
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {LANGUAGE_FILTERS.map((lang) => (
                      <div key={lang.id} className="flex items-center gap-2">
                        <Checkbox
                          id={lang.id}
                          checked={selectedLanguages.includes(lang.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedLanguages([...selectedLanguages, lang.id]);
                            } else {
                              setSelectedLanguages(selectedLanguages.filter(l => l !== lang.id));
                            }
                          }}
                          data-testid={`checkbox-lang-${lang.id}`}
                        />
                        <Label htmlFor={lang.id} className="text-[13px] cursor-pointer flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getLanguageColor(lang.id)}`} />
                          {lang.label}
                        </Label>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className={cardClassName} data-testid="card-file-type-filters">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[13px] flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      File Types
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {FILE_TYPE_FILTERS.map((type) => (
                      <div key={type.id} className="flex items-center gap-2">
                        <Checkbox
                          id={type.id}
                          checked={selectedFileTypes.includes(type.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFileTypes([...selectedFileTypes, type.id]);
                            } else {
                              setSelectedFileTypes(selectedFileTypes.filter(t => t !== type.id));
                            }
                          }}
                          data-testid={`checkbox-type-${type.id}`}
                        />
                        <Label htmlFor={type.id} className="text-[13px] cursor-pointer">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className={cardClassName} data-testid="card-saved-searches">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[13px] flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Saved Searches
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {savedSearches.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No saved searches</p>
                    ) : (
                      savedSearches.map((saved) => (
                        <button
                          key={saved.id}
                          onClick={() => loadSavedSearch(saved)}
                          className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
                          data-testid={`button-saved-${saved.id}`}
                        >
                          <div className="flex items-center gap-2">
                            {saved.isRegex ? <Regex className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                            <span className="text-[13px] font-mono truncate">{saved.query}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className={cardClassName} data-testid="card-recent-searches">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[13px] flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Recent Searches
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recentSearches.map((recent) => (
                      <button
                        key={recent.id}
                        onClick={() => setSearchQuery(recent.query)}
                        className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
                        data-testid={`button-recent-${recent.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-mono truncate">{recent.query}</span>
                          <Badge variant="secondary" className="text-[11px]">
                            {recent.resultCount}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {formatTimestamp(recent.timestamp)}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            <div className={showFilters ? 'lg:col-span-3' : 'col-span-1'}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className={cardClassName} data-testid="card-search-results">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[13px]">
                        Results {results.length > 0 && `(${results.length})`}
                      </CardTitle>
                      {results.length > 0 && (
                        <Badge variant="outline" className="text-[11px]">
                          {isRegexMode ? 'Regex' : 'Fuzzy'} Match
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      {results.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No results found</p>
                          <p className="text-[11px] mt-1">Try a different search query</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {results.map((result) => (
                            <div
                              key={result.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                selectedResult?.id === result.id
                                  ? 'bg-primary/5 border-primary/50'
                                  : 'border-border hover:border-primary/30 hover:bg-muted/50'
                              }`}
                              onClick={() => setSelectedResult(result)}
                              data-testid={`result-${result.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="font-medium text-[13px] truncate">{result.file}</span>
                                  <Badge variant="secondary" className="text-[11px]">
                                    L{result.line}
                                  </Badge>
                                </div>
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getLanguageColor(result.language)}`} />
                              </div>
                              <div className="mt-2 text-[11px] text-muted-foreground truncate">
                                {result.path}
                              </div>
                              <pre className="mt-2 text-[11px] font-mono bg-muted p-2 rounded overflow-x-auto">
                                <code>{result.content}</code>
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className={cardClassName} data-testid="card-preview-pane">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[13px]">Preview</CardTitle>
                      {selectedResult && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedResult.path)}
                          data-testid="button-copy-path"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Path
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      {selectedResult ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                            <File className="h-4 w-4" />
                            <div>
                              <div className="font-medium text-[13px]">{selectedResult.file}</div>
                              <div className="text-[11px] text-muted-foreground">{selectedResult.path}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className={getLanguageColor(selectedResult.language)}>
                              {selectedResult.language}
                            </Badge>
                            <Badge variant="outline">Line {selectedResult.line}</Badge>
                            <Badge variant={selectedResult.matchType === 'exact' ? 'default' : 'secondary'}>
                              {selectedResult.matchType}
                            </Badge>
                          </div>

                          <Separator />

                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground mb-2">Code Context:</div>
                            <div className="font-mono text-[13px] bg-muted rounded-lg overflow-hidden">
                              {selectedResult.context.map((line, index) => (
                                <div
                                  key={index}
                                  className={`px-3 py-1 ${
                                    index === 1 ? 'bg-primary/10 border-l-2 border-primary' : ''
                                  }`}
                                >
                                  <span className="text-muted-foreground mr-3 select-none">
                                    {selectedResult.line - 1 + index}
                                  </span>
                                  {line}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              data-testid="button-open-in-editor"
                            >
                              <Code className="h-4 w-4 mr-2" />
                              Open in Editor
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              data-testid="button-view-file"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              View File
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Select a result to preview</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
