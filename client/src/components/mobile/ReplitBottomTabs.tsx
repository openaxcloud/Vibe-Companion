import { memo, useCallback, type ElementType } from 'react';
import { Monitor, MoreHorizontal, Sparkles, FolderOpen, GitBranch, AlertCircle, Wifi, WifiOff, Code, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

type MobileTab = 'agent' | 'files' | 'editor' | 'preview' | 'terminal';

interface Tab {
  id: MobileTab;
  icon: ElementType;
  label: string;
}

interface BadgeCounts {
  git?: number;
  errors?: number;
}

interface ReplitBottomTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  badgeCounts?: BadgeCounts;
  isConnected?: boolean;
}

const tabs: Tab[] = [
  { id: 'agent', icon: Sparkles, label: 'Chat' },
  { id: 'files', icon: FolderOpen, label: 'Files' },
  { id: 'editor', icon: Code, label: 'Editor' },
  { id: 'preview', icon: Monitor, label: 'Preview' },
  { id: 'terminal', icon: Terminal, label: 'Terminal' },
];

export const ReplitBottomTabs = memo(function ReplitBottomTabs({ 
  activeTab,
  onTabChange,
  badgeCounts = {},
  isConnected = true,
}: ReplitBottomTabsProps) {
  const isMobile = useIsMobile();
  
  if (!isMobile) {
    return null;
  }

  const handleTabClick = useCallback((tabId: string) => {
    onTabChange(tabId);
    if ('vibrate' in navigator) {
      navigator.vibrate([8, 50, 4]);
    }
  }, [onTabChange]);

  const getBadgeForTab = (tabId: MobileTab): number | undefined => {
    if (tabId === 'terminal') {
      return badgeCounts.errors && badgeCounts.errors > 0 ? badgeCounts.errors : undefined;
    }
    return undefined;
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50" 
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="mobile-bottom-navigation"
    >
      <div 
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '56px',
          background: 'var(--mobile-nav-gradient)',
          boxShadow: 'var(--mobile-nav-shadow)',
          borderTop: '1px solid var(--mobile-nav-border-top)',
        }}
      />
      
      {!isConnected && (
        <div className="absolute -top-6 left-0 right-0 px-4 flex items-center justify-center pointer-events-none">
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full pointer-events-auto animate-fade-in"
            style={{
              background: '#1C2333',
              border: '1px solid #ef4444',
              boxShadow: '0 2px 8px -2px #ef4444',
            }}
            data-testid="indicator-connection-status"
          >
            <WifiOff className="h-3 w-3 text-red-500" />
            <span 
              className="text-[11px] font-semibold uppercase tracking-wider text-red-500"
              style={{ fontFamily: 'var(--ecode-font-sans)' }}
            >
              Offline
            </span>
          </div>
        </div>
      )}
      
      <nav 
        className="relative flex items-center justify-around px-2"
        style={{ height: '56px' }}
        data-testid="nav-bottom-tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = getBadgeForTab(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1",
                "min-h-[44px] min-w-[44px]",
                "rounded-lg",
                "touch-manipulation select-none",
                "transition-transform duration-100",
                "active:scale-[0.92]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecode-accent)] focus-visible:ring-offset-1"
              )}
              data-testid={`tab-${tab.id}`}
              aria-label={tab.label}
              aria-selected={isActive}
              role="tab"
            >
              <div className="relative z-10">
                <div className={cn(
                  "transition-transform duration-150",
                  isActive && "transform -translate-y-0.5"
                )}>
                  <Icon 
                    className="transition-colors duration-150"
                    style={{
                      width: '24px',
                      height: '24px',
                      color: isActive ? 'var(--ecode-accent)' : 'var(--ecode-text-muted)',
                      opacity: isActive ? 1 : 0.55,
                      strokeWidth: isActive ? 2.25 : 1.75,
                    }}
                  />
                </div>
                
                {badge !== undefined && badge > 0 && (
                  <span 
                    className="absolute -top-1.5 -right-2 flex items-center justify-center"
                    style={{
                      minWidth: '16px',
                      height: '16px',
                      padding: '0 4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      fontFamily: 'var(--ecode-font-sans)',
                      color: 'white',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      borderRadius: '8px',
                      border: '2px solid var(--ecode-surface)',
                    }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              
              <span 
                className={cn(
                  "relative z-10 mt-0.5 font-medium leading-none transition-all duration-150",
                  isActive && "transform -translate-y-px"
                )}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--ecode-font-sans)',
                  color: isActive ? 'var(--ecode-accent)' : 'var(--ecode-text-muted)',
                  opacity: isActive ? 1 : 0.55,
                  letterSpacing: '0.01em',
                }}
              >
                {tab.label}
              </span>
              
              {isActive && (
                <div
                  className="absolute bottom-0 rounded-full animate-width-expand"
                  style={{
                    width: '20px',
                    height: '3px',
                    background: 'linear-gradient(90deg, var(--ecode-accent), var(--ecode-accent-hover))',
                    boxShadow: '0 0 12px 2px var(--mobile-nav-glow-strong)',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
});
