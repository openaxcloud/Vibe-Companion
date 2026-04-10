/**
 * Stop Button for Agent
 * Replit-style stop button to interrupt agent execution
 */

import { Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StopButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function StopButton({
  onClick,
  disabled = false,
  className,
  variant = 'destructive',
  size = 'sm'
}: StopButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size={size}
      className={cn(
        "stop-button-pulse gap-2 transition-all",
        !disabled && "hover:scale-105 active:scale-95",
        className
      )}
      data-testid="agent-stop-button"
    >
      <Square className="h-4 w-4 fill-current" />
      Stop Generation
    </Button>
  );
}

/**
 * Compact Stop Icon Button
 */
export function StopIconButton({
  onClick,
  disabled = false,
  className
}: Omit<StopButtonProps, 'variant' | 'size'>) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="destructive"
      size="icon"
      className={cn(
        "stop-button-pulse h-8 w-8 rounded-full",
        !disabled && "hover:scale-110 active:scale-95",
        className
      )}
      data-testid="agent-stop-icon-button"
    >
      <Square className="h-4 w-4 fill-current" />
    </Button>
  );
}
