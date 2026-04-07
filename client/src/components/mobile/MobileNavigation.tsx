import { Link, useLocation } from 'wouter';
import { Home, Folder, Plus, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  isCenter?: boolean;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Folder, label: 'Projects', path: '/projects' },
  { icon: Plus, label: 'Create', path: '#create', isCenter: true },
  { icon: Bell, label: 'Notifications', path: '/notifications', badge: 3 },
  { icon: User, label: 'Profile', path: '/profile' },
];

interface MobileNavigationProps {
  onCreateClick?: () => void;
  notifications?: number;
}

export function MobileNavigation({ onCreateClick, notifications = 0 }: MobileNavigationProps) {
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(location);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showPulse, setShowPulse] = useState(true);
  const activeIndicatorRef = useRef<HTMLDivElement>(null);
  
  const isMobile = useIsMobile();

  useEffect(() => {
    setActiveTab(location);
  }, [location]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowPulse(prev => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleItemClick = (item: NavItem, e?: React.MouseEvent) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    if (item.path === '/dashboard' && activeTab === '/dashboard') {
      const currentTime = Date.now();
      if (currentTime - lastTapTime < 500) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if ('vibrate' in navigator) {
          navigator.vibrate([10, 10, 10]);
        }
      }
      setLastTapTime(currentTime);
    }

    if (item.isCenter && onCreateClick) {
      onCreateClick();
      if ('vibrate' in navigator) {
        navigator.vibrate([20, 10, 20]);
      }
    } else if (!item.isCenter) {
      setActiveTab(item.path);
    }
  };

  if (!isMobile) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 mobile-safe-bottom">
      <div className="absolute inset-0 bg-[var(--mobile-ide-bg)] border-t border-[var(--ecode-border)]" />
      
      <nav className="relative flex items-center justify-around h-14">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.path;
          const isCenter = item.isCenter;
          const hasBadge = item.badge || (item.path === '/notifications' && notifications > 0);
          const badgeCount = item.badge || notifications;

          if (isCenter) {
            return (
              <button
                key={item.label}
                onClick={() => handleItemClick(item)}
                className="relative mobile-touch-target flex items-center justify-center active:scale-85 transition-transform duration-150"
              >
                <div
                  className={cn(
                    "relative bg-gradient-to-br from-ecode-accent to-ecode-accent-hover rounded-full p-3 shadow-lg transition-transform duration-300",
                    showPulse && "animate-pulse"
                  )}
                >
                  <Icon className="h-6 w-6 text-white" />
                  
                  <div className="absolute inset-0 rounded-full bg-white animate-ripple" />
                </div>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.path}
              onClick={(e) => handleItemClick(item, e)}
              className="relative mobile-touch-target flex flex-col items-center justify-center px-3 py-2 group"
            >
              <div
                className={cn(
                  "relative transition-transform duration-200 active:scale-92",
                  isActive && "-translate-y-0.5 scale-110"
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-all duration-300',
                    isActive 
                      ? 'text-ecode-accent' 
                      : 'text-[var(--ecode-text-muted)] group-active:text-ecode-accent'
                  )}
                />
                
                {hasBadge && badgeCount > 0 && (
                  <div className="absolute -top-1 -right-1 animate-scale-in">
                    <div className="bg-status-critical text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </div>
                    
                    <div className="absolute inset-0 bg-status-critical rounded-full animate-badge-pulse" />
                  </div>
                )}
                
                {isActive && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 animate-width-expand">
                    <div className="h-[2px] w-5 bg-ecode-accent rounded-full" />
                  </div>
                )}
              </div>
              
              <span 
                className={cn(
                  'text-[10px] mt-1 transition-all duration-300',
                  isActive 
                    ? 'text-ecode-accent font-semibold scale-105' 
                    : 'text-[var(--ecode-text-muted)] font-normal opacity-80'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
