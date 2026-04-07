import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { DialogTitle } from '@/components/ui/dialog';
import {
  Search,
  File,
  FolderOpen,
  Settings,
  Plus,
  Clock,
  Star,
  Code,
  Terminal,
  Rocket,
  Users,
  GitBranch,
  Package,
  Database,
  Zap,
  Home,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';

interface SpotlightSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpotlightSearch({ open, onOpenChange }: SpotlightSearchProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  // Fetch recent projects for quick access
  const { data: recentProjects = [] } = useQuery({
    queryKey: ['/api/projects/recent'],
    enabled: !!user && open,
  });

  // Quick actions
  const quickActions = [
    {
      id: 'new-repl',
      name: 'Create New Repl',
      icon: Plus,
      shortcut: '⌘N',
      action: () => {
        onOpenChange(false);
        // Trigger create modal
      },
    },
    {
      id: 'home',
      name: 'Go to Dashboard',
      icon: Home,
      shortcut: '⌘H',
      action: () => {
        onOpenChange(false);
        navigate('/dashboard');
      },
    },
    {
      id: 'explore',
      name: 'Explore Community',
      icon: Globe,
      shortcut: '⌘E',
      action: () => {
        onOpenChange(false);
        navigate('/explore');
      },
    },
    {
      id: 'deployments',
      name: 'View Deployments',
      icon: Rocket,
      action: () => {
        onOpenChange(false);
        navigate('/deployments');
      },
    },
    {
      id: 'teams',
      name: 'My Teams',
      icon: Users,
      action: () => {
        onOpenChange(false);
        navigate('/teams');
      },
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: Settings,
      shortcut: '⌘,',
      action: () => {
        onOpenChange(false);
        navigate('/settings');
      },
    },
  ];

  // Editor commands (when in a project)
  const editorCommands = [
    {
      id: 'run',
      name: 'Run Project',
      icon: Zap,
      shortcut: '⌘⏎',
      category: 'Editor',
    },
    {
      id: 'terminal',
      name: 'Toggle Terminal',
      icon: Terminal,
      shortcut: '⌘`',
      category: 'Editor',
    },
    {
      id: 'git',
      name: 'Git: Commit',
      icon: GitBranch,
      shortcut: '⌘K',
      category: 'Editor',
    },
    {
      id: 'packages',
      name: 'Manage Packages',
      icon: Package,
      category: 'Editor',
    },
    {
      id: 'database',
      name: 'Open Database',
      icon: Database,
      category: 'Editor',
    },
  ];

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = useCallback((callback: () => void) => {
    onOpenChange(false);
    callback();
  }, [onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Command Menu</DialogTitle>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <>
            <CommandGroup heading="Recent Projects">
              {recentProjects.slice(0, 5).map((project: any) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => handleSelect(() => navigate(`/project/${project.id}`))}
                  className="flex items-center gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="flex-1">{project.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {project.language}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.id}
                onSelect={() => handleSelect(action.action)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{action.name}</span>
                {action.shortcut && (
                  <span className="text-xs text-muted-foreground">
                    {action.shortcut}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* Editor Commands */}
        <CommandSeparator />
        <CommandGroup heading="Editor Commands">
          {editorCommands.map((command) => {
            const Icon = command.icon;
            return (
              <CommandItem
                key={command.id}
                disabled
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{command.name}</span>
                {command.shortcut && (
                  <span className="text-xs text-muted-foreground">
                    {command.shortcut}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}