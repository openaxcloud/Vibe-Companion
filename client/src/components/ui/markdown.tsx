import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <ReactMarkdown
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              language={match[1]}
              style={vscDarkPlus}
              customStyle={{ margin: '1em 0', borderRadius: '0.375rem' }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={cn("bg-muted px-1 py-0.5 rounded text-sm", className)} {...props}>
              {children}
            </code>
          );
        },
        // Style table elements
        table({ children }) {
          return (
            <div className="my-4 w-full overflow-auto">
              <table className="border-collapse border border-border w-full">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-muted">{children}</thead>;
        },
        th({ children }) {
          return <th className="border border-border px-4 py-2 text-left">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-border px-4 py-2">{children}</td>;
        },
        // Style list elements
        ul({ children }) {
          return <ul className="list-disc pl-6 my-2">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-6 my-2">{children}</ol>;
        },
        // Style headings
        h1({ children }) {
          return <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>;
        },
        // Style paragraph and links
        p({ children }) {
          return <p className="my-2">{children}</p>;
        },
        a({ children, href }) {
          return (
            <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        // Style blockquote
        blockquote({ children }) {
          return <blockquote className="border-l-4 border-primary/20 pl-4 italic my-4">{children}</blockquote>;
        },
        // Style inline elements
        strong({ children }) {
          return <strong className="font-bold">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic">{children}</em>;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}