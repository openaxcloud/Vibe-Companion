import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Search, Replace, X, FileText, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface SearchResult {
  filePath: string;
  matches: {
    line: number;
    column: number;
    text: string;
    matchText: string;
  }[];
  totalMatches: number;
}

interface GlobalSearchPanelProps {
  projectId: string;
  onFileSelect?: (filePath: string, line?: number) => void;
}

export function GlobalSearchPanel({ projectId, onFileSelect }: GlobalSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [filePattern, setFilePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('node_modules,dist,.git');
  const [showReplace, setShowReplace] = useState(false);
  const [searching, setSearching] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Empty search",
        description: "Please enter a search query",
        variant: "destructive"
      });
      return;
    }

    setSearching(true);
    try {
      const response = await apiRequest<{
        results: SearchResult[];
        totalFiles: number;
        totalMatches: number;
      }>('POST', '/api/search/global', {
        query,
        projectId,
        caseSensitive,
        wholeWord,
        useRegex,
        filePattern: filePattern || undefined,
        excludePattern: excludePattern || undefined
      });

      setResults(response.results);
      toast({
        title: "Search complete",
        description: `Found ${response.totalMatches} matches in ${response.totalFiles} files`
      });
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const handleReplace = async () => {
    if (!query.trim() || !replacement) {
      toast({
        title: "Invalid input",
        description: "Please enter both search and replacement text",
        variant: "destructive"
      });
      return;
    }

    setReplacing(true);
    try {
      const response = await apiRequest<{
        results: Array<{ filePath: string; replacements: number; success: boolean }>;
        totalFiles: number;
        totalReplacements: number;
      }>('POST', '/api/search/replace', {
        query,
        replacement,
        projectId,
        caseSensitive,
        wholeWord,
        useRegex,
        filePattern: filePattern || undefined,
        excludePattern: excludePattern || undefined
      });

      toast({
        title: "Replace complete",
        description: `Replaced ${response.totalReplacements} instances in ${response.totalFiles} files`
      });

      // Refresh search results
      handleSearch();
    } catch (error: any) {
      toast({
        title: "Replace failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setReplacing(false);
    }
  };

  const toggleFileExpanded = (filePath: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedFiles(newExpanded);
  };

  const highlightMatch = (text: string, matchText: string) => {
    const parts = text.split(new RegExp(`(${matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === matchText.toLowerCase() ? (
            <mark key={i} className="bg-yellow-300 dark:bg-yellow-700">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--ecode-surface)]" data-testid="global-search-panel">
      {/* Search Header */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <h3 className="text-xs font-medium text-[var(--ecode-text-muted)] flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Search
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowReplace(!showReplace)}
          className="h-6 px-2 text-[10px] text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
          data-testid="toggle-replace-button"
        >
          {showReplace ? 'Hide' : 'Show'} Replace
        </Button>
      </div>
      
      {/* Search Controls */}
      <div className="p-2.5 border-b border-[var(--ecode-border)] space-y-2">
        {/* Search Input */}
        <div className="space-y-2">
          <Input
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="font-mono text-[13px]"
            data-testid="input-search-query"
          />

          <div className={cn("collapsible-content", showReplace && "expanded")}>
            <div>
              <Input
                placeholder="Replace with..."
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                className="font-mono text-[13px]"
                data-testid="input-replacement"
              />
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-3 text-[13px]">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={caseSensitive}
              onCheckedChange={(checked) => setCaseSensitive(!!checked)}
              data-testid="checkbox-case-sensitive"
            />
            <span>Case sensitive</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={wholeWord}
              onCheckedChange={(checked) => setWholeWord(!!checked)}
              data-testid="checkbox-whole-word"
            />
            <span>Whole word</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={useRegex}
              onCheckedChange={(checked) => setUseRegex(!!checked)}
              data-testid="checkbox-use-regex"
            />
            <span>Regex</span>
          </label>
        </div>

        {/* File Filters */}
        <div className="space-y-2">
          <Input
            placeholder="Files to include (e.g., *.ts,*.tsx)"
            value={filePattern}
            onChange={(e) => setFilePattern(e.target.value)}
            className="text-[11px]"
            data-testid="input-file-pattern"
          />
          <Input
            placeholder="Files to exclude"
            value={excludePattern}
            onChange={(e) => setExcludePattern(e.target.value)}
            className="text-[11px]"
            data-testid="input-exclude-pattern"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="flex-1"
            data-testid="button-search"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
          {showReplace && (
            <Button
              onClick={handleReplace}
              disabled={replacing || !query.trim() || !replacement}
              variant="destructive"
              className="flex-1"
              data-testid="button-replace-all"
            >
              {replacing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Replacing...
                </>
              ) : (
                <>
                  <Replace className="h-4 w-4 mr-2" />
                  Replace All
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-[13px]">No results</p>
          </div>
        ) : (
          <div className="space-y-1" data-testid="search-results">
            {results.map((result) => (
              <Card key={result.filePath} className="p-2">
                <button
                  onClick={() => toggleFileExpanded(result.filePath)}
                  className="flex items-center gap-2 w-full text-left hover:bg-accent p-1 rounded"
                  data-testid={`file-result-${result.filePath}`}
                >
                  {expandedFiles.has(result.filePath) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4" />
                  <span className="text-[13px] font-medium flex-1">{result.filePath}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {result.totalMatches} matches
                  </span>
                </button>

                <div className={cn("collapsible-content", expandedFiles.has(result.filePath) && "expanded")}>
                  <div className="ml-6 mt-2 space-y-1">
                    {result.matches.map((match, idx) => (
                      <button
                        key={idx}
                        onClick={() => onFileSelect?.(result.filePath, match.line)}
                        className="block w-full text-left hover:bg-accent p-2 rounded text-[11px] font-mono"
                        data-testid={`match-line-${match.line}`}
                      >
                        <div className="flex gap-2">
                          <span className="text-muted-foreground min-w-[3rem]">
                            {match.line}:{match.column}
                          </span>
                          <span className="flex-1 truncate">
                            {highlightMatch(match.text.trim(), match.matchText)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
