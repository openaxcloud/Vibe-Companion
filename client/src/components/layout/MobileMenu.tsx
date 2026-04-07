import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Menu, X, Home, Code, Zap, Globe, Users, Database, Book, 
  Settings, User, HelpCircle, Crown, Plus, Search, FileCode,
  Terminal, GitBranch, Sparkles, Package, Shield, LogOut,
  ChevronRight, Heart, Star, Briefcase, GraduationCap
} from 'lucide-react';

interface MobileMenuProps {
  onOpenSpotlight?: () => void;
}

export function MobileMenu({ onOpenSpotlight }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();

  const handleNavigate = (path: string) => {
    // Close the menu immediately
    setOpen(false);
    // Navigate after a small delay to ensure smooth animation
    setTimeout(() => {
      navigate(path);
    }, 150);
  };

  const handleLogout = () => {
    setOpen(false);
    setTimeout(() => {
      logoutMutation.mutate();
    }, 150);
  };

  const primaryLinks = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Code, label: 'My Projects', path: '/projects' },
    { icon: Plus, label: 'Create New', path: '/projects', action: 'create' },
    { icon: Globe, label: 'Explore', path: '/explore' },
    { icon: Users, label: 'Community', path: '/community' },
    { icon: Briefcase, label: 'Teams', path: '/teams' },
  ];

  const handlePrimaryLinkClick = (link: any) => {
    if (link.action === 'create') {
      // Close menu and navigate to projects with create action
      setOpen(false);
      setTimeout(() => {
        navigate('/projects');
        // Trigger create modal after navigation
        setTimeout(() => {
          const createButton = document.querySelector('[data-create-project]');
          if (createButton) {
            (createButton as HTMLElement).click();
          }
        }, 300);
      }, 150);
    } else {
      handleNavigate(link.path);
    }
  };

  const toolsLinks = [
    { icon: Terminal, label: 'Shell', path: '/shell' },
    { icon: GitBranch, label: 'Version Control', path: '/git' },
    { icon: Database, label: 'Database', path: '/database' },
    { icon: Package, label: 'Packages', path: '/packages' },
    { icon: Shield, label: 'Secrets', path: '/secrets' },
  ];

  const accountLinks = [
    { icon: User, label: 'Profile', path: `/@${user?.username}` },
    { icon: Settings, label: 'Account Settings', path: '/account' },
    { icon: Zap, label: 'Cycles & Power Ups', path: '/cycles' },
    { icon: Globe, label: 'Deployments', path: '/deployments' },
    { icon: Database, label: 'Bounties', path: '/bounties' },
    { icon: Star, label: 'Achievements', path: '/achievements' },
  ];

  const learnLinks = [
    { icon: GraduationCap, label: 'Learn', path: '/learn' },
    { icon: Book, label: 'Documentation', path: '/docs' },
    { icon: HelpCircle, label: 'Support', path: '/support' },
    { icon: Heart, label: 'Community Forum', path: '/forum' },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden h-10 w-10"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="left" 
        className="w-[300px] sm:w-[380px] p-0 bg-[var(--ecode-background)] border-[var(--ecode-border)]"
      >
        <SheetHeader className="px-6 py-4 border-b border-[var(--ecode-border)]">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[var(--ecode-text)]">E-Code</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="px-6 py-4">
            {/* Search */}
            <Button
              variant="outline"
              className="w-full justify-start mb-4"
              onClick={() => {
                setOpen(false);
                onOpenSpotlight?.();
              }}
            >
              <Search className="mr-2 h-4 w-4" />
              Search or run a command...
            </Button>

            {/* User Info */}
            {user && (
              <>
                <div 
                  className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-[var(--ecode-surface)] cursor-pointer hover:bg-[var(--ecode-sidebar-hover)] transition-colors"
                  onClick={() => handleNavigate(`/@${user.username}`)}
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--ecode-accent)] text-white flex items-center justify-center font-semibold">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[var(--ecode-text)]">{user.displayName || user.username}</p>
                    <p className="text-sm text-[var(--ecode-text-secondary)]">{user.email}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--ecode-text-secondary)]" />
                </div>
                <Separator className="mb-4" />
              </>
            )}

            {/* Primary Navigation */}
            <div className="space-y-1 mb-6">
              <h3 className="text-xs font-semibold text-[var(--ecode-text-secondary)] uppercase tracking-wider mb-2">
                Navigation
              </h3>
              {primaryLinks.map((link) => (
                <Button
                  key={link.label}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handlePrimaryLinkClick(link)}
                >
                  <link.icon className="mr-3 h-4 w-4" />
                  {link.label}
                </Button>
              ))}
            </div>

            <Separator className="mb-4" />

            {/* Tools */}
            <div className="space-y-1 mb-6">
              <h3 className="text-xs font-semibold text-[var(--ecode-text-secondary)] uppercase tracking-wider mb-2">
                Tools
              </h3>
              {toolsLinks.map((link) => (
                <Button
                  key={link.path}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleNavigate(link.path)}
                >
                  <link.icon className="mr-3 h-4 w-4" />
                  {link.label}
                </Button>
              ))}
            </div>

            <Separator className="mb-4" />

            {/* Account */}
            {user && (
              <>
                <div className="space-y-1 mb-6">
                  <h3 className="text-xs font-semibold text-[var(--ecode-text-secondary)] uppercase tracking-wider mb-2">
                    Account
                  </h3>
                  {accountLinks.map((link) => (
                    <Button
                      key={link.path}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => handleNavigate(link.path)}
                    >
                      <link.icon className="mr-3 h-4 w-4" />
                      {link.label}
                    </Button>
                  ))}
                </div>

                <Separator className="mb-4" />
              </>
            )}

            {/* Learn & Support */}
            <div className="space-y-1 mb-6">
              <h3 className="text-xs font-semibold text-[var(--ecode-text-secondary)] uppercase tracking-wider mb-2">
                Learn & Support
              </h3>
              {learnLinks.map((link) => (
                <Button
                  key={link.path}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleNavigate(link.path)}
                >
                  <link.icon className="mr-3 h-4 w-4" />
                  {link.label}
                </Button>
              ))}
            </div>

            <Separator className="mb-4" />

            {/* Actions */}
            <div className="space-y-2">
              {!user ? (
                <Button
                  className="w-full"
                  onClick={() => handleNavigate('/auth')}
                >
                  Sign In
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-[var(--ecode-warning)] text-[var(--ecode-warning)]"
                    onClick={() => handleNavigate('/pricing')}
                  >
                    <Crown className="mr-2 h-4 w-4" />
                    Upgrade to Pro
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                  </Button>
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}