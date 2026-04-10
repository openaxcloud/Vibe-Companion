import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  MoreHorizontal,
  FileText,
  Code,
  Settings,
  Terminal,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  title: string;
  icon?: string;
  type: 'file' | 'terminal' | 'webview' | 'settings';
  path?: string;
  isDirty?: boolean;
  isActive?: boolean;
}

interface ReplitTabBarProps {
  tabs: Tab[];
  activeTab?: string;
  onTabClick?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onNewTab?: () => void;
  className?: string;
}

const getTabIcon = (tab: Tab) => {
  switch (tab.type) {
    case 'file':
      if (tab.path?.endsWith('.js') || tab.path?.endsWith('.jsx')) return <Code className="h-3 w-3" />;
      if (tab.path?.endsWith('.ts') || tab.path?.endsWith('.tsx')) return <Code className="h-3 w-3" />;
      if (tab.path?.endsWith('.html')) return <Globe className="h-3 w-3" />;
      return <FileText className="h-3 w-3" />;
    case 'terminal':
      return <Terminal className="h-3 w-3" />;
    case 'webview':
      return <Globe className="h-3 w-3" />;
    case 'settings':
      return <Settings className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

const getLanguageColor = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'text-yellow-500';
    case 'ts':
    case 'tsx':
      return 'text-blue-500';
    case 'py':
      return 'text-green-500';
    case 'html':
      return 'text-orange-500';
    case 'css':
      return 'text-blue-400';
    case 'json':
      return 'text-yellow-600';
    case 'md':
      return 'text-gray-500';
    default:
      return 'text-gray-400';
  }
};

export function ReplitTabBar({
  tabs,
  activeTab,
  onTabClick,
  onTabClose,
  onNewTab,
  className
}: ReplitTabBarProps) {
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkScroll = () => {
      const container = scrollContainerRef.current;
      const tabsContainer = tabsRef.current;
      
      if (container && tabsContainer) {
        const containerWidth = container.clientWidth;
        const tabsWidth = tabsContainer.scrollWidth;
        const scrollLeft = container.scrollLeft;
        
        setShowScrollButtons(tabsWidth > containerWidth);
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < tabsWidth - containerWidth);
      }
    };

    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      const resizeObserver = new ResizeObserver(checkScroll);
      resizeObserver.observe(container);
      
      return () => {
        container.removeEventListener('scroll', checkScroll);
        resizeObserver.disconnect();
      };
    }
  }, [tabs]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const scrollAmount = 200;
    const newScrollLeft = container.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
    
    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  const scrollToActiveTab = () => {
    if (!activeTab) return;
    
    const activeTabElement = document.querySelector(`[data-tab-id="${activeTab}"]`);
    if (activeTabElement && scrollContainerRef.current) {
      activeTabElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest', 
        inline: 'center' 
      });
    }
  };

  useEffect(() => {
    scrollToActiveTab();
  }, [activeTab]);

  return (
    <div className={cn(
      "flex items-center bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] h-9",
      className
    )}>
      {/* Left scroll button */}
      {showScrollButtons && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 flex-shrink-0 rounded-none border-r border-[var(--ecode-border)]",
            !canScrollLeft && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => scrollTabs('left')}
          disabled={!canScrollLeft}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
      )}

      {/* Tabs container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div 
          ref={tabsRef}
          className="flex h-full"
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              className={cn(
                "flex items-center min-w-0 max-w-[200px] border-r border-[var(--ecode-border)] group relative",
                "hover:bg-[var(--ecode-sidebar-hover)] transition-colors",
                tab.id === activeTab 
                  ? "bg-[var(--ecode-background)] text-[var(--ecode-text)]" 
                  : "bg-[var(--ecode-surface)] text-[var(--ecode-text-secondary)]"
              )}
            >
              <Button
                variant="ghost"
                className={cn(
                  "h-8 flex-1 justify-start px-3 rounded-none border-none min-w-0",
                  "hover:bg-[var(--ecode-sidebar-hover)] focus:bg-[var(--ecode-sidebar-hover)]"
                )}
                onClick={() => onTabClick?.(tab.id)}
              >
                <div className="flex items-center min-w-0 gap-2">
                  <div className={cn(
                    "flex-shrink-0",
                    tab.path ? getLanguageColor(tab.path) : "text-[var(--ecode-text-secondary)]"
                  )}>
                    {getTabIcon(tab)}
                  </div>
                  
                  <span className="truncate text-[13px] font-medium">
                    {tab.title}
                  </span>
                  
                  {tab.isDirty && (
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[var(--ecode-accent)]" />
                  )}
                </div>
              </Button>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 flex-shrink-0 rounded-sm mr-1 opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-[var(--ecode-border)] text-[var(--ecode-text-secondary)] hover:text-[var(--ecode-text)]"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose?.(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>

              {/* Active tab indicator */}
              {tab.id === activeTab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--ecode-accent)]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right scroll button */}
      {showScrollButtons && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 flex-shrink-0 rounded-none border-l border-[var(--ecode-border)]",
            !canScrollRight && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => scrollTabs('right')}
          disabled={!canScrollRight}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}

      {/* New tab button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 rounded-none border-l border-[var(--ecode-border)] hover:bg-[var(--ecode-sidebar-hover)]"
        onClick={onNewTab}
      >
        <Plus className="h-3 w-3" />
      </Button>

      {/* More options */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 rounded-none border-l border-[var(--ecode-border)] hover:bg-[var(--ecode-sidebar-hover)]"
      >
        <MoreHorizontal className="h-3 w-3" />
      </Button>
    </div>
  );
}