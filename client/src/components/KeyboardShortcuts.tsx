import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutGroup {
  name: string;
  shortcuts: {
    description: string;
    keys: string[];
  }[];
}

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  // Match Replit's actual keyboard shortcuts
  const shortcutGroups: ShortcutGroup[] = [
    {
      name: 'General',
      shortcuts: [
        { description: 'Command palette', keys: ['Ctrl', 'K'] },
        { description: 'Toggle sidebar', keys: ['Ctrl', 'B'] },
        { description: 'Save file', keys: ['Ctrl', 'S'] },
        { description: 'Save all files', keys: ['Ctrl', 'Shift', 'S'] },
        { description: 'Toggle Terminal', keys: ['Ctrl', '`'] },
        { description: 'New file', keys: ['Alt', 'N'] },
        { description: 'Close tab', keys: ['Ctrl', 'W'] },
      ]
    },
    {
      name: 'Editing',
      shortcuts: [
        { description: 'Cut', keys: ['Ctrl', 'X'] },
        { description: 'Copy', keys: ['Ctrl', 'C'] },
        { description: 'Paste', keys: ['Ctrl', 'V'] },
        { description: 'Undo', keys: ['Ctrl', 'Z'] },
        { description: 'Redo', keys: ['Ctrl', 'Y'] },
        { description: 'Find', keys: ['Ctrl', 'F'] },
        { description: 'Find & Replace', keys: ['Ctrl', 'H'] },
        { description: 'Select all', keys: ['Ctrl', 'A'] },
        { description: 'Duplicate line', keys: ['Shift', 'Alt', 'Down'] },
        { description: 'Delete line', keys: ['Ctrl', 'Shift', 'K'] },
        { description: 'Move line up', keys: ['Alt', 'Up'] },
        { description: 'Move line down', keys: ['Alt', 'Down'] },
        { description: 'Indent', keys: ['Tab'] },
        { description: 'Outdent', keys: ['Shift', 'Tab'] },
        { description: 'Comment line', keys: ['Ctrl', '/'] },
      ]
    },
    {
      name: 'Navigation',
      shortcuts: [
        { description: 'Go to line', keys: ['Ctrl', 'G'] },
        { description: 'Go to file', keys: ['Ctrl', 'P'] },
        { description: 'Next tab', keys: ['Ctrl', 'Tab'] },
        { description: 'Previous tab', keys: ['Ctrl', 'Shift', 'Tab'] },
        { description: 'Go to definition', keys: ['F12'] },
        { description: 'Go back', keys: ['Alt', 'Left'] },
        { description: 'Go forward', keys: ['Alt', 'Right'] },
      ]
    },
    {
      name: 'Run & Debug',
      shortcuts: [
        { description: 'Run', keys: ['Ctrl', 'Enter'] },
        { description: 'Stop', keys: ['Ctrl', 'F2'] },
        { description: 'Debug', keys: ['F5'] },
        { description: 'Toggle breakpoint', keys: ['F9'] },
        { description: 'Step over', keys: ['F10'] },
        { description: 'Step into', keys: ['F11'] },
        { description: 'Step out', keys: ['Shift', 'F11'] },
      ]
    },
    {
      name: 'Multiplayer',
      shortcuts: [
        { description: 'Focus chat', keys: ['Ctrl', 'Shift', 'C'] },
        { description: 'Toggle users panel', keys: ['Ctrl', 'Shift', 'U'] },
        { description: 'Invite others', keys: ['Ctrl', 'Shift', 'I'] },
      ]
    }
  ];
  
  // Helper to render a keyboard key with appropriate styling
  const KeyCap = ({ children }: { children: React.ReactNode }) => (
    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">
      {children}
    </kbd>
  );
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Boost your productivity with these keyboard shortcuts.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[450px] pr-4">
          <div className="space-y-6">
            {shortcutGroups.map((group, groupIndex) => (
              <div key={group.name}>
                {groupIndex > 0 && <Separator className="my-4" />}
                <h3 className="text-sm font-semibold mb-3">{group.name}</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                  {group.shortcuts.map((shortcut) => (
                    <div key={shortcut.description} className="flex justify-between items-center">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex space-x-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={key}>
                            <KeyCap>{key}</KeyCap>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-gray-500 mx-0.5">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}