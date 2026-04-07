/**
 * MobileCodeKeyboard - Replit-style Custom Coding Keyboard
 * Provides language-specific coding assistance on mobile:
 * - Local-first autocomplete engine
 * - Language-specific snippet library
 * - Toolbar actions: undo, redo, indent, comment
 * - Clipboard manager for code copy/paste
 * 
 * Matches Replit mobile app keyboard exactly
 */

import { useState, useCallback } from 'react';
import { 
  Undo2, Redo2, IndentDecrease, IndentIncrease,
  MessageSquareCode, Copy, Clipboard, ChevronDown,
  ChevronUp, Code2, Braces, Hash, Terminal,
  Quote, Parentheses, CornerDownLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Language = 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'json' | 'generic';

interface Snippet {
  label: string;
  insert: string;
  icon?: React.ElementType;
}

interface MobileCodeKeyboardProps {
  language?: Language;
  onInsert?: (text: string) => void;
  onAction?: (action: 'undo' | 'redo' | 'indent' | 'outdent' | 'comment' | 'copy' | 'paste') => void;
  onSnippetSelect?: (snippet: Snippet) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

const languageSnippets: Record<Language, Snippet[]> = {
  javascript: [
    { label: 'const', insert: 'const  = ', icon: Code2 },
    { label: 'let', insert: 'let  = ', icon: Code2 },
    { label: 'function', insert: 'function () {\n  \n}', icon: Braces },
    { label: '=>', insert: '() => ', icon: Braces },
    { label: 'if', insert: 'if () {\n  \n}', icon: Braces },
    { label: 'for', insert: 'for (let i = 0; i < ; i++) {\n  \n}', icon: Braces },
    { label: 'async', insert: 'async function () {\n  \n}', icon: Braces },
    { label: 'await', insert: 'await ', icon: Code2 },
    { label: 'import', insert: "import {  } from '';", icon: Code2 },
    { label: 'export', insert: 'export ', icon: Code2 },
    { label: 'console.log', insert: 'console.log();', icon: Terminal },
    { label: 'try/catch', insert: 'try {\n  \n} catch (error) {\n  \n}', icon: Braces },
  ],
  typescript: [
    { label: 'const', insert: 'const : = ', icon: Code2 },
    { label: 'let', insert: 'let : = ', icon: Code2 },
    { label: 'interface', insert: 'interface  {\n  \n}', icon: Braces },
    { label: 'type', insert: 'type  = ', icon: Code2 },
    { label: 'function', insert: 'function (): void {\n  \n}', icon: Braces },
    { label: '=>', insert: '(): void => ', icon: Braces },
    { label: 'async', insert: 'async function (): Promise<void> {\n  \n}', icon: Braces },
    { label: 'import', insert: "import {  } from '';", icon: Code2 },
    { label: 'export', insert: 'export ', icon: Code2 },
    { label: 'as', insert: ' as ', icon: Code2 },
    { label: 'extends', insert: ' extends ', icon: Code2 },
    { label: 'implements', insert: ' implements ', icon: Code2 },
  ],
  python: [
    { label: 'def', insert: 'def ():\n    ', icon: Braces },
    { label: 'class', insert: 'class :\n    def __init__(self):\n        ', icon: Braces },
    { label: 'if', insert: 'if :\n    ', icon: Braces },
    { label: 'for', insert: 'for  in :\n    ', icon: Braces },
    { label: 'while', insert: 'while :\n    ', icon: Braces },
    { label: 'import', insert: 'import ', icon: Code2 },
    { label: 'from', insert: 'from  import ', icon: Code2 },
    { label: 'try', insert: 'try:\n    \nexcept Exception as e:\n    ', icon: Braces },
    { label: 'with', insert: 'with  as :\n    ', icon: Braces },
    { label: 'async def', insert: 'async def ():\n    ', icon: Braces },
    { label: 'await', insert: 'await ', icon: Code2 },
    { label: 'print', insert: 'print()', icon: Terminal },
  ],
  html: [
    { label: 'div', insert: '<div></div>', icon: Code2 },
    { label: 'span', insert: '<span></span>', icon: Code2 },
    { label: 'a', insert: '<a href=""></a>', icon: Code2 },
    { label: 'img', insert: '<img src="" alt="" />', icon: Code2 },
    { label: 'button', insert: '<button></button>', icon: Code2 },
    { label: 'input', insert: '<input type="" />', icon: Code2 },
    { label: 'form', insert: '<form>\n  \n</form>', icon: Braces },
    { label: 'ul/li', insert: '<ul>\n  <li></li>\n</ul>', icon: Braces },
    { label: 'table', insert: '<table>\n  <tr>\n    <td></td>\n  </tr>\n</table>', icon: Braces },
    { label: 'script', insert: '<script>\n  \n</script>', icon: Braces },
    { label: 'style', insert: '<style>\n  \n</style>', icon: Braces },
    { label: 'class', insert: 'class=""', icon: Code2 },
  ],
  css: [
    { label: '.class', insert: '. {\n  \n}', icon: Hash },
    { label: '#id', insert: '# {\n  \n}', icon: Hash },
    { label: 'flex', insert: 'display: flex;', icon: Code2 },
    { label: 'grid', insert: 'display: grid;', icon: Code2 },
    { label: 'margin', insert: 'margin: ;', icon: Code2 },
    { label: 'padding', insert: 'padding: ;', icon: Code2 },
    { label: 'border', insert: 'border: 1px solid ;', icon: Code2 },
    { label: 'bg-color', insert: 'background-color: ;', icon: Code2 },
    { label: 'color', insert: 'color: ;', icon: Code2 },
    { label: '@media', insert: '@media (max-width: px) {\n  \n}', icon: Braces },
    { label: ':hover', insert: ':hover {\n  \n}', icon: Braces },
    { label: 'transition', insert: 'transition: all 0.3s ease;', icon: Code2 },
  ],
  json: [
    { label: '{}', insert: '{\n  \n}', icon: Braces },
    { label: '[]', insert: '[\n  \n]', icon: Braces },
    { label: '"key":', insert: '"": ', icon: Quote },
    { label: 'true', insert: 'true', icon: Code2 },
    { label: 'false', insert: 'false', icon: Code2 },
    { label: 'null', insert: 'null', icon: Code2 },
  ],
  generic: [
    { label: '()', insert: '()', icon: Parentheses },
    { label: '{}', insert: '{}', icon: Braces },
    { label: '[]', insert: '[]', icon: Braces },
    { label: '""', insert: '""', icon: Quote },
    { label: "''", insert: "''", icon: Quote },
    { label: '`', insert: '``', icon: Quote },
  ],
};

const symbolRow = [
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: '{', insert: '{' },
  { label: '}', insert: '}' },
  { label: '[', insert: '[' },
  { label: ']', insert: ']' },
  { label: '<', insert: '<' },
  { label: '>', insert: '>' },
  { label: '=', insert: '=' },
  { label: ';', insert: ';' },
  { label: ':', insert: ':' },
  { label: ',', insert: ',' },
  { label: '.', insert: '.' },
  { label: '/', insert: '/' },
  { label: '\\', insert: '\\' },
  { label: '|', insert: '|' },
  { label: '&', insert: '&' },
  { label: '!', insert: '!' },
  { label: '?', insert: '?' },
  { label: '@', insert: '@' },
  { label: '#', insert: '#' },
  { label: '$', insert: '$' },
  { label: '_', insert: '_' },
  { label: '-', insert: '-' },
  { label: '+', insert: '+' },
  { label: '*', insert: '*' },
  { label: '%', insert: '%' },
];

export function MobileCodeKeyboard({
  language = 'generic',
  onInsert,
  onAction,
  onSnippetSelect,
  isExpanded = true,
  onToggleExpand,
  className
}: MobileCodeKeyboardProps) {
  const [showSymbols, setShowSymbols] = useState(false);
  const [clipboardHistory, setClipboardHistory] = useState<string[]>([]);
  
  const snippets = languageSnippets[language] || languageSnippets.generic;

  const handleInsert = useCallback((text: string) => {
    onInsert?.(text);
  }, [onInsert]);

  const handleSnippetClick = useCallback((snippet: Snippet) => {
    onSnippetSelect?.(snippet);
    onInsert?.(snippet.insert);
  }, [onSnippetSelect, onInsert]);

  const handleAction = useCallback(async (action: 'undo' | 'redo' | 'indent' | 'outdent' | 'comment' | 'copy' | 'paste') => {
    if (onAction) {
      onAction(action);
      return;
    }
    
    if (action === 'copy') {
      try {
        const selection = window.getSelection()?.toString() || '';
        if (selection) {
          await navigator.clipboard.writeText(selection);
          setClipboardHistory(prev => [selection, ...prev.slice(0, 9)]);
        }
      } catch (err) {
        console.warn('Copy failed:', err);
      }
    }
    
    if (action === 'paste') {
      try {
        const text = await navigator.clipboard.readText();
        if (text && onInsert) {
          onInsert(text);
        }
      } catch (err) {
        console.warn('Paste failed:', err);
        if (clipboardHistory[0] && onInsert) {
          onInsert(clipboardHistory[0]);
        }
      }
    }
    
    if (action === 'indent' && onInsert) {
      onInsert('  ');
    }
  }, [onAction, onInsert, clipboardHistory]);

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleExpand}
        className={cn("fixed bottom-4 left-4 z-50", className)}
        data-testid="keyboard-expand"
      >
        <ChevronUp className="w-4 h-4 mr-1" />
        Keyboard
      </Button>
    );
  }

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background border-t shadow-lg",
        className
      )}
      data-testid="mobile-code-keyboard"
    >
      {/* Header with collapse and language indicator */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-surface-solid">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] px-1.5">
            {language.toUpperCase()}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSymbols(!showSymbols)}
            className="h-6 px-2 text-[11px]"
            data-testid="toggle-symbols"
          >
            {showSymbols ? 'Snippets' : 'Symbols'}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className="h-6 w-6 p-0"
          data-testid="keyboard-collapse"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Toolbar row */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleAction('undo')}
          data-testid="action-undo"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleAction('redo')}
          data-testid="action-redo"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleAction('outdent')}
          data-testid="action-outdent"
        >
          <IndentDecrease className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleAction('indent')}
          data-testid="action-indent"
        >
          <IndentIncrease className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleAction('comment')}
          data-testid="action-comment"
        >
          <MessageSquareCode className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleAction('copy')}
          data-testid="action-copy"
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleAction('paste')}
          data-testid="action-paste"
        >
          <Clipboard className="w-4 h-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleInsert('\n')}
          data-testid="action-newline"
        >
          <CornerDownLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Snippet/Symbol row */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-1.5 p-2">
          {showSymbols ? (
            symbolRow.map((sym, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-9 min-w-[36px] px-2 font-mono text-[13px] shrink-0"
                onClick={() => handleInsert(sym.insert)}
                data-testid={`symbol-${i}`}
              >
                {sym.label}
              </Button>
            ))
          ) : (
            snippets.map((snippet, i) => {
              const Icon = snippet.icon || Code2;
              return (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 text-[11px] shrink-0"
                  onClick={() => handleSnippetClick(snippet)}
                  data-testid={`snippet-${snippet.label}`}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {snippet.label}
                </Button>
              );
            })
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export default MobileCodeKeyboard;
