/**
 * TabletDrawerContent Component
 * Enhanced drawer content with Files and Tools tabs for tablet interface
 * Replit-identical design with E-Code branding
 */

import { useState } from 'react';
import { LazyMotionDiv, LazyMotionButton } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Wrench, 
  Bot, 
  Settings, 
  Terminal as TerminalIcon,
  Rocket,
  Code2,
  GitBranch,
  Package,
  Users,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileFileExplorer } from '@/components/mobile/MobileFileExplorer';
import { useReducedMotion, getReducedMotionTransition, SPRING_CONFIG } from '@/hooks/use-reduced-motion';

interface TabletDrawerContentProps {
  projectId: string | number; // Support both UUID strings and numeric IDs
  onFileSelect: (file: { id: number }) => void;
  onClose: () => void;
  // Tool action callbacks
  onOpenAIAgent?: () => void;
  onOpenDeploy?: () => void;
  onOpenGit?: () => void;
  onOpenTerminal?: () => void;
  onOpenPackages?: () => void;
  onOpenDebugger?: () => void;
  onOpenSettings?: () => void;
  onOpenCollaboration?: () => void;
  // Badge counts
  gitChangesCount?: number;
  errorsCount?: number;
}

type DrawerTab = 'files' | 'tools';

export function TabletDrawerContent({ 
  projectId, 
  onFileSelect,
  onClose,
  onOpenAIAgent,
  onOpenDeploy,
  onOpenGit,
  onOpenTerminal,
  onOpenPackages,
  onOpenDebugger,
  onOpenSettings,
  onOpenCollaboration,
  gitChangesCount = 0,
  errorsCount = 0
}: TabletDrawerContentProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('files');
  const prefersReducedMotion = useReducedMotion();

  const vibrate = () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  const handleTabSwitch = (tab: DrawerTab) => {
    setActiveTab(tab);
    vibrate();
  };

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-background)]">
      <div className="flex items-center border-b border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
        {(['files', 'tools'] as DrawerTab[]).map((tab) => (
          <LazyMotionButton
            key={tab}
            onClick={() => handleTabSwitch(tab)}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 h-14 touch-manipulation",
              "font-medium text-[13px] transition-colors",
              activeTab === tab 
                ? "text-[var(--ecode-accent)]" 
                : "text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)]"
            )}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            data-testid={`tab-drawer-${tab}`}
          >
            {tab === 'files' ? (
              <FileText className="h-5 w-5" />
            ) : (
              <Wrench className="h-5 w-5" />
            )}
            <span className="capitalize">{tab}</span>
            
            {activeTab === tab && (
              <LazyMotionDiv
                layoutId="tablet-drawer-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-[3px] bg-[var(--ecode-accent)] rounded-full"
                transition={getReducedMotionTransition(prefersReducedMotion, SPRING_CONFIG.default)}
                style={{
                  boxShadow: prefersReducedMotion ? 'none' : '0 0 8px 2px var(--ecode-accent)',
                }}
              />
            )}
          </LazyMotionButton>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' ? (
          <MobileFileExplorer
            isOpen={true}
            onClose={onClose}
            projectId={projectId}
            onFileSelect={onFileSelect}
          />
        ) : (
          <ToolsPanel
            onOpenAIAgent={onOpenAIAgent}
            onOpenDeploy={onOpenDeploy}
            onOpenGit={onOpenGit}
            onOpenTerminal={onOpenTerminal}
            onOpenPackages={onOpenPackages}
            onOpenDebugger={onOpenDebugger}
            onOpenSettings={onOpenSettings}
            onOpenCollaboration={onOpenCollaboration}
            gitChangesCount={gitChangesCount}
            errorsCount={errorsCount}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Tools Panel - Quick access to common IDE tools
 */
interface ToolsPanelProps {
  onOpenAIAgent?: () => void;
  onOpenDeploy?: () => void;
  onOpenGit?: () => void;
  onOpenTerminal?: () => void;
  onOpenPackages?: () => void;
  onOpenDebugger?: () => void;
  onOpenSettings?: () => void;
  onOpenCollaboration?: () => void;
  gitChangesCount?: number;
  errorsCount?: number;
}

function ToolsPanel({
  onOpenAIAgent,
  onOpenDeploy,
  onOpenGit,
  onOpenTerminal,
  onOpenPackages,
  onOpenDebugger,
  onOpenSettings,
  onOpenCollaboration,
  gitChangesCount = 0,
  errorsCount = 0
}: ToolsPanelProps) {
  const tools = [
    {
      id: 'ai-agent',
      name: 'AI Agent',
      icon: Bot,
      description: 'Chat with AI to generate code',
      action: onOpenAIAgent || (() => console.warn('AI Agent handler not provided')),
      badge: undefined as number | undefined,
    },
    {
      id: 'deploy',
      name: 'Deploy',
      icon: Rocket,
      description: 'Publish your application',
      action: onOpenDeploy || (() => console.warn('Deploy handler not provided')),
      badge: undefined as number | undefined,
    },
    {
      id: 'git',
      name: 'Source Control',
      icon: GitBranch,
      description: 'Manage version control',
      action: onOpenGit || (() => console.warn('Git handler not provided')),
      badge: gitChangesCount > 0 ? gitChangesCount : undefined,
    },
    {
      id: 'terminal',
      name: 'Terminal',
      icon: TerminalIcon,
      description: 'Run shell commands',
      action: onOpenTerminal || (() => console.warn('Terminal handler not provided')),
      badge: undefined as number | undefined,
    },
    {
      id: 'packages',
      name: 'Packages',
      icon: Package,
      description: 'Manage dependencies',
      action: onOpenPackages || (() => console.warn('Packages handler not provided')),
      badge: undefined as number | undefined,
    },
    {
      id: 'debugger',
      name: 'Problems',
      icon: AlertCircle,
      description: 'View errors and warnings',
      action: onOpenDebugger || (() => console.warn('Debugger handler not provided')),
      badge: errorsCount > 0 ? errorsCount : undefined,
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: Settings,
      description: 'Configure workspace',
      action: onOpenSettings || (() => console.warn('Settings handler not provided')),
      badge: undefined as number | undefined,
    },
    {
      id: 'collaboration',
      name: 'Collaborate',
      icon: Users,
      description: 'Invite others to code together',
      action: onOpenCollaboration || (() => console.warn('Collaboration handler not provided')),
      badge: undefined as number | undefined,
    },
  ];

  const vibrate = () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  const handleToolClick = (tool: typeof tools[0]) => {
    vibrate();
    tool.action();
  };

  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="p-3 space-y-1.5">
      <div className="px-2 py-2 text-[11px] font-semibold text-[var(--ecode-text-muted)] uppercase tracking-wider">
        Quick Access
      </div>
      
      {tools.map((tool, index) => {
        const Icon = tool.icon;
        return (
          <LazyMotionButton
            key={tool.id}
            onClick={() => handleToolClick(tool)}
            initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : index * 0.03 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg",
              "bg-transparent hover:bg-[var(--ecode-surface-hover)]",
              "transition-colors duration-150 touch-manipulation",
              "text-left min-h-[56px] group"
            )}
            data-testid={`tool-${tool.id}`}
          >
            <div className="flex-shrink-0 mt-0.5 relative">
              <div className="w-9 h-9 rounded-lg bg-[var(--ecode-surface)] flex items-center justify-center group-hover:bg-[var(--ecode-accent)]/10 transition-colors">
                <Icon className="h-4.5 w-4.5 text-[var(--ecode-text-muted)] group-hover:text-[var(--ecode-accent)] transition-colors" />
              </div>
              {tool.badge !== undefined && tool.badge > 0 && (
                <LazyMotionDiv 
                  initial={prefersReducedMotion ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-[var(--ecode-background)]"
                >
                  {tool.badge > 99 ? '99+' : tool.badge}
                </LazyMotionDiv>
              )}
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <div className="font-medium text-[13px] text-[var(--ecode-text)]">{tool.name}</div>
              <div className="text-[11px] text-[var(--ecode-text-muted)] mt-0.5 line-clamp-1">
                {tool.description}
              </div>
            </div>
          </LazyMotionButton>
        );
      })}
    </div>
  );
}
