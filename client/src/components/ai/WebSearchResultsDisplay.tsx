import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Globe, Search, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';

export interface WebSearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source?: string;
  favicon?: string;
  timestamp?: Date;
}

interface WebSearchResultsDisplayProps {
  results: WebSearchResult[];
  query?: string;
  isSearching?: boolean;
  className?: string;
  variant?: 'inline' | 'card' | 'compact';
  maxResults?: number;
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

function getSourceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return 'Unknown source';
  }
}

export function WebSearchResultItem({ 
  result, 
  variant = 'inline' 
}: { 
  result: WebSearchResult; 
  variant?: 'inline' | 'card' | 'compact';
}) {
  const faviconUrl = result.favicon || getFaviconUrl(result.url);
  const source = result.source || getSourceFromUrl(result.url);

  if (variant === 'compact') {
    return (
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
        data-testid={`web-result-compact-${result.id}`}
      >
        {faviconUrl && (
          <img 
            src={faviconUrl} 
            alt="" 
            className="w-4 h-4 rounded-sm shrink-0" 
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <span className="text-[13px] text-blue-600 dark:text-blue-400 group-hover:underline truncate flex-1">
          {result.title}
        </span>
        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <Card className="overflow-hidden" data-testid={`web-result-card-${result.id}`}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            {faviconUrl && (
              <img 
                src={faviconUrl} 
                alt="" 
                className="w-5 h-5 rounded-sm shrink-0 mt-0.5" 
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline line-clamp-1"
              >
                {result.title}
              </a>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {result.snippet}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {source}
                </Badge>
                {result.timestamp && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(result.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-muted rounded transition-colors shrink-0"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div 
      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors" 
      data-testid={`web-result-inline-${result.id}`}
    >
      {faviconUrl && (
        <img 
          src={faviconUrl} 
          alt="" 
          className="w-4 h-4 rounded-sm shrink-0 mt-1" 
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div className="flex-1 min-w-0">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:underline line-clamp-1 inline-flex items-center gap-1"
        >
          {result.title}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
          {result.snippet}
        </p>
        <span className="text-[10px] text-muted-foreground/70 mt-1 inline-block">
          {source}
        </span>
      </div>
    </div>
  );
}

export function WebSearchResultsDisplay({
  results,
  query,
  isSearching = false,
  className,
  variant = 'inline',
  maxResults = 3,
}: WebSearchResultsDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const displayResults = expanded ? results : results.slice(0, maxResults);
  const hasMore = results.length > maxResults;

  if (isSearching) {
    return (
      <div 
        className={cn("flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900", className)}
        data-testid="web-search-loading"
      >
        <div className="relative">
          <Globe className="h-4 w-4 text-blue-500" />
          <LazyMotionDiv
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Search className="h-4 w-4 text-blue-400 opacity-50" />
          </LazyMotionDiv>
        </div>
        <span className="text-[13px] text-blue-700 dark:text-blue-300">
          Searching the web{query ? ` for "${query}"` : ''}...
        </span>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className={cn("space-y-1", className)} data-testid="web-search-results-compact">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
          <Globe className="h-3 w-3" />
          <span>Web sources</span>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {results.length}
          </Badge>
        </div>
        {displayResults.map((result) => (
          <WebSearchResultItem key={result.id} result={result} variant="compact" />
        ))}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[11px]"
            onClick={() => setExpanded(!expanded)}
            data-testid="web-search-expand"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {results.length - maxResults} more
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={cn("overflow-hidden", className)} data-testid="web-search-results-card">
        <CardHeader className="py-2 px-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900">
          <CardTitle className="text-[11px] font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Globe className="h-3.5 w-3.5" />
            Web Search Results
            {query && <span className="text-muted-foreground">for "{query}"</span>}
            <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0">
              {results.length} sources
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 space-y-2">
          {displayResults.map((result) => (
            <WebSearchResultItem key={result.id} result={result} variant="card" />
          ))}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-[11px]"
              onClick={() => setExpanded(!expanded)}
              data-testid="web-search-expand-card"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  View {results.length - maxResults} more sources
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div 
      className={cn("rounded-lg border bg-muted/20 overflow-hidden", className)} 
      data-testid="web-search-results-inline"
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 dark:bg-blue-950/20 border-b">
        <Globe className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-[11px] font-medium text-foreground">
          Web Sources
        </span>
        {query && (
          <span className="text-[11px] text-muted-foreground">
            for "{query}"
          </span>
        )}
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
          {results.length}
        </Badge>
      </div>
      <div className="divide-y divide-border/50">
        <LazyAnimatePresence>
          {displayResults.map((result, index) => (
            <LazyMotionDiv
              key={result.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.05 }}
            >
              <WebSearchResultItem result={result} variant="inline" />
            </LazyMotionDiv>
          ))}
        </LazyAnimatePresence>
      </div>
      {hasMore && (
        <div className="px-2 py-1.5 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
            data-testid="web-search-expand-inline"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {results.length - maxResults} more sources
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export function WebSearchAttribution({ 
  resultCount, 
  query 
}: { 
  resultCount: number; 
  query?: string;
}) {
  return (
    <div 
      className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-1 bg-blue-50/50 dark:bg-blue-950/20 rounded"
      data-testid="web-search-attribution"
    >
      <Globe className="h-3 w-3 text-blue-400" />
      <span>
        Sourced from {resultCount} web {resultCount === 1 ? 'result' : 'results'}
        {query && ` for "${query}"`}
      </span>
    </div>
  );
}

export default WebSearchResultsDisplay;
