/**
 * ReplitBottomTabs - High-Performance Mobile Navigation
 * 
 * Premium glassmorphic bottom navigation with:
 * - CSS animations for instant performance
 * - E-Code orange (#F26207) accent with gradient glow
 * - IBM Plex Sans typography at 11px
 * - 72px height with proper touch targets (min 48px)
 * - Reduced motion support via CSS media query
 */

import { memo, useCallback, type ElementType } from 'react';
import { Rocket, Monitor, MoreHorizontal, Sparkles, FolderOpen, GitBranch, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

type MobileTab = 'agent' | 'files' | 'deploy' | 'preview' | 'more';

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
  { id: 'files', icon: FolderOpen, label: 'Files' },
  { id: 'preview', icon: Monitor, label: 'Preview' },
  { id: 'agent', icon: Sparkles, label: 'Agent' },
  { id: 'deploy', icon: Rocket, label: 'Deploy' },
  { id: 'more', icon: MoreHorizontal, label: 'Tools' },
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
    if (tabId === 'more') {
      const gitCount = badgeCounts.git || 0;
      const errorsCount = badgeCounts.errors || 0;
      return gitCount + errorsCount > 0 ? gitCount + errorsCount : undefined;
    }
    return undefined;
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50" 
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="mobile-bottom-navigation"
    >
      {/* Solid Navigation Container */}
      <div 
        className="absolute inset-x-3 bottom-2 rounded-[var(--mobile-nav-radius)]"
        style={{
          background: 'var(--mobile-nav-gradient)',
          boxShadow: 'var(--mobile-nav-shadow), var(--mobile-nav-inner-shadow)',
          border: '1px solid var(--mobile-nav-border)',
          borderTop: '1px solid var(--mobile-nav-border-top)',
        }}
      >
        {/* Subtle top highlight line */}
        <div 
          className="absolute top-0 left-4 right-4 h-px"
          style={{
            background: 'var(--mobile-nav-border-top)',
          }}
        />
      </div>
      
      {/* Status Indicators Row */}
      <div className="absolute -top-8 left-0 right-0 px-4 flex items-center justify-between pointer-events-none">
        {/* Connection Status Pill - compact but accessible for mobile */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full pointer-events-auto animate-fade-in"
          style={{
            background: '#1C2333',
            border: `1px solid ${isConnected ? '#22c55e' : '#ef4444'}`,
            boxShadow: isConnected 
              ? '0 2px 8px -2px #22c55e'
              : '0 2px 8px -2px #ef4444',
          }}
          data-testid="indicator-connection-status"
        >
          <div className={isConnected ? 'animate-pulse-slow' : ''}>
            {isConnected ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
          </div>
          <span 
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ 
              color: isConnected ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
              fontFamily: 'var(--ecode-font-sans)',
            }}
          >
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
        
        {/* Status Badges */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {badgeCounts.errors && badgeCounts.errors > 0 && (
            <div 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full animate-scale-in"
              style={{
                background: '#1C2333',
                border: '1px solid #ef4444',
                boxShadow: '0 2px 8px -2px #ef4444',
              }}
              data-testid="indicator-errors"
            >
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span className="text-[11px] font-bold text-red-500" style={{ fontFamily: 'var(--ecode-font-sans)' }}>
                {badgeCounts.errors}
              </span>
            </div>
          )}
          
          {badgeCounts.git && badgeCounts.git > 0 && (
            <div 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full animate-scale-in"
              style={{
                background: '#1C2333',
                border: '1px solid #3D4455',
                boxShadow: '0 2px 6px -2px #0E1525',
              }}
              data-testid="indicator-git-changes"
            >
              <GitBranch className="h-3 w-3 text-[var(--ecode-text-muted)]" />
              <span className="text-[11px] font-semibold text-[var(--ecode-text-muted)]" style={{ fontFamily: 'var(--ecode-font-sans)' }}>
                {badgeCounts.git}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Navigation Items */}
      <nav 
        className="relative flex items-center justify-around px-4 mx-3 mb-2"
        style={{ height: 'var(--mobile-nav-height)' }}
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
                "min-w-[52px] max-w-[72px] min-h-[52px]",
                "rounded-[var(--mobile-nav-item-radius)]",
                "touch-manipulation select-none",
                "transition-transform duration-100",
                "active:scale-[0.92]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecode-accent)] focus-visible:ring-offset-2"
              )}
              data-testid={`tab-${tab.id}`}
            >
              {/* Active Background Pill */}
              {isActive && (
                <div
                  className="absolute inset-1 rounded-[calc(var(--mobile-nav-item-radius)-4px)] animate-scale-in"
                  style={{
                    background: 'var(--mobile-nav-active-bg)',
                    border: '1px solid var(--mobile-nav-active-border)',
                    boxShadow: `0 0 20px -4px var(--mobile-nav-glow), inset 0 1px 0 0 #3D4455`,
                  }}
                />
              )}

              {/* Icon Container */}
              <div className="relative z-10">
                <div className={cn(
                  "transition-transform duration-150",
                  isActive && "transform -translate-y-0.5 scale-110"
                )}>
                  <Icon 
                    className="transition-colors duration-150"
                    style={{
                      width: 'var(--mobile-nav-icon-size)',
                      height: 'var(--mobile-nav-icon-size)',
                      color: isActive ? 'var(--ecode-accent)' : 'var(--ecode-text-muted)',
                      opacity: isActive ? 1 : 'var(--mobile-nav-inactive-opacity)',
                      strokeWidth: isActive ? 2.25 : 1.75,
                    }}
                  />
                </div>
                
                {/* Badge */}
                {badge !== undefined && badge > 0 && (
                  <span 
                    className="absolute -top-2 -right-2.5 flex items-center justify-center animate-scale-in"
                    style={{
                      minWidth: '18px',
                      height: '18px',
                      padding: '0 5px',
                      fontSize: '10px',
                      fontWeight: 700,
                      fontFamily: 'var(--ecode-font-sans)',
                      color: 'white',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      borderRadius: '9px',
                      border: '2px solid var(--ecode-surface)',
                      boxShadow: '0 2px 6px -1px #ef4444',
                    }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              
              {/* Label - compact but accessible font size for mobile inline tabs */}
              <span 
                className={cn(
                  "relative z-10 mt-0.5 font-medium leading-none transition-transform duration-150",
                  isActive && "transform -translate-y-px scale-[1.02]"
                )}
                style={{
                  fontSize: 'var(--mobile-nav-label-size)',
                  fontFamily: 'var(--ecode-font-sans)',
                  color: isActive ? 'var(--ecode-accent)' : 'var(--ecode-text-muted)',
                  opacity: isActive ? 1 : 'var(--mobile-nav-inactive-opacity)',
                  letterSpacing: '0.01em',
                }}
              >
                {tab.label}
              </span>
              
              {/* Active Indicator Line */}
              {isActive && (
                <div
                  className="absolute -bottom-0.5 rounded-full animate-width-expand"
                  style={{
                    height: '3px',
                    background: 'linear-gradient(90deg, var(--ecode-accent), var(--ecode-accent-hover))',
                    boxShadow: '0 0 16px 2px var(--mobile-nav-glow-strong)',
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
