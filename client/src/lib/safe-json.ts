export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    if (import.meta.env.DEV) {
      console.error('Failed to parse JSON:', json.substring(0, 100));
    }
    return fallback;
  }
}
