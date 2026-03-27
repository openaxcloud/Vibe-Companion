/**
 * StatusBar Component
 * Status bar for code editors showing cursor position, language, etc
 */

import { cn } from '@/lib/utils';
import { Wifi, WifiOff } from 'lucide-react';

interface StatusBarProps {
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  language?: string;
  cursorPosition?: { line: number; column: number };
  encoding?: string;
  lineEnding?: string;
  indentation?: string;
  showPerformance?: boolean;
  className?: string;
}

export function StatusBar({
  connectionStatus = 'connected',
  language = '',
  cursorPosition,
  encoding = 'UTF-8',
  lineEnding = 'LF',
  indentation = 'Spaces: 2',
  showPerformance = false,
  className = '',
}: StatusBarProps) {
  return (
    <div
      className={cn(
        'h-6 border-t border-gray-200 bg-gray-50 px-3 flex items-center justify-between text-xs text-gray-600',
        className
      )}
    >
      {/* Left side - Status info */}
      <div className="flex items-center gap-3">
        {/* Connection Status */}
        <div className="flex items-center gap-1">
          {connectionStatus === 'connected' ? (
            <Wifi className="h-3 w-3 text-green-600" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-600" />
          )}
          <span className="capitalize">{connectionStatus}</span>
        </div>

        {/* Cursor Position */}
        {cursorPosition && (
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        )}

        {/* Language */}
        {language && <span className="text-gray-500">{language}</span>}
      </div>

      {/* Right side - File encoding info */}
      <div className="flex items-center gap-3">
        {encoding && <span>{encoding}</span>}
        {lineEnding && <span>{lineEnding}</span>}
        {indentation && <span>{indentation}</span>}
      </div>
    </div>
  );
}
