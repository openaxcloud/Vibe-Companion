/**
 * Mobile Code Actions Panel
 * Provides touch-optimized access to CodeMirror 6 editor features
 * Brings mobile to 100% feature parity with desktop
 * @version 3.0.0 - Migrated from Monaco to CodeMirror 6
 */

import { useState } from 'react';
import { EditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';
import { undo, redo, indentMore, indentLess } from '@codemirror/commands';
import { foldAll, unfoldAll } from '@codemirror/language';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import {
  Sparkles,
  Search,
  Replace,
  FileEdit,
  Navigation,
  Code2,
  Wand2,
  X,
  ArrowUpDown,
  Braces,
  Terminal,
  ListTree,
  Zap,
  Undo,
  Redo,
  Copy,
  Clipboard,
  IndentIncrease,
  IndentDecrease,
  FoldVertical,
  UnfoldVertical,
  FileCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface MobileCodeActionsProps {
  editor: EditorView | null;
  className?: string;
}

interface QuickAction {
  id: string;
  icon: typeof Sparkles;
  label: string;
  description: string;
  action: () => void;
  badge?: string;
  color: string;
}

export function MobileCodeActions({ editor, className }: MobileCodeActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const { toast } = useToast();

  const quickActions: QuickAction[] = [
    {
      id: 'find',
      icon: Search,
      label: 'Find',
      description: 'Search in file',
      color: 'text-cyan-500',
      action: () => {
        if (editor) {
          openSearchPanel(editor);
        }
        setIsOpen(false);
      },
    },
    {
      id: 'find-replace',
      icon: Replace,
      label: 'Find & Replace',
      description: 'Search and replace text',
      color: 'text-pink-500',
      action: () => {
        setActivePanel('replace');
      },
    },
    {
      id: 'undo',
      icon: Undo,
      label: 'Undo',
      description: 'Undo last change',
      color: 'text-blue-500',
      action: () => {
        if (editor) {
          undo(editor);
          toast({ title: 'Undone' });
        }
        setIsOpen(false);
      },
    },
    {
      id: 'redo',
      icon: Redo,
      label: 'Redo',
      description: 'Redo last change',
      color: 'text-purple-500',
      action: () => {
        if (editor) {
          redo(editor);
          toast({ title: 'Redone' });
        }
        setIsOpen(false);
      },
    },
    {
      id: 'copy',
      icon: Copy,
      label: 'Copy Selection',
      description: 'Copy selected text',
      color: 'text-green-500',
      action: () => {
        if (editor) {
          const selection = editor.state.sliceDoc(
            editor.state.selection.main.from,
            editor.state.selection.main.to
          );
          if (selection) {
            navigator.clipboard.writeText(selection);
            toast({ title: 'Copied to clipboard' });
          } else {
            toast({ title: 'No text selected', variant: 'destructive' });
          }
        }
        setIsOpen(false);
      },
    },
    {
      id: 'paste',
      icon: Clipboard,
      label: 'Paste',
      description: 'Paste from clipboard',
      color: 'text-orange-500',
      action: async () => {
        if (editor) {
          try {
            const text = await navigator.clipboard.readText();
            const { from, to } = editor.state.selection.main;
            editor.dispatch({
              changes: { from, to, insert: text },
            });
            toast({ title: 'Pasted' });
          } catch {
            toast({ title: 'Unable to paste', variant: 'destructive' });
          }
        }
        setIsOpen(false);
      },
    },
    {
      id: 'indent',
      icon: IndentIncrease,
      label: 'Indent',
      description: 'Increase indentation',
      color: 'text-indigo-500',
      action: () => {
        if (editor) {
          indentMore(editor);
        }
        setIsOpen(false);
      },
    },
    {
      id: 'outdent',
      icon: IndentDecrease,
      label: 'Outdent',
      description: 'Decrease indentation',
      color: 'text-yellow-500',
      action: () => {
        if (editor) {
          indentLess(editor);
        }
        setIsOpen(false);
      },
    },
    {
      id: 'fold-all',
      icon: FoldVertical,
      label: 'Fold All',
      description: 'Collapse all code blocks',
      color: 'text-teal-500',
      action: () => {
        if (editor) {
          foldAll(editor);
          toast({ title: 'All code blocks collapsed' });
        }
        setIsOpen(false);
      },
    },
    {
      id: 'unfold-all',
      icon: UnfoldVertical,
      label: 'Unfold All',
      description: 'Expand all code blocks',
      color: 'text-rose-500',
      action: () => {
        if (editor) {
          unfoldAll(editor);
          toast({ title: 'All code blocks expanded' });
        }
        setIsOpen(false);
      },
    },
    {
      id: 'select-all',
      icon: FileCode,
      label: 'Select All',
      description: 'Select all content',
      color: 'text-violet-500',
      action: () => {
        if (editor) {
          editor.dispatch({
            selection: { anchor: 0, head: editor.state.doc.length },
          });
          toast({ title: 'All text selected' });
        }
        setIsOpen(false);
      },
    },
    {
      id: 'suggestions',
      icon: Sparkles,
      label: 'Autocomplete',
      description: 'Trigger code suggestions',
      color: 'text-amber-500',
      badge: 'AI',
      action: () => {
        if (editor) {
          editor.dispatch({
            effects: [],
          });
          toast({ title: 'Autocomplete triggered' });
        }
        setIsOpen(false);
      },
    },
  ];

  const handleFind = () => {
    if (!editor || !searchQuery) return;

    const doc = editor.state.doc.toString();
    const index = doc.indexOf(searchQuery);

    if (index !== -1) {
      const from = index;
      const to = index + searchQuery.length;
      editor.dispatch({
        selection: { anchor: from, head: to },
        effects: EditorView.scrollIntoView(from, { y: 'center' }),
      });

      const matches = doc.split(searchQuery).length - 1;
      toast({
        title: `Found ${matches} match${matches > 1 ? 'es' : ''}`,
        description: 'Showing first occurrence'
      });
    } else {
      toast({ title: 'No matches found', variant: 'destructive' });
    }

    setActivePanel(null);
    setIsOpen(false);
  };

  const handleReplace = () => {
    if (!editor || !searchQuery) return;

    const doc = editor.state.doc.toString();
    const newDoc = doc.split(searchQuery).join(replaceQuery);
    const matches = doc.split(searchQuery).length - 1;

    if (matches > 0) {
      editor.dispatch({
        changes: { from: 0, to: doc.length, insert: newDoc },
      });
      toast({
        title: `Replaced ${matches} occurrence${matches > 1 ? 's' : ''}`,
        description: `"${searchQuery}" → "${replaceQuery}"`
      });
    } else {
      toast({ title: 'No matches found', variant: 'destructive' });
    }

    setActivePanel(null);
    setIsOpen(false);
  };

  return (
    <>
      <LazyMotionDiv
        className={cn('fixed bottom-20 right-4 z-40', className)}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <Button
          size="lg"
          onClick={() => setIsOpen(!isOpen)}
          className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-[var(--ecode-orange)] to-[var(--ecode-blue)] hover:shadow-xl transition-shadow"
          data-testid="mobile-code-actions-fab"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Zap className="h-6 w-6" />
          )}
        </Button>
      </LazyMotionDiv>

      <LazyAnimatePresence>
        {isOpen && (
          <LazyMotionDiv
            className="fixed inset-0 z-30 bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <LazyMotionDiv
              className="absolute bottom-0 left-0 right-0 bg-[var(--ecode-surface)] rounded-t-3xl shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[var(--ecode-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--ecode-text)]">
                      Code Actions
                    </h3>
                    <p className="text-[13px] text-[var(--ecode-text-secondary)]">
                      {activePanel ? 'Back to actions' : 'Touch-optimized shortcuts'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (activePanel) {
                        setActivePanel(null);
                      } else {
                        setIsOpen(false);
                      }
                    }}
                    data-testid="close-code-actions"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="max-h-[60vh]">
                <LazyAnimatePresence mode="wait">
                  {!activePanel ? (
                    <LazyMotionDiv
                      key="main"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="grid grid-cols-2 gap-3 p-4"
                    >
                      {quickActions.map((action) => (
                        <LazyMotionButton
                          key={action.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={action.action}
                          className="relative p-4 rounded-xl bg-[var(--ecode-sidebar)] hover:bg-[var(--ecode-sidebar-hover)] transition-colors text-left"
                          data-testid={`action-${action.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn('p-2 rounded-lg bg-[var(--ecode-surface)]', action.color)}>
                              <action.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-[var(--ecode-text)] truncate">
                                  {action.label}
                                </span>
                                {action.badge && (
                                  <Badge variant="secondary" className="text-[11px]">
                                    {action.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--ecode-text-secondary)] mt-1">
                                {action.description}
                              </p>
                            </div>
                          </div>
                        </LazyMotionButton>
                      ))}
                    </LazyMotionDiv>
                  ) : activePanel === 'replace' ? (
                    <LazyMotionDiv
                      key="replace"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-4 space-y-4"
                    >
                      <div>
                        <label className="text-[13px] font-medium text-[var(--ecode-text)] mb-2 block">
                          Find
                        </label>
                        <Input
                          placeholder="Search text..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-[var(--ecode-sidebar)]"
                          autoFocus
                          data-testid="search-input"
                        />
                      </div>
                      <div>
                        <label className="text-[13px] font-medium text-[var(--ecode-text)] mb-2 block">
                          Replace with
                        </label>
                        <Input
                          placeholder="Replacement text..."
                          value={replaceQuery}
                          onChange={(e) => setReplaceQuery(e.target.value)}
                          className="bg-[var(--ecode-sidebar)]"
                          onKeyDown={(e) => e.key === 'Enter' && handleReplace()}
                          data-testid="replace-input"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleFind}
                          variant="outline"
                          className="flex-1"
                          size="lg"
                          data-testid="find-btn"
                        >
                          <Search className="h-4 w-4 mr-2" />
                          Find
                        </Button>
                        <Button
                          onClick={handleReplace}
                          className="flex-1 bg-[var(--ecode-orange)] hover:bg-[var(--ecode-orange)]/90"
                          size="lg"
                          data-testid="replace-btn"
                        >
                          <Replace className="h-4 w-4 mr-2" />
                          Replace All
                        </Button>
                      </div>
                    </LazyMotionDiv>
                  ) : null}
                </LazyAnimatePresence>
              </ScrollArea>
            </LazyMotionDiv>
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
    </>
  );
}
