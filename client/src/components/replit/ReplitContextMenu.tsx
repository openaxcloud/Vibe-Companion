// @ts-nocheck
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu';
import { 
  Copy,
  Scissors,
  FileText,
  Folder,
  FolderPlus,
  Trash2,
  Edit,
  Eye,
  Download,
  Share2,
  GitBranch,
  Terminal,
  Code,
  Settings,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Star,
  Archive,
  Files,
  RotateCw
} from 'lucide-react';

interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuAction[];
}

interface ReplitContextMenuProps {
  children: React.ReactNode;
  type: 'file' | 'folder' | 'editor' | 'terminal' | 'general';
  fileName?: string;
  isReadonly?: boolean;
  onAction?: (actionId: string, data?: any) => void;
}

export function ReplitContextMenu({
  children,
  type,
  fileName,
  isReadonly = false,
  onAction
}: ReplitContextMenuProps) {
  
  const getFileActions = (): ContextMenuAction[] => [
    {
      id: 'open',
      label: 'Open',
      icon: <Eye className="h-4 w-4" />,
      onClick: () => onAction?.('open', { fileName })
    },
    {
      id: 'open-in-new-tab',
      label: 'Open in New Tab',
      icon: <FileText className="h-4 w-4" />,
      onClick: () => onAction?.('open-in-new-tab', { fileName })
    },
    { id: 'sep1', label: '', icon: <></>, separator: true },
    {
      id: 'rename',
      label: 'Rename',
      icon: <Edit className="h-4 w-4" />,
      shortcut: 'F2',
      disabled: isReadonly,
      onClick: () => onAction?.('rename', { fileName })
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <Files className="h-4 w-4" />,
      shortcut: 'Ctrl+D',
      disabled: isReadonly,
      onClick: () => onAction?.('duplicate', { fileName })
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      shortcut: 'Del',
      disabled: isReadonly,
      onClick: () => onAction?.('delete', { fileName })
    },
    { id: 'sep2', label: '', icon: <></>, separator: true },
    {
      id: 'copy-path',
      label: 'Copy Path',
      icon: <Copy className="h-4 w-4" />,
      onClick: () => onAction?.('copy-path', { fileName })
    },
    {
      id: 'copy-relative-path',
      label: 'Copy Relative Path',
      icon: <Copy className="h-4 w-4" />,
      onClick: () => onAction?.('copy-relative-path', { fileName })
    },
    { id: 'sep3', label: '', icon: <></>, separator: true },
    {
      id: 'download',
      label: 'Download',
      icon: <Download className="h-4 w-4" />,
      onClick: () => onAction?.('download', { fileName })
    },
    {
      id: 'share',
      label: 'Share',
      icon: <Share2 className="h-4 w-4" />,
      onClick: () => onAction?.('share', { fileName })
    }
  ];

  const getFolderActions = (): ContextMenuAction[] => [
    {
      id: 'new-file',
      label: 'New File',
      icon: <FileText className="h-4 w-4" />,
      shortcut: 'Ctrl+N',
      disabled: isReadonly,
      onClick: () => onAction?.('new-file', { folder: fileName })
    },
    {
      id: 'new-folder',
      label: 'New Folder',
      icon: <FolderPlus className="h-4 w-4" />,
      shortcut: 'Ctrl+Shift+N',
      disabled: isReadonly,
      onClick: () => onAction?.('new-folder', { folder: fileName })
    },
    { id: 'sep1', label: '', icon: <></>, separator: true },
    {
      id: 'upload',
      label: 'Upload Files',
      icon: <ArrowUp className="h-4 w-4" />,
      disabled: isReadonly,
      onClick: () => onAction?.('upload', { folder: fileName })
    },
    { id: 'sep2', label: '', icon: <></>, separator: true },
    {
      id: 'rename',
      label: 'Rename',
      icon: <Edit className="h-4 w-4" />,
      shortcut: 'F2',
      disabled: isReadonly,
      onClick: () => onAction?.('rename', { folder: fileName })
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: <Files className="h-4 w-4" />,
      disabled: isReadonly,
      onClick: () => onAction?.('duplicate', { folder: fileName })
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      shortcut: 'Del',
      disabled: isReadonly,
      onClick: () => onAction?.('delete', { folder: fileName })
    },
    { id: 'sep3', label: '', icon: <></>, separator: true },
    {
      id: 'copy-path',
      label: 'Copy Path',
      icon: <Copy className="h-4 w-4" />,
      onClick: () => onAction?.('copy-path', { folder: fileName })
    },
    {
      id: 'download',
      label: 'Download as ZIP',
      icon: <Archive className="h-4 w-4" />,
      onClick: () => onAction?.('download-zip', { folder: fileName })
    }
  ];

  const getEditorActions = (): ContextMenuAction[] => [
    {
      id: 'cut',
      label: 'Cut',
      icon: <Scissors className="h-4 w-4" />,
      shortcut: 'Ctrl+X',
      disabled: isReadonly,
      onClick: () => onAction?.('cut')
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy className="h-4 w-4" />,
      shortcut: 'Ctrl+C',
      onClick: () => onAction?.('copy')
    },
    {
      id: 'paste',
      label: 'Paste',
      icon: <Copy className="h-4 w-4" />,
      shortcut: 'Ctrl+V',
      disabled: isReadonly,
      onClick: () => onAction?.('paste')
    },
    { id: 'sep1', label: '', icon: <></>, separator: true },
    {
      id: 'select-all',
      label: 'Select All',
      icon: <></>,
      shortcut: 'Ctrl+A',
      onClick: () => onAction?.('select-all')
    },
    { id: 'sep2', label: '', icon: <></>, separator: true },
    {
      id: 'find',
      label: 'Find',
      icon: <></>,
      shortcut: 'Ctrl+F',
      onClick: () => onAction?.('find')
    },
    {
      id: 'find-replace',
      label: 'Find and Replace',
      icon: <></>,
      shortcut: 'Ctrl+H',
      onClick: () => onAction?.('find-replace')
    },
    { id: 'sep3', label: '', icon: <></>, separator: true },
    {
      id: 'format',
      label: 'Format Document',
      icon: <Code className="h-4 w-4" />,
      shortcut: 'Shift+Alt+F',
      disabled: isReadonly,
      onClick: () => onAction?.('format')
    },
    {
      id: 'comment',
      label: 'Toggle Comment',
      icon: <></>,
      shortcut: 'Ctrl+/',
      disabled: isReadonly,
      onClick: () => onAction?.('toggle-comment')
    }
  ];

  const getTerminalActions = (): ContextMenuAction[] => [
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy className="h-4 w-4" />,
      shortcut: 'Ctrl+C',
      onClick: () => onAction?.('copy')
    },
    {
      id: 'paste',
      label: 'Paste',
      icon: <Paste className="h-4 w-4" />,
      shortcut: 'Ctrl+V',
      onClick: () => onAction?.('paste')
    },
    { id: 'sep1', label: '', icon: <></>, separator: true },
    {
      id: 'select-all',
      label: 'Select All',
      icon: <></>,
      shortcut: 'Ctrl+A',
      onClick: () => onAction?.('select-all')
    },
    { id: 'sep2', label: '', icon: <></>, separator: true },
    {
      id: 'clear',
      label: 'Clear Terminal',
      icon: <RefreshCw className="h-4 w-4" />,
      shortcut: 'Ctrl+L',
      onClick: () => onAction?.('clear')
    },
    {
      id: 'new-terminal',
      label: 'New Terminal',
      icon: <Terminal className="h-4 w-4" />,
      shortcut: 'Ctrl+Shift+`',
      onClick: () => onAction?.('new-terminal')
    }
  ];

  const getGeneralActions = (): ContextMenuAction[] => [
    {
      id: 'refresh',
      label: 'Refresh',
      icon: <RefreshCw className="h-4 w-4" />,
      shortcut: 'F5',
      onClick: () => onAction?.('refresh')
    },
    { id: 'sep1', label: '', icon: <></>, separator: true },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => onAction?.('settings')
    }
  ];

  const getActionsForType = (): ContextMenuAction[] => {
    switch (type) {
      case 'file':
        return getFileActions();
      case 'folder':
        return getFolderActions();
      case 'editor':
        return getEditorActions();
      case 'terminal':
        return getTerminalActions();
      case 'general':
        return getGeneralActions();
      default:
        return getGeneralActions();
    }
  };

  const actions = getActionsForType();

  const renderMenuItem = (action: ContextMenuAction) => {
    if (action.separator) {
      return <ContextMenuSeparator key={action.id} />;
    }

    if (action.submenu) {
      return (
        <ContextMenuSub key={action.id}>
          <ContextMenuSubTrigger disabled={action.disabled}>
            {action.icon}
            <span className="ml-2">{action.label}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {action.submenu.map(renderMenuItem)}
          </ContextMenuSubContent>
        </ContextMenuSub>
      );
    }

    return (
      <ContextMenuItem
        key={action.id}
        disabled={action.disabled}
        onClick={action.onClick}
      >
        {action.icon}
        <span className="ml-2">{action.label}</span>
        {action.shortcut && (
          <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>
        )}
      </ContextMenuItem>
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {actions.map(renderMenuItem)}
      </ContextMenuContent>
    </ContextMenu>
  );
}