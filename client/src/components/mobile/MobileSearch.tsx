import { useState, useEffect, useRef } from "react";
import { Search, X, Mic, Clock, TrendingUp, Filter, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchCategory {
  name: string;
  icon: React.ElementType;
  value: string;
}

const categories: SearchCategory[] = [
  { name: "All", icon: Search, value: "all" },
  { name: "Projects", icon: Command, value: "projects" },
  { name: "Templates", icon: TrendingUp, value: "templates" },
  { name: "Users", icon: Filter, value: "users" },
];

interface RecentSearch {
  query: string;
  category: string;
  timestamp: number;
}

interface SearchSuggestion {
  text: string;
  category: string;
  trending?: boolean;
}

interface MobileSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch?: (query: string, category: string) => void;
}

export function MobileSearch({ isOpen, onClose, onSearch }: MobileSearchProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isListening, setIsListening] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('recentSearches');
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch {
        // localStorage may be unavailable in some environments (Replit sandbox)
      }
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);

      setSuggestions([
        { text: "React hooks tutorial", category: "templates", trending: true },
        { text: "Python web scraper", category: "projects", trending: true },
        { text: "Node.js REST API", category: "templates" },
        { text: "Machine learning model", category: "projects" },
        { text: "TypeScript starter", category: "templates", trending: true },
      ]);
    }
  }, [isOpen]);

  const handleSearch = (searchQuery: string = query, category: string = activeCategory) => {
    if (!searchQuery.trim()) return;

    const newSearch: RecentSearch = {
      query: searchQuery,
      category,
      timestamp: Date.now(),
    };

    const updatedSearches = [
      newSearch,
      ...recentSearches.filter(s => s.query !== searchQuery).slice(0, 9),
    ];

    setRecentSearches(updatedSearches);
    try { localStorage.setItem('recentSearches', JSON.stringify(updatedSearches)); } catch {}

    onSearch?.(searchQuery, category);
    setShowResults(true);

    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleVoiceSearch = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice search is not supported in your browser');
      return;
    }

    setIsListening(true);
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: Event) => {
      const speechEvent = event as unknown as { results: { 0: { 0: { transcript: string } } } };
      const transcript = speechEvent.results[0][0].transcript;
      setQuery(transcript);
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

    if ('vibrate' in navigator) {
      navigator.vibrate([20, 10, 20]);
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try { localStorage.removeItem('recentSearches'); } catch {}
    
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background animate-slide-from-bottom">
      <div className="flex items-center gap-3 p-4 border-b">
        <button
          onClick={onClose}
          className="mobile-touch-target p-2 -m-2 active:scale-95 transition-transform"
          aria-label="Close search"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search E-Code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-10 h-10 bg-surface-solid border-none text-[13px] placeholder:text-[13px]"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            inputMode="search"
          />
          
          <button
            onClick={handleVoiceSearch}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2",
              "mobile-touch-target p-1 -m-1 active:scale-95 transition-transform",
              isListening && "text-primary animate-pulse"
            )}
            aria-label="Voice search"
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar">
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => {
              setActiveCategory(category.value);
              if ('vibrate' in navigator) navigator.vibrate(5);
            }}
            className={cn(
              "px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200",
              "mobile-touch-target active:scale-95",
              activeCategory === category.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 px-4">
        {!showResults ? (
          <>
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-medium text-muted-foreground">
                    Recent
                  </h3>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[11px] text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
                  >
                    Clear
                  </button>
                </div>
                
                {recentSearches.map((search, index) => (
                  <button
                    key={`${search.query}-${index}`}
                    onClick={() => {
                      setQuery(search.query);
                      handleSearch(search.query, search.category);
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full p-3 -mx-3 hover:bg-surface-tertiary-solid rounded-lg text-left group",
                      "animate-fade-in active:scale-98 transition-transform",
                      `animate-stagger-${Math.min(index + 1, 5)}`
                    )}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-[13px]">{search.query}</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {search.category}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            <div>
              <h3 className="text-[13px] font-medium text-muted-foreground mb-3">
                Trending searches
              </h3>
              
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.text}
                  onClick={() => {
                    setQuery(suggestion.text);
                    handleSearch(suggestion.text, suggestion.category);
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full p-3 -mx-3 hover:bg-surface-tertiary-solid rounded-lg text-left group",
                    "animate-fade-in active:scale-98 transition-transform",
                    `animate-stagger-${Math.min(index + 1, 5)}`
                  )}
                >
                  <TrendingUp className={cn(
                    "h-4 w-4",
                    suggestion.trending 
                      ? "text-primary" 
                      : "text-muted-foreground"
                  )} />
                  <span className="flex-1 text-[13px]">{suggestion.text}</span>
                  <Badge 
                    variant={suggestion.trending ? "default" : "secondary"}
                    className={cn(
                      "text-[11px]",
                      suggestion.trending && "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    {suggestion.category}
                  </Badge>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-medium text-muted-foreground">
                Results for "{query}"
              </h3>
              <button
                onClick={() => setShowResults(false)}
                className="text-[11px] text-primary active:scale-95 transition-transform"
              >
                New search
              </button>
            </div>
            
            {[1, 2, 3, 4, 5].map((_, index) => (
              <div
                key={index}
                className={cn(
                  "p-4 mb-3 bg-surface-solid rounded-lg animate-slideInUp",
                  `animate-stagger-${Math.min(index + 1, 5)}`
                )}
              >
                <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-3 bg-surface-solid rounded w-full mb-2" />
                <div className="h-3 bg-surface-solid rounded w-2/3" />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
