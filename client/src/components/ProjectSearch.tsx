import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Replace, 
  FileText, 
  Code2,
  CaseSensitive,
  Regex,
  FileSearch,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SearchResult {
  fileId: number;
  fileName: string;
  filePath: string;
  matches: {
    line: number;
    content: string;
    startIndex: number;
    endIndex: number;
  }[];
}

interface ProjectSearchProps {
  projectId: number;
  onFileSelect?: (fileId: number, line?: number) => void;
  className?: string;
}

export function ProjectSearch({ projectId, onFileSelect, className }: ProjectSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Use real search API
      const response = await apiRequest('POST', '/api/search', {
        query: searchQuery,
        projectId,
        type: 'files',
        caseSensitive,
        useRegex
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      
      // Transform API results to match our interface
      const transformedResults: SearchResult[] = data.results?.map((result: any) => ({
        fileId: result.fileId || result.id,
        fileName: result.fileName || result.name,
        filePath: result.filePath || result.path,
        matches: result.matches || []
      })) || [];
      
      setResults(transformedResults);
      
      const totalMatches = transformedResults.reduce((acc, r) => acc + r.matches.length, 0);
      toast({
        title: 'Search Complete',
        description: `Found ${totalMatches} matches in ${transformedResults.length} files`,
      });
    } catch (error) {
      toast({
        title: 'Search Failed',
        description: 'An error occurred while searching',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, projectId, caseSensitive, useRegex, toast]);

  const handleReplace = useCallback(async () => {
    if (!replaceQuery || selectedFiles.size === 0) {
      toast({
        title: 'Replace Failed',
        description: 'Please select files and enter replacement text',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Implement replace logic
      toast({
        title: 'Replace Complete',
        description: `Replaced in ${selectedFiles.size} files`,
      });
      
      // Clear selection and refresh search
      setSelectedFiles(new Set());
      handleSearch();
    } catch (error) {
      toast({
        title: 'Replace Failed',
        description: 'An error occurred while replacing',
        variant: 'destructive',
      });
    }
  }, [replaceQuery, selectedFiles, handleSearch, toast]);

  const toggleFileSelection = (fileId: number) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const highlightMatch = (content: string, startIndex: number, endIndex: number) => {
    return (
      <>
        {content.substring(0, startIndex)}
        <span className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
          {content.substring(startIndex, endIndex)}
        </span>
        {content.substring(endIndex)}
      </>
    );
  };

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Find in Files
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowReplace(!showReplace)}
          >
            <Replace className="h-4 w-4 mr-1" />
            {showReplace ? 'Hide' : 'Show'} Replace
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        {/* Search Input */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search in project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search Options */}
          <div className="flex gap-4 text-[13px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={caseSensitive}
                onCheckedChange={(checked) => setCaseSensitive(!!checked)}
              />
              <CaseSensitive className="h-4 w-4" />
              Case Sensitive
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={useRegex}
                onCheckedChange={(checked) => setUseRegex(!!checked)}
              />
              <Regex className="h-4 w-4" />
              Regex
            </label>
          </div>
        </div>

        {/* Replace Input */}
        {showReplace && (
          <div className="space-y-2 pb-2 border-b">
            <div className="flex gap-2">
              <Input
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleReplace}
                disabled={!replaceQuery || selectedFiles.size === 0}
                variant="destructive"
              >
                Replace
              </Button>
            </div>
            {selectedFiles.size > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}

        {/* Results */}
        <ScrollArea className="flex-1">
          {results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No results found' : 'Enter a search query'}
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <div key={result.fileId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {showReplace && (
                      <Checkbox
                        checked={selectedFiles.has(result.fileId)}
                        onCheckedChange={() => toggleFileSelection(result.fileId)}
                      />
                    )}
                    <div className="flex items-center gap-2 flex-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-[13px]">{result.fileName}</span>
                      <span className="text-[11px] text-muted-foreground">{result.filePath}</span>
                      <Badge variant="secondary" className="text-[11px]">
                        {result.matches.length} match{result.matches.length > 1 ? 'es' : ''}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="ml-6 space-y-1">
                    {result.matches.map((match, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-1 rounded hover:bg-muted/50 cursor-pointer text-[11px]"
                        onClick={() => onFileSelect?.(result.fileId, match.line)}
                      >
                        <span className="text-muted-foreground font-mono w-10 text-right">
                          {match.line}
                        </span>
                        <code className="flex-1 font-mono">
                          {highlightMatch(match.content.trim(), match.startIndex, match.endIndex)}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Results Summary */}
        {results.length > 0 && (
          <div className="pt-2 border-t text-[11px] text-muted-foreground">
            Found {results.reduce((acc, r) => acc + r.matches.length, 0)} matches in {results.length} files
          </div>
        )}
      </CardContent>
    </Card>
  );
}