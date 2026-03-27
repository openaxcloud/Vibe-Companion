/**
 * TerminalMetricsIndicator - Shows terminal performance metrics
 * Placeholder component for displaying CPU, memory, and other metrics
 */

import { ReactNode } from 'react';

export interface TerminalMetricsIndicatorProps {
  cpu?: number;
  memory?: number;
  diskUsage?: number;
  uptime?: number;
  compact?: boolean;
  className?: string;
  children?: ReactNode;
  'data-testid'?: string;
}

export function TerminalMetricsIndicator({
  cpu = 0,
  memory = 0,
  diskUsage = 0,
  uptime = 0,
  compact = false,
  className = '',
  children,
  ...rest
}: TerminalMetricsIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 text-xs text-gray-600 ${compact ? 'gap-1' : 'gap-2'} ${className}`} {...rest}>
      {cpu > 0 && <span>{compact ? `${cpu.toFixed(0)}%` : `CPU: ${cpu.toFixed(1)}%`}</span>}
      {memory > 0 && <span>{compact ? `${memory.toFixed(0)}%` : `MEM: ${memory.toFixed(1)}%`}</span>}
      {diskUsage > 0 && !compact && <span>DISK: {diskUsage.toFixed(1)}%</span>}
      {uptime > 0 && !compact && <span>UP: {uptime}s</span>}
      {children}
    </div>
  );
}
