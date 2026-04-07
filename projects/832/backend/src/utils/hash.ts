/**
 * Utility functions for: Utility module providing functions to hash passwords with bcryptjs and compare plain text passwords to hashed values. Wraps bcryptjs in async functions and centralizes salt rounds configuration.
 */

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function parseValue<T>(value: string, defaultValue: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}