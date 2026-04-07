import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard,
  Users,
  Key,
  FileText,
  Ticket,
  CreditCard,
  Book,
  Activity,
  Settings,
  Inbox,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronLeft,
  HeartPulse,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ECodeLogo } from '@/components/ECodeLogo';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/ai-optimization', icon: Zap, label: 'AI Optimization' },
    { path: '/admin/monitoring', icon: HeartPulse, label: 'Monitoring' },
    { path: '/admin/system-monitoring', icon: Activity, label: 'System Monitoring' },
    { path: '/admin/requests', icon: Inbox, label: 'Customer Requests' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/api-keys', icon: Key, label: 'API Keys' },
    { path: '/admin/cms', icon: FileText, label: 'CMS Pages' },
    { path: '/admin/docs', icon: Book, label: 'Documentation' },
    { path: '/admin/support', icon: Ticket, label: 'Support' },
    { path: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
    { path: '/admin/activity', icon: Activity, label: 'Activity Logs' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen relative bg-background dark:bg-[var(--ecode-background)]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card dark:bg-[var(--ecode-surface)] border-b border-border z-50 flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-foreground hover:bg-muted dark:hover:bg-[var(--ecode-surface-hover)]"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          data-testid="button-mobile-menu"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="text-foreground font-semibold">Admin Panel</span>
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-background/80 dark:bg-black/60 z-30 backdrop-blur-sm"
          onClick={closeMobileMenu}
          data-testid="backdrop-mobile-menu"
        />
      )}

      {/* Sidebar - Responsive */}
      <aside className={`
        fixed lg:relative
        w-72 sm:w-64 h-full
        bg-card dark:bg-[var(--ecode-surface)] border-r border-border
        z-40
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        pt-14 lg:pt-0
      `}>
        <div className="p-4 sm:p-6 border-b border-border hidden lg:block">
          <div className="flex items-center gap-3">
            <ECodeLogo size="sm" showText={false} />
            <div>
              <h1 className="text-[15px] font-bold text-foreground">Admin Panel</h1>
              <p className="text-[11px] text-muted-foreground">E-Code Administration</p>
            </div>
          </div>
        </div>
        
        <ScrollArea className="h-[calc(100%-140px)] lg:h-[calc(100%-130px)]">
          <nav className="p-3 sm:p-4">
            {navItems.map((item) => {
              const isActive = location === item.path || 
                (item.path !== '/admin' && location.startsWith(item.path));
              const Icon = item.icon;
              
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={`w-full justify-start mb-1 h-11 sm:h-10 text-[13px] ${
                      isActive 
                        ? 'bg-primary/10 text-primary dark:bg-primary/15' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-[var(--ecode-surface-hover)]'
                    }`}
                    onClick={closeMobileMenu}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 border-t border-border bg-card dark:bg-[var(--ecode-surface)]">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-[var(--ecode-surface-hover)] h-11 sm:h-10"
              onClick={closeMobileMenu}
              data-testid="button-exit-admin"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Exit Admin
            </Button>
          </Link>
        </div>
      </aside>
      
      {/* Main Content - Responsive */}
      <main className="flex-1 w-full lg:w-auto overflow-y-auto bg-background dark:bg-[var(--ecode-background)] pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}