/**
 * Collapsible Section - Replit-style "Show more/less" accordion
 * Smooth animations and clean UX
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  previewLines?: number;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  previewLines,
  icon,
  badge,
  className
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("border border-[var(--ecode-border)] rounded-lg overflow-hidden", className)}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between px-3 py-3 md:py-2 h-auto min-h-[44px] hover:bg-[var(--ecode-surface)] touch-manipulation"
        data-testid="collapsible-trigger"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isOpen ? (
            <ChevronDown className="h-5 w-5 md:h-4 md:w-4 text-[var(--ecode-text-secondary)] flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 md:h-4 md:w-4 text-[var(--ecode-text-secondary)] flex-shrink-0" />
          )}
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <span className="text-[13px] font-medium text-[var(--ecode-text)] truncate">
            {title}
          </span>
        </div>
        {badge && <div className="flex-shrink-0">{badge}</div>}
      </Button>
      
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="p-3 border-t border-[var(--ecode-border)] bg-[var(--ecode-surface)]">
          {children}
        </div>
      </div>
    </div>
  );
}

interface CodeCollapsibleProps {
  code: string;
  language?: string;
  maxLines?: number;
}

export function CodeCollapsible({ code, language, maxLines = 10 }: CodeCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = code.split('\n');
  const shouldCollapse = lines.length > maxLines;
  const displayCode = isExpanded || !shouldCollapse
    ? code
    : lines.slice(0, maxLines).join('\n');

  return (
    <div className="relative">
      <pre className="p-3 bg-[#0e1525] border border-[#2a3040] rounded-lg overflow-x-auto">
        {language && (
          <div className="text-[11px] font-mono text-gray-500 mb-2 uppercase">
            {language}
          </div>
        )}
        <code className="text-[11px] font-mono text-gray-300">
          {displayCode}
        </code>
      </pre>
      
      {shouldCollapse && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-[11px] min-h-[44px] h-auto py-2 px-3 touch-manipulation"
          data-testid="code-collapsible-toggle"
        >
          {isExpanded ? (
            <>Show less</>
          ) : (
            <>Show {lines.length - maxLines} more lines</>
          )}
        </Button>
      )}
    </div>
  );
}
