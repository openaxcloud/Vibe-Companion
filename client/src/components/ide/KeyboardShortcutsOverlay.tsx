import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Command } from 'lucide-react';

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsOverlay({
  open,
  onOpenChange
}: KeyboardShortcutsOverlayProps) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';
  
  const shortcuts = [
    {
      category: 'General',
      items: [
        { keys: [`${modKey}`, 'K'], description: 'Open Command Palette' },
        { keys: [`${modKey}`, 'P'], description: 'Quick File Search' },
        { keys: [`${modKey}`, 'B'], description: 'Toggle File Explorer' },
        { keys: [`${modKey}`, '/'], description: 'Show Keyboard Shortcuts' },
      ]
    },
    {
      category: 'Editor',
      items: [
        { keys: [`${modKey}`, 'S'], description: 'Save File' },
        { keys: [`${modKey}`, 'W'], description: 'Close Tab' },
        { keys: [`${modKey}`, 'Enter'], description: 'Run/Stop Project' },
        { keys: ['Ctrl', '`'], description: 'Open Terminal' },
      ]
    },
    {
      category: 'Navigation',
      items: [
        { keys: [`${modKey}`, '1-9'], description: 'Switch to Tab 1-9' },
        { keys: [`${modKey}`, 'Shift', 'F'], description: 'Find in Files' },
        { keys: [`${modKey}`, 'G'], description: 'Go to Line' },
      ]
    },
    {
      category: 'AI Agent',
      items: [
        { keys: [`${modKey}`, 'L'], description: 'Focus AI Chat' },
        { keys: [`${modKey}`, 'Shift', 'A'], description: 'New AI Conversation' },
      ]
    }
  ];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate the IDE faster
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h3 className="font-semibold mb-3">{category.category}</h3>
              <div className="space-y-2">
                {category.items.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-[13px]">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1">
                          <Badge variant="secondary" className="font-mono text-[11px]">
                            {key}
                          </Badge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
