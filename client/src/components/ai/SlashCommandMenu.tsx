import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { SiAnthropic, SiOpenai } from 'react-icons/si';
import { cn } from '@/lib/utils';

// MCP Server/Integration icons - matching Replit design
const GoogleGeminiIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
    <path d="M12 2L4 6v12l8 4 8-4V6l-8-4z" fill="#4285F4"/>
    <path d="M12 2L4 6v12l8 4V2z" fill="#1A73E8"/>
  </svg>
);

const OpenRouterIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M4 6h6v2H4V6zm8 0h6v2h-6V6zM4 11h6v2H4v-2zm8 0h6v2h-6v-2zM4 16h6v2H4v-2zm8 0h6v2h-6v-2z"/>
  </svg>
);

const AgentMailIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 3c-4.97 0-9 3.58-9 8s4.03 8 9 8c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>
);

const AsanaIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#F06A6A">
    <circle cx="12" cy="6" r="4"/>
    <circle cx="6" cy="16" r="4"/>
    <circle cx="18" cy="16" r="4"/>
  </svg>
);

const FigmaIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path d="M8 24c2.2 0 4-1.8 4-4v-4H8c-2.2 0-4 1.8-4 4s1.8 4 4 4z" fill="#0ACF83"/>
    <path d="M4 12c0-2.2 1.8-4 4-4h4v8H8c-2.2 0-4-1.8-4-4z" fill="#A259FF"/>
    <path d="M4 4c0-2.2 1.8-4 4-4h4v8H8C5.8 8 4 6.2 4 4z" fill="#F24E1E"/>
    <path d="M12 0h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4V0z" fill="#FF7262"/>
    <path d="M20 12c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4 4 1.8 4 4z" fill="#1ABCFE"/>
  </svg>
);

const XAIIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M4 4l8 8-8 8h3l6.5-6.5L22 20h-3l-5.5-5.5L8 20H4l8-8-8-8h4l5 5 5-5h4l-8 8 8 8"/>
  </svg>
);

const MoonshotIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"/>
  </svg>
);

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  icon: 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'agentmail' | 'asana' | 'figma' | 'xai' | 'moonshot' | 'custom';
  connected?: boolean;
}

// Default MCP servers based on Replit design
export const DEFAULT_MCP_SERVERS: MCPServer[] = [
  { id: 'anthropic', name: 'Anthropic', description: 'Claude AI models', icon: 'anthropic', connected: true },
  { id: 'google-gemini', name: 'Google Gemini', description: 'Gemini AI models', icon: 'gemini', connected: true },
  { id: 'openai', name: 'OpenAI', description: 'GPT models', icon: 'openai', connected: true },
  { id: 'openrouter', name: 'OpenRouter', description: 'Multi-provider routing', icon: 'openrouter', connected: false },
  { id: 'xai', name: 'xAI', description: 'Grok models', icon: 'xai', connected: true },
  { id: 'moonshot', name: 'Moonshot AI', description: 'Kimi models', icon: 'moonshot', connected: true },
  { id: 'agentmail', name: 'AgentMail', description: 'Email automation', icon: 'agentmail', connected: false },
  { id: 'asana', name: 'Asana', description: 'Project management', icon: 'asana', connected: false },
  { id: 'figma', name: 'Figma', description: 'Design imports', icon: 'figma', connected: true },
];

interface SlashCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (server: MCPServer) => void;
  servers?: MCPServer[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedIndex?: number;
  triggerRef?: React.RefObject<HTMLElement>;
}

export function SlashCommandMenu({
  isOpen,
  onClose,
  onSelect,
  servers = DEFAULT_MCP_SERVERS,
  searchQuery = '',
  onSearchChange,
  selectedIndex = 0,
  triggerRef,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [internalQuery, setInternalQuery] = useState(searchQuery);
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(selectedIndex);
  const [portalPos, setPortalPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const query = onSearchChange ? searchQuery : internalQuery;
  const setQuery = onSearchChange || setInternalQuery;
  const currentIndex = selectedIndex !== undefined ? selectedIndex : internalSelectedIndex;

  // Filter servers based on search query
  const filteredServers = servers.filter(server =>
    server.name.toLowerCase().includes(query.toLowerCase()) ||
    server.description?.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPortalPos({
        left: rect.left,
        width: rect.width,
        top: rect.top - 8,
      });
    } else if (isOpen) {
      const parent = menuRef.current?.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        setPortalPos({
          left: rect.left,
          width: rect.width,
          top: rect.top - 8,
        });
      }
    }
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setInternalSelectedIndex(prev => Math.min(prev + 1, filteredServers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setInternalSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredServers[currentIndex]) {
        onSelect(filteredServers[currentIndex]);
      }
    }
  }, [filteredServers, currentIndex, onClose, onSelect]);

  const getServerIcon = (icon: MCPServer['icon']) => {
    switch (icon) {
      case 'anthropic':
        return <SiAnthropic className="h-4 w-4 text-[#D97757]" />;
      case 'openai':
        return <SiOpenai className="h-4 w-4 text-[#10A37F]" />;
      case 'gemini':
        return <GoogleGeminiIcon />;
      case 'openrouter':
        return <OpenRouterIcon />;
      case 'agentmail':
        return <AgentMailIcon />;
      case 'asana':
        return <AsanaIcon />;
      case 'figma':
        return <FigmaIcon />;
      case 'xai':
        return <XAIIcon />;
      case 'moonshot':
        return <MoonshotIcon />;
      default:
        return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  if (!isOpen) return null;

  const menuContent = (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[9999]",
        "bg-popover text-popover-foreground border border-border rounded-lg shadow-xl",
        "overflow-hidden animate-in slide-in-from-bottom-2 duration-200",
        "flex flex-col"
      )}
      style={{
        bottom: portalPos ? `${window.innerHeight - portalPos.top}px` : undefined,
        left: portalPos ? `${portalPos.left}px` : '0',
        width: portalPos ? `${portalPos.width}px` : '100%',
        maxHeight: 'min(420px, 50vh)',
      }}
      onKeyDown={handleKeyDown}
      data-testid="slash-command-menu"
    >
      {/* Search input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          data-testid="input-slash-search"
        />
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-slash-close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Server list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-2 py-1.5">
          <span className="text-[11px] font-medium text-muted-foreground px-2">
            Integrations
          </span>
        </div>
        
        {filteredServers.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">
            No integrations found
          </div>
        ) : (
          <div className="pb-1">
            {filteredServers.map((server, index) => (
              <button
                key={server.id}
                onClick={() => onSelect(server)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-md text-left",
                  "transition-colors duration-100",
                  index === currentIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50 text-foreground"
                )}
                data-testid={`slash-item-${server.id}`}
              >
                <span className="shrink-0">{getServerIcon(server.icon)}</span>
                <span className="flex-1 text-[13px] font-medium">{server.name}</span>
                {index === currentIndex && (
                  <span className="text-[11px] text-muted-foreground">Enter</span>
                )}
                {server.connected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Connected" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30 shrink-0">
        <span className="text-[11px] text-muted-foreground">
          Type '/' on page
        </span>
        <span className="text-[11px] text-muted-foreground">
          esc
        </span>
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
}

// Hook for managing slash command state
export function useSlashCommand() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const open = useCallback(() => {
    setIsOpen(true);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);

  const handleInputChange = useCallback((value: string, cursorPosition: number) => {
    // Check if user just typed "/"
    if (value.endsWith('/') && !isOpen) {
      open();
      return true; // Indicate that slash was detected
    }
    return false;
  }, [isOpen, open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, filteredLength: number) => {
    if (!isOpen) return false;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return true;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredLength - 1));
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return true;
    }
    if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      return true; // Let parent handle the selection
    }
    return false;
  }, [isOpen, close]);

  // ✅ FIX (Dec 21, 2025): Memoize return object to prevent infinite re-renders
  // when this hook's return value is used as a useEffect dependency
  return useMemo(() => ({
    isOpen,
    open,
    close,
    searchQuery,
    setSearchQuery,
    selectedIndex,
    setSelectedIndex,
    handleInputChange,
    handleKeyDown,
  }), [isOpen, open, close, searchQuery, selectedIndex, handleInputChange, handleKeyDown]);
}
