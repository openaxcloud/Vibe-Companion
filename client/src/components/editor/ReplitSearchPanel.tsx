import { useState, useDeferredValue, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  FileText,
  Code,
  Hash,
  X,
  ChevronRight,
  FileCode
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LazyMotionDiv } from '@/lib/motion';

interface SearchResult {
  id: string;
  file: string;
  line: number;
  column: number;
  match: string;
  preview: string;
  type: 'file' | 'code' | 'symbol';
}

interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
}

function ShimmerSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <LazyMotionDiv
          key={i}
          className="flex items-start gap-2"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-[18px] h-[18px] rounded bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted/50" />
          </div>
        </LazyMotionDiv>
      ))}
    </div>
  );
}

export function ReplitSearchPanel({ projectId }: { projectId?: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'files' | 'code' | 'symbols'>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  
  const deferredQuery = useDeferredValue(searchQuery);

  const searchUrl = (() => {
    if (!projectId || !deferredQuery.trim()) return null;
    
    const params = new URLSearchParams({
      q: deferredQuery.trim(),
      caseSensitive: String(caseSensitive),
      useRegex: String(useRegex),
      type: searchType,
    });
    
    if (searchType === 'files') {
      return `/api/projects/${projectId}/files?${params.toString()}`;
    }
    return `/api/projects/${projectId}/search?${params.toString()}`;
  })();

  const { data, isLoading, isFetching } = useQuery<SearchResponse>({
    queryKey: [searchUrl],
    enabled: !!searchUrl && deferredQuery.trim().length >= 2,
  });

  const results = data?.results || [];
  const showLoading = isLoading || (isFetching && deferredQuery !== searchQuery);

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileText className="w-[18px] h-[18px] text-muted-foreground" />;
      case 'code':
        return <Code className="w-[18px] h-[18px] text-primary" />;
      case 'symbol':
        return <Hash className="w-[18px] h-[18px] text-primary" />;
      default:
        return <FileCode className="w-[18px] h-[18px] text-muted-foreground" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)]">
      <div className="h-9 px-2.5 flex items-center border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Search</span>
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] shrink-0">
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in project..."
            className="h-7 pr-7 text-xs bg-[var(--ecode-surface)] border-[var(--ecode-border)] text-[var(--ecode-text)] placeholder:text-[var(--ecode-text-muted)]"
            data-testid="input-search"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] transition-colors"
              data-testid="button-clear-search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Button
              variant={searchType === 'all' ? 'default' : 'outline'}
              onClick={() => setSearchType('all')}
              className={cn(
                "h-8 rounded-lg text-[13px]",
                searchType === 'all' 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              data-testid="button-filter-all"
            >
              All
            </Button>
            <Button
              variant={searchType === 'files' ? 'default' : 'outline'}
              onClick={() => setSearchType('files')}
              className={cn(
                "h-8 rounded-lg text-[13px]",
                searchType === 'files' 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              data-testid="button-filter-files"
            >
              <FileText className="w-[18px] h-[18px] mr-1" />
              Files
            </Button>
            <Button
              variant={searchType === 'code' ? 'default' : 'outline'}
              onClick={() => setSearchType('code')}
              className={cn(
                "h-8 rounded-lg text-[13px]",
                searchType === 'code' 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              data-testid="button-filter-code"
            >
              <Code className="w-[18px] h-[18px] mr-1" />
              Code
            </Button>
            <Button
              variant={searchType === 'symbols' ? 'default' : 'outline'}
              onClick={() => setSearchType('symbols')}
              className={cn(
                "h-8 rounded-lg text-[13px]",
                searchType === 'symbols' 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              data-testid="button-filter-symbols"
            >
              <Hash className="w-[18px] h-[18px] mr-1" />
              Symbols
            </Button>
          </div>

          <div className="flex gap-4 text-[11px] uppercase tracking-wider">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded border-border bg-card text-primary focus:ring-primary"
                data-testid="checkbox-case-sensitive"
              />
              <span className="text-muted-foreground">Case sensitive</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
                className="rounded border-border bg-card text-primary focus:ring-primary"
                data-testid="checkbox-regex"
              />
              <span className="text-muted-foreground">Regex</span>
            </label>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {showLoading ? (
          <ShimmerSkeleton />
        ) : results.length > 0 && deferredQuery ? (
          <div className="p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 py-1 mb-2">
              {results.length} results
            </div>
            {results.map((result) => (
              <button
                key={result.id}
                className="w-full text-left px-2 py-2 hover:bg-accent rounded-lg group transition-colors"
                data-testid={`result-item-${result.id}`}
              >
                <div className="flex items-start gap-2">
                  {getResultIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] leading-[20px] text-foreground font-medium truncate">
                        {result.file}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {result.line}:{result.column}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[13px] text-muted-foreground truncate">
                      <span className="text-muted-foreground">{result.line}: </span>
                      <span dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(result.preview.replace(
                          new RegExp(result.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                          `<mark class="bg-accent text-foreground rounded px-0.5">${result.match}</mark>`
                        ))
                      }} />
                    </div>
                  </div>
                  <ChevronRight className="w-[18px] h-[18px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        ) : deferredQuery && deferredQuery.trim().length >= 2 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-3">
            <Search className="w-12 h-12 text-muted-foreground opacity-40 mb-3" />
            <p className="text-[17px] font-medium leading-tight text-foreground">No results found</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Try adjusting your search terms or filters
            </p>
          </div>
        ) : deferredQuery && deferredQuery.trim().length < 2 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-3">
            <Search className="w-12 h-12 text-muted-foreground opacity-40 mb-3" />
            <p className="text-[17px] font-medium leading-tight text-foreground">Keep typing...</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Enter at least 2 characters to search
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-3">
            <Search className="w-12 h-12 text-muted-foreground opacity-40 mb-3" />
            <p className="text-[17px] font-medium leading-tight text-foreground">Search your project</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Search across files, code, and symbols
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
