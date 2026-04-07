import { useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  key: string;
  description: string;
  category: string;
  action: () => void;
}

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts?: Shortcut[];
  onSave?: () => void;
  onSearch?: () => void;
  onToggleTerminal?: () => void;
  onToggleAI?: () => void;
  onNewFile?: () => void;
  onRun?: () => void;
}

const DEFAULT_SHORTCUTS: Omit<Shortcut, 'action'>[] = [
  // File Operations
  { key: 'Cmd/Ctrl + S', description: 'Save current file', category: 'File' },
  { key: 'Cmd/Ctrl + Shift + S', description: 'Save all files', category: 'File' },
  { key: 'Cmd/Ctrl + N', description: 'New file', category: 'File' },
  { key: 'Cmd/Ctrl + O', description: 'Open file', category: 'File' },
  { key: 'Cmd/Ctrl + W', description: 'Close current tab', category: 'File' },
  
  // Editor
  { key: 'Cmd/Ctrl + F', description: 'Find in file', category: 'Editor' },
  { key: 'Cmd/Ctrl + H', description: 'Find and replace', category: 'Editor' },
  { key: 'Cmd/Ctrl + Shift + F', description: 'Find in project', category: 'Editor' },
  { key: 'Cmd/Ctrl + /', description: 'Toggle comment', category: 'Editor' },
  { key: 'Alt + Up/Down', description: 'Move line up/down', category: 'Editor' },
  { key: 'Cmd/Ctrl + D', description: 'Duplicate line', category: 'Editor' },
  
  // Navigation
  { key: 'Cmd/Ctrl + P', description: 'Quick open file', category: 'Navigation' },
  { key: 'Cmd/Ctrl + Shift + P', description: 'Command palette', category: 'Navigation' },
  { key: 'Cmd/Ctrl + B', description: 'Toggle sidebar', category: 'Navigation' },
  { key: 'Cmd/Ctrl + J', description: 'Toggle terminal', category: 'Navigation' },
  
  // Execution
  { key: 'Cmd/Ctrl + Enter', description: 'Run project', category: 'Execution' },
  { key: 'Cmd/Ctrl + Shift + Enter', description: 'Stop project', category: 'Execution' },
  { key: 'Cmd/Ctrl + R', description: 'Restart project', category: 'Execution' },
  
  // AI & Tools
  { key: 'Cmd/Ctrl + K', description: 'Open AI assistant', category: 'AI & Tools' },
  { key: 'Cmd/Ctrl + Shift + K', description: 'Generate code', category: 'AI & Tools' },
  { key: 'Cmd/Ctrl + G', description: 'Go to line', category: 'AI & Tools' },
];

export function KeyboardShortcuts({
  open,
  onOpenChange,
  shortcuts,
  onSave,
  onSearch,
  onToggleTerminal,
  onToggleAI,
  onNewFile,
  onRun,
}: KeyboardShortcutsProps) {
  const { toast } = useToast();

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    // Cmd/Ctrl + S - Save
    if (modKey && e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      onSave?.();
      toast({
        title: 'File Saved',
        description: 'Your changes have been saved',
      });
    }

    // Cmd/Ctrl + Shift + F - Search in project
    if (modKey && e.shiftKey && e.key === 'f') {
      e.preventDefault();
      onSearch?.();
    }

    // Cmd/Ctrl + J - Toggle terminal
    if (modKey && e.key === 'j') {
      e.preventDefault();
      onToggleTerminal?.();
    }

    // Cmd/Ctrl + K - Open AI
    if (modKey && e.key === 'k' && !e.shiftKey) {
      e.preventDefault();
      onToggleAI?.();
    }

    // Cmd/Ctrl + N - New file
    if (modKey && e.key === 'n') {
      e.preventDefault();
      onNewFile?.();
    }

    // Cmd/Ctrl + Enter - Run project
    if (modKey && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
    }

    // Cmd/Ctrl + ? - Show shortcuts
    if (modKey && e.key === '?') {
      e.preventDefault();
      onOpenChange(true);
    }
  }, [onSave, onSearch, onToggleTerminal, onToggleAI, onNewFile, onRun, onOpenChange, toast]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const groupedShortcuts = DEFAULT_SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof DEFAULT_SHORTCUTS>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and control the editor more efficiently
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="font-semibold text-[13px] mb-3">{category}</h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                    >
                      <span className="text-[13px]">{shortcut.description}</span>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {shortcut.key}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <p className="text-[11px] text-muted-foreground text-center">
            Press <Badge variant="outline" className="text-[11px]">Cmd/Ctrl + ?</Badge> to show this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}