import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Square, 
  RotateCcw,
  Save,
  Download,
  Upload,
  Share2,
  Settings,
  Bug,
  Zap,
  Package,
  GitBranch,
  Terminal,
  Globe,
  Users,
  Star,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolbarAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'success' | 'destructive' | 'secondary';
  onClick?: () => void;
}

interface ReplitToolbarProps {
  isRunning?: boolean;
  projectName?: string;
  language?: string;
  visibility?: 'public' | 'private' | 'unlisted';
  isStarred?: boolean;
  collaborators?: number;
  onRun?: () => void;
  onStop?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  className?: string;
}

export function ReplitToolbar({
  isRunning = false,
  projectName = 'My Project',
  language = 'JavaScript',
  visibility = 'private',
  isStarred = false,
  collaborators = 0,
  onRun,
  onStop,
  onSave,
  onShare,
  className
}: ReplitToolbarProps) {
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Primary actions (left side)
  const primaryActions: ToolbarAction[] = [
    {
      id: 'run',
      icon: isRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />,
      label: isRunning ? 'Stop' : 'Run',
      shortcut: 'Ctrl+Enter',
      variant: isRunning ? 'destructive' : 'success',
      onClick: isRunning ? onStop : onRun
    },
    {
      id: 'restart',
      icon: <RotateCcw className="h-4 w-4" />,
      label: 'Restart',
      shortcut: 'Ctrl+Shift+R',
      disabled: !isRunning
    }
  ];

  // File actions
  const fileActions: ToolbarAction[] = [
    {
      id: 'save',
      icon: <Save className="h-4 w-4" />,
      label: 'Save',
      shortcut: 'Ctrl+S',
      onClick: onSave
    },
    {
      id: 'download',
      icon: <Download className="h-4 w-4" />,
      label: 'Download'
    },
    {
      id: 'upload',
      icon: <Upload className="h-4 w-4" />,
      label: 'Upload'
    }
  ];

  // Development tools
  const devActions: ToolbarAction[] = [
    {
      id: 'debug',
      icon: <Bug className="h-4 w-4" />,
      label: 'Debug',
      shortcut: 'F9'
    },
    {
      id: 'packages',
      icon: <Package className="h-4 w-4" />,
      label: 'Packages'
    },
    {
      id: 'git',
      icon: <GitBranch className="h-4 w-4" />,
      label: 'Version Control'
    },
    {
      id: 'terminal',
      icon: <Terminal className="h-4 w-4" />,
      label: 'Terminal',
      shortcut: 'Ctrl+`'
    }
  ];

  // View actions (right side)
  const viewActions: ToolbarAction[] = [
    {
      id: 'preview',
      icon: isPreviewVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />,
      label: isPreviewVisible ? 'Hide Preview' : 'Show Preview',
      active: isPreviewVisible,
      onClick: () => setIsPreviewVisible(!isPreviewVisible)
    },
    {
      id: 'fullscreen',
      icon: isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />,
      label: isFullscreen ? 'Exit Fullscreen' : 'Fullscreen',
      shortcut: 'F11',
      onClick: () => setIsFullscreen(!isFullscreen)
    }
  ];

  const ActionButton = ({ action }: { action: ToolbarAction }) => (
    <Button
      variant={action.active ? "secondary" : "ghost"}
      size="sm"
      className={cn(
        "h-8 px-2 text-[11px]",
        action.variant === 'success' && "hover:bg-green-500/10 hover:text-green-600",
        action.variant === 'destructive' && "hover:bg-red-500/10 hover:text-red-600",
        action.disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={action.onClick}
      disabled={action.disabled}
      title={`${action.label}${action.shortcut ? ` (${action.shortcut})` : ''}`}
    >
      {action.icon}
      <span className="ml-1 hidden sm:inline">{action.label}</span>
    </Button>
  );

  const getVisibilityIcon = () => {
    switch (visibility) {
      case 'public':
        return <Globe className="h-3 w-3 text-green-600" />;
      case 'unlisted':
        return <Eye className="h-3 w-3 text-orange-600" />;
      default:
        return <EyeOff className="h-3 w-3 text-gray-600" />;
    }
  };

  return (
    <div className={cn(
      "h-10 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] flex items-center justify-between px-3",
      className
    )}>
      {/* Left side - Primary actions and project info */}
      <div className="flex items-center gap-2">
        {/* Primary actions */}
        <div className="flex items-center gap-1">
          {primaryActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Project info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-medium text-[var(--ecode-text)] truncate max-w-[150px]">
                {projectName}
              </span>
              {isStarred && (
                <Star className="h-3 w-3 text-yellow-500 fill-current" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[11px]">
                {language}
              </Badge>
              {getVisibilityIcon()}
              {collaborators > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-[var(--ecode-text-secondary)]" />
                  <span className="text-[11px] text-[var(--ecode-text-secondary)]">
                    {collaborators}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* File actions */}
        <div className="flex items-center gap-1">
          {fileActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      </div>

      {/* Center - Running status */}
      {isRunning && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[11px] text-[var(--ecode-text-secondary)]">
              Running
            </span>
          </div>
        </div>
      )}

      {/* Right side - Development tools and view actions */}
      <div className="flex items-center gap-2">
        {/* Development tools */}
        <div className="flex items-center gap-1">
          {devActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* View actions */}
        <div className="flex items-center gap-1">
          {viewActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        {/* Share button */}
        <Button
          variant="default"
          size="sm"
          className="h-8 px-3 text-[11px] bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent)]/90"
          onClick={onShare}
        >
          <Share2 className="h-3 w-3 mr-1" />
          Share
        </Button>

        {/* More options */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="More options"
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}