import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, Clock, XCircle } from 'lucide-react';

export interface TimelineItem {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  content: React.ReactNode;
}

interface ExecutionTimelineProps {
  items: TimelineItem[];
  className?: string;
}

const DOT_CONFIG = {
  pending: {
    dot: 'bg-muted-foreground/40 border-muted-foreground/20',
    line: 'bg-muted-foreground/20',
    icon: Clock,
    iconClass: 'text-muted-foreground/60',
  },
  running: {
    dot: 'bg-blue-500 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.4)]',
    line: 'bg-blue-500/30',
    icon: Loader2,
    iconClass: 'text-blue-500 animate-spin',
  },
  complete: {
    dot: 'bg-emerald-500 border-emerald-400',
    line: 'bg-emerald-500/40',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
  },
  error: {
    dot: 'bg-red-500 border-red-400',
    line: 'bg-red-500/40',
    icon: XCircle,
    iconClass: 'text-red-500',
  },
} as const;

export function ExecutionTimeline({ items, className }: ExecutionTimelineProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className={cn('relative', className)} data-testid="execution-timeline">
      {items.map((item, index) => {
        const config = DOT_CONFIG[item.status] || DOT_CONFIG.pending;
        const isLast = index === items.length - 1;
        const StatusIcon = config.icon;

        return (
          <div key={item.id} className="relative flex gap-3" data-testid={`timeline-item-${item.id}`}>
            <div className="flex flex-col items-center flex-shrink-0 w-5">
              <div
                className={cn(
                  'w-3 h-3 rounded-full border-2 flex-shrink-0 z-10 mt-3.5 transition-all duration-300',
                  config.dot
                )}
              />
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[12px] transition-colors duration-500',
                    config.line
                  )}
                />
              )}
            </div>

            <div className="flex-1 min-w-0 pb-3">
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
