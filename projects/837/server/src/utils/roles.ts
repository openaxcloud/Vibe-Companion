/**
 * Utility functions for: Enumerations and helpers for role-based access at user and team levels, including guards for owner/admin/member.
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