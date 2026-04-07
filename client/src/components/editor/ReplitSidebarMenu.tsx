// @ts-nocheck
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from 'next-themes';
import {
  Home,
  Code,
  Globe,
  Book,
  User,
  UserCircle,
  Bell,
  Users,
  Terminal as TerminalIcon,
  Palette,
  HelpCircle,
  LogOut,
  ChevronRight,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

interface ReplitSidebarMenuProps {
  isOpen: boolean;
  onClose?: () => void;
  onNavigate?: (path: string) => void;
}

export function ReplitSidebarMenu({ isOpen, onClose, onNavigate }: ReplitSidebarMenuProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [expandedSections, setExpandedSections] = useState<string[]>(['main']);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  const handleNavigation = (path: string) => {
    setLocation(path);
    onNavigate?.(path);
    onClose?.();
  };

  const menuItems = [
    {
      id: 'main',
      title: 'Main',
      items: [
        { icon: Home, label: 'Home', path: '/dashboard' },
        { icon: Code, label: 'E-Code', path: '/editor' },
        { icon: Globe, label: 'dotWeb', path: '/explore' },
        { icon: Book, label: 'LibreOffice', path: '/docs' }
      ]
    },
    {
      id: 'account',
      title: 'Account',
      items: [
        { icon: User, label: 'Account', path: '/account' },
        { icon: UserCircle, label: 'Profile', path: '/profile' },
        { icon: Bell, label: 'Notifications', path: '/notifications' }
      ]
    },
    {
      id: 'tools',
      title: 'Tools',
      items: [
        { icon: Users, label: 'Create Team', path: '/teams/create' },
        { icon: TerminalIcon, label: 'CLI', path: '/cli' },
        { icon: Palette, label: 'Theme', action: 'theme' },
        { icon: HelpCircle, label: 'Help', path: '/help' }
      ]
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="h-full w-64 bg-[var(--ecode-surface)] border-r border-[var(--ecode-border)] flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--ecode-border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-status-warning to-orange-600 rounded-lg flex items-center justify-center">
            <Code className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-[var(--ecode-text)]">E-Code</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-[var(--ecode-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-medium">
              {user.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <div className="font-medium text-[13px] text-[var(--ecode-text)]">
                {user.username || user.email}
              </div>
              <div className="text-[11px] text-[var(--ecode-text-muted)]">
                Free plan
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {menuItems.map((section) => (
            <div key={section.id} className="mb-2">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-[var(--ecode-text-muted)] uppercase tracking-wider hover:bg-[var(--ecode-sidebar-hover)] rounded-md"
                onClick={() => toggleSection(section.id)}
              >
                <span>{section.title}</span>
                {expandedSections.includes(section.id) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
              
              {expandedSections.includes(section.id) && (
                <div className="mt-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    
                    if (item.action === 'theme') {
                      return (
                        <button
                          key={item.label}
                          className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] rounded-md"
                          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="flex-1 text-left">{item.label}</span>
                          <span className="text-[11px] text-[var(--ecode-text-muted)]">
                            {theme === 'dark' ? 'Dark' : 'Light'}
                          </span>
                        </button>
                      );
                    }
                    
                    return (
                      <button
                        key={item.label}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-[13px] text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] rounded-md",
                          location === item.path && "bg-[var(--ecode-accent-subtle)] text-[var(--ecode-accent)]"
                        )}
                        onClick={() => handleNavigation(item.path)}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 text-left">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--ecode-border)]">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[13px] hover:bg-[var(--ecode-sidebar-hover)]"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </Button>
      </div>
    </div>
  );
}