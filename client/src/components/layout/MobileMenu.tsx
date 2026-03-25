// @ts-nocheck
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { ECodeLogo } from '@/components/ECodeLogo';
import {
  Menu, Home, Code, Globe, Users, Database, Book,
  Settings, User, HelpCircle, Crown, Plus, Search,
  Shield, LogOut,
  ChevronRight, Zap, Briefcase, GraduationCap, Workflow, HardDrive
} from 'lucide-react';

interface MobileMenuProps {
  onOpenSpotlight?: () => void;
}

export function MobileMenu({ onOpenSpotlight }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();

  const handleNavigate = (path: string) => {
    setOpen(false);
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

  const navigationLinks = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Code, label: 'My Apps', path: '/projects' },
    { icon: Users, label: 'Community', path: '/community' },
    { icon: Book, label: 'Templates', path: '/templates' },
  ];

  const toolsLinks = [
    { icon: Shield, label: 'Security', path: '/security' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const resourceLinks = [
    { icon: Book, label: 'Documentation', path: '/docs' },
    { icon: HelpCircle, label: 'Help & Support', path: '/support' },
    { icon: Briefcase, label: 'Bounties', path: '/bounties' },
    { icon: GraduationCap, label: 'Learn', path: '/learn' },
  ];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-10 w-10"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-full sm:w-[380px] p-0 bg-white dark:bg-gray-900 dark:bg-zinc-950"
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <ECodeLogo size="sm" showText />
              </div>

              {/* User Profile */}
              {user && (
                <div
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-zinc-900 border border-gray-200 dark:border-gray-700 dark:border-zinc-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => handleNavigate(`/@${user.username}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-bold">
                      {user.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[13px] text-gray-900 dark:text-white dark:text-white">
                        {user.username}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                        {user.email}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              )}

              {!user && (
                <div className="space-y-2">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => handleNavigate('/login')}
                  >
                    Sign In
                  </Button>
                  <Button
                    className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleNavigate('/signup')}
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-6">
              <div className="py-6 space-y-6">
                {/* Create New */}
                {user && (
                  <>
                    <div>
                      <Button
                        className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleNavigate('/new')}
                      >
                        <Plus className="h-4 w-4" />
                        Create New Project
                      </Button>
                    </div>
                    <Separator className="bg-gray-200 dark:bg-zinc-800" />
                  </>
                )}

                {/* Navigation */}
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                    Navigation
                  </h3>
                  <div className="space-y-1">
                    {navigationLinks.map((link) => (
                      <button
                        key={link.path}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors ${
                          location === link.path
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        }`}
                        onClick={() => handleNavigate(link.path)}
                      >
                        <link.icon className="h-4 w-4" />
                        <span className="font-medium">{link.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator className="bg-gray-200 dark:bg-zinc-800" />

                {/* Tools */}
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                    Tools
                  </h3>
                  <div className="space-y-1">
                    {toolsLinks.map((link) => (
                      <button
                        key={link.path}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors ${
                          location === link.path
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        }`}
                        onClick={() => handleNavigate(link.path)}
                      >
                        <link.icon className="h-4 w-4" />
                        <span className="font-medium">{link.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator className="bg-gray-200 dark:bg-zinc-800" />

                {/* Resources */}
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                    Resources
                  </h3>
                  <div className="space-y-1">
                    {resourceLinks.map((link) => (
                      <button
                        key={link.path}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors ${
                          location === link.path
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        }`}
                        onClick={() => handleNavigate(link.path)}
                      >
                        <link.icon className="h-4 w-4" />
                        <span className="font-medium">{link.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            {user && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 dark:border-zinc-800">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-gray-700 dark:text-gray-300 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}