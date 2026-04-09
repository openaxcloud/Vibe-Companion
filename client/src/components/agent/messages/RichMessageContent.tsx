/**
 * Rich Message Content - Markdown parsing with Replit-style formatting
 * Supports: Headers, bullets, bold, italic, code, emojis, tables, syntax highlighting
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LightSyntaxHighlighter, darkStyle } from '@/components/ui/LightSyntaxHighlighter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

interface RichMessageContentProps {
  content: string;
  className?: string;
}

export function RichMessageContent({ content, className }: RichMessageContentProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({ description: "Code copied to clipboard" });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadFile = useCallback((code: string, filename: string) => {
    const mimeMap: Record<string, string> = {
      csv: 'text/csv', json: 'application/json', html: 'text/html',
      css: 'text/css', js: 'application/javascript', ts: 'application/typescript',
      py: 'text/x-python', md: 'text/markdown', txt: 'text/plain',
      svg: 'image/svg+xml', xml: 'application/xml', yaml: 'text/yaml', yml: 'text/yaml',
      sql: 'application/sql', sh: 'text/x-shellscript',
    };
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
    const mime = mimeMap[ext] || 'text/plain';
    const blob = new Blob([code], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ description: `Downloaded ${filename}` });
  }, []);

  const cleanedContent = content
    .replace(/<!--\s*filename:\s*([^\s]+)\s*-->/g, '**`$1`**')
    .replace(/\/\/\s*filename:\s*([^\n]+)/g, '**`$1`**')
    .replace(/\/\*\s*filename:\s*([^\s*]+)\s*\*\//g, '**`$1`**');

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none break-words overflow-hidden min-w-0 w-full", className)} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-foreground mt-4 mb-2 flex items-center gap-2 flex-wrap min-w-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-bold text-foreground mt-3 mb-2 flex items-center gap-2 flex-wrap min-w-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-foreground mt-2 mb-1 flex items-center gap-2 flex-wrap min-w-0">
              {children}
            </h3>
          ),
          
          p: ({ children }) => (
            <p className="text-[13px] text-foreground leading-relaxed my-2 break-words" style={{ overflowWrap: 'anywhere' }}>
              {children}
            </p>
          ),
          
          ul: ({ children }) => (
            <ul className="list-none space-y-1 my-2 pl-0">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="text-[13px] text-foreground flex items-start gap-2 min-w-0">
              <span className="text-violet-500 mt-1 flex-shrink-0">•</span>
              <span className="flex-1 min-w-0 break-words" style={{ overflowWrap: 'anywhere' }}>{children}</span>
            </li>
          ),
          
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 text-[13px] text-foreground">
              {children}
            </ol>
          ),
          
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-muted-foreground">
              {children}
            </em>
          ),
          
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              const inlineText = String(children);
              const isLongEnough = inlineText.length > 3;
              return (
                <span className="inline-flex items-center gap-0.5 align-baseline max-w-full">
                  <code className="px-1.5 py-0.5 rounded bg-muted text-violet-500 font-mono text-[11px] break-all">
                    {children}
                  </code>
                  {isLongEnough && (
                    <button
                      onClick={(e) => { e.stopPropagation(); copyCode(inlineText); }}
                      className="inline-flex items-center justify-center h-[18px] w-[18px] rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/msg:opacity-100 focus:opacity-100"
                      title="Copy"
                      data-testid="copy-inline-code"
                    >
                      {copiedCode === inlineText ? (
                        <Check className="h-2.5 w-2.5 text-green-500" />
                      ) : (
                        <Copy className="h-2.5 w-2.5" />
                      )}
                    </button>
                  )}
                </span>
              );
            }
            
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            let codeString = String(children).replace(/\n$/, '');
            codeString = codeString.replace(/^\/\*\s*filename:\s*[^\n]*\*\/\s*\n?/, '').replace(/^\/\/\s*filename:\s*[^\n]*\n?/, '').replace(/^<!--\s*filename:\s*[^\n]*-->\s*\n?/, '');
            const isCopied = copiedCode === codeString;

            const extractedFilename = String(children).match(/^(?:\/\*\s*filename:\s*(\S+)\s*\*\/|\/\/\s*filename:\s*(\S+)|<!--\s*filename:\s*(\S+)\s*-->)/);
            const displayFilename = extractedFilename ? (extractedFilename[1] || extractedFilename[2] || extractedFilename[3]) : null;

            return (
              <div className="relative group my-3 max-w-full">
                <div className="flex items-center justify-between px-3 py-2 md:py-1.5 bg-[#1a1f2e] border border-[#2a3040] rounded-t-lg">
                  <div className="flex items-center gap-2">
                    {displayFilename && (
                      <span className="text-[11px] font-mono text-blue-400">
                        {displayFilename}
                      </span>
                    )}
                    {language && (
                      <span className="text-[11px] font-mono text-gray-500 uppercase">
                        {language}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {displayFilename && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => downloadFile(codeString, displayFilename)}
                        className="h-10 w-10 md:h-8 md:w-8 min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation text-gray-400 hover:text-white"
                        title={`Download ${displayFilename}`}
                        data-testid="download-file-button"
                      >
                        <Download className="h-4 w-4 md:h-3 md:w-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyCode(codeString)}
                      className="h-10 w-10 md:h-8 md:w-8 min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation text-gray-400 hover:text-white"
                      data-testid="copy-code-button"
                    >
                      {isCopied ? (
                        <Check className="h-4 w-4 md:h-3 md:w-3 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 md:h-3 md:w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="border border-t-0 border-[#2a3040] rounded-b-lg overflow-hidden max-w-full">
                  <div className="overflow-x-auto max-w-full">
                    <LightSyntaxHighlighter
                      language={language}
                      style={darkStyle}
                      customStyle={{
                        margin: 0,
                        padding: '12px',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        background: '#0e1525',
                        maxWidth: '100%',
                        overflowX: 'auto'
                      }}
                    >
                      {codeString}
                    </LightSyntaxHighlighter>
                  </div>
                </div>
              </div>
            );
          },
          
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-violet-500 pl-4 py-2 my-2 bg-violet-50 dark:bg-violet-950/10">
              <div className="text-[13px] text-muted-foreground">
                {children}
              </div>
            </blockquote>
          ),
          
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-border rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-foreground border-b border-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[13px] text-foreground border-b border-border">
              {children}
            </td>
          ),
          
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-500 hover:text-violet-600 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          
          hr: () => (
            <hr className="my-4 border-t border-border" />
          ),
        }}
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
}
