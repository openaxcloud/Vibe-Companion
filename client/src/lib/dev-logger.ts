/**
 * Development-only logger utility
 * 
 * In production builds, all logging is stripped out for:
 * - Performance: No string concatenation or console overhead
 * - Security: No internal debugging info leaks to client
 * - Clean console: Users don't see developer debugging
 * 
 * Usage:
 *   import { devLog, devWarn, devError } from '@/lib/dev-logger';
 *   devLog('[Component]', 'message', data);
 *   devWarn('[Component]', 'warning', data);
 *   devError('[Component]', 'error', data);
 */

const isDev = import.meta.env.DEV;

export const devLog = isDev
  ? (...args: any[]) => console.log(...args)
  : () => {};

export const devWarn = isDev
  ? (...args: any[]) => console.warn(...args)
  : () => {};

export const devError = isDev
  ? (...args: any[]) => console.error(...args)
  : () => {};

export const devInfo = isDev
  ? (...args: any[]) => console.info(...args)
  : () => {};

export const devDebug = isDev
  ? (...args: any[]) => console.debug(...args)
  : () => {};

export const devGroup = isDev
  ? (label: string) => console.group(label)
  : () => {};

export const devGroupEnd = isDev
  ? () => console.groupEnd()
  : () => {};

export const devTable = isDev
  ? (data: any) => console.table(data)
  : () => {};
