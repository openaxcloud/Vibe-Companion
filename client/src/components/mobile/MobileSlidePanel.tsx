import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface MobileSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileSlidePanel({ 
  isOpen, 
  onClose, 
  title, 
  children,
  className 
}: MobileSlidePanelProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!isOpen) return null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-background z-50 animate-fade-in",
          prefersReducedMotion && "animation-duration-0"
        )}
        onClick={onClose}
        data-testid="mobile-slide-panel-backdrop"
      />
      
      <div
        className={cn(
          'fixed inset-y-0 right-0 w-full max-w-md bg-background dark:bg-[var(--ecode-background)] z-50 flex flex-col shadow-2xl',
          prefersReducedMotion ? 'animate-fade-in' : 'animate-slide-from-right',
          className
        )}
        data-testid="mobile-slide-panel"
      >
        <div 
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b border-border animate-fade-in",
            !prefersReducedMotion && "animate-stagger-1"
          )}
        >
          <h2 className="font-semibold text-foreground text-[15px]" data-testid="mobile-slide-panel-title">
            {title}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 w-10 p-0 hover:bg-muted touch-manipulation active:scale-95 transition-transform"
            onClick={onClose}
            data-testid="mobile-slide-panel-close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div 
          className={cn(
            "flex-1 overflow-hidden animate-fade-in",
            !prefersReducedMotion && "animate-stagger-2"
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
