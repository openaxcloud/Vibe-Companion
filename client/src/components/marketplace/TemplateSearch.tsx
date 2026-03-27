import { useState, useEffect, useRef } from 'react';
import { Search, X, Mic, Clock, TrendingUp, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDebounce } from 'use-debounce';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';

interface TemplateSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  className?: string;
}

export function TemplateSearch({ value, onChange, onSearch, className }: TemplateSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [debouncedValue] = useDebounce(value, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('template_recent_searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved).slice(0, 5));
    }
  }, []);

  // Fetch suggestions based on input
  useEffect(() => {
    if (debouncedValue && debouncedValue.length > 2) {
      fetchSuggestions(debouncedValue);
    } else {
      setSuggestions([]);
    }
  }, [debouncedValue]);

  const fetchSuggestions = async (query: string) => {
    try {
      const response = await fetch(`/api/templates/suggestions?q=${encodeURIComponent(query)}&limit=5`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    }
  };

  const handleSearch = (searchValue?: string) => {
    const finalValue = searchValue || value;
    if (finalValue && finalValue.trim()) {
      // Save to recent searches
      const updated = [finalValue, ...recentSearches.filter(s => s !== finalValue)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('template_recent_searches', JSON.stringify(updated));
      
      if (searchValue) {
        onChange(searchValue);
      }
      onSearch();
      setIsOpen(false);
    }
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice search is not supported in your browser');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onChange(transcript);
      setIsListening(false);
      handleSearch(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const clearSearch = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const popularSearches = [
    'Next.js Dashboard',
    'React SaaS Starter',
    'Node.js API',
    'Vue.js E-commerce',
    'Python FastAPI',
  ];

  return (
    <div className={cn("relative", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search templates... (e.g., 'React dashboard', 'Node.js API')"
                value={value}
                onChange={(e) => {
                  onChange(e.target.value);
                  setIsOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                onFocus={() => setIsOpen(true)}
                className="pl-10 pr-24"
                data-testid="search-input"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <LazyAnimatePresence>
                  {value && (
                    <LazyMotionDiv
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={clearSearch}
                        data-testid="clear-search-button"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </LazyMotionDiv>
                  )}
                </LazyAnimatePresence>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0",
                    isListening && "text-red-500 animate-pulse"
                  )}
                  onClick={handleVoiceSearch}
                  data-testid="voice-search-button"
                >
                  <Mic className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-orange-500 hover:bg-orange-600"
                  onClick={() => handleSearch()}
                  data-testid="search-button"
                >
                  Search
                </Button>
              </div>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[600px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              {/* Suggestions */}
              {suggestions.length > 0 && (
                <CommandGroup heading="Suggestions">
                  {suggestions.map((suggestion, i) => (
                    <CommandItem
                      key={i}
                      onSelect={() => {
                        onChange(suggestion);
                        handleSearch(suggestion);
                      }}
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-orange-500" />
                      {suggestion}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && !value && (
                <CommandGroup heading="Recent Searches">
                  {recentSearches.map((search, i) => (
                    <CommandItem
                      key={i}
                      onSelect={() => {
                        onChange(search);
                        handleSearch(search);
                      }}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {search}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Popular Searches */}
              {!value && (
                <CommandGroup heading="Popular Searches">
                  {popularSearches.map((search, i) => (
                    <CommandItem
                      key={i}
                      onSelect={() => {
                        onChange(search);
                        handleSearch(search);
                      }}
                    >
                      <TrendingUp className="mr-2 h-4 w-4 text-green-500" />
                      {search}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!suggestions.length && value && (
                <CommandEmpty>
                  No templates found for "{value}"
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}