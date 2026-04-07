/**
 * Logger utility for PLOT
 * Provides a standardized way to log messages with proper formatting
 */

import { log as viteLog } from '../vite';

type LogLevel = 'info' | 'warn' | 'error';

/**
 * Log a message with source and level information
 */
export function log(message: string, source: string, level: LogLevel = 'info'): void {
  const formattedMessage = level === 'info' 
    ? message
    : level === 'warn'
      ? `WARNING: ${message}`
      : `ERROR: ${message}`;
      
  viteLog(formattedMessage, source);
}

/**
 * Create a source-specific logger
 */
export function createLogger(defaultSource: string) {
  return {
    info: (message: string, source: string = defaultSource) => log(message, source, 'info'),
    warn: (message: string, source: string = defaultSource) => log(message, source, 'warn'),
    error: (message: string, source: string = defaultSource) => log(message, source, 'error')
  };
}