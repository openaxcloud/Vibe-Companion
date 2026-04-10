export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunkSize = Math.max(1, Math.floor(size));
  if (!items || items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  return chunks;
}

export function delay(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  delayFn?: (ms: number) => Promise<void>;
}

interface RetryResult {
  success: boolean;
  error?: string;
  attempts: number;
}

interface TaskResult {
  success: boolean;
  error?: string;
}

export async function executeWithBackoff(
  task: (attempt: number) => Promise<TaskResult>,
  options: RetryOptions
): Promise<RetryResult> {
  const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 0));
  const baseDelayMs = Math.max(0, Math.floor(options.baseDelayMs ?? 0));
  const delayFn = options.delayFn ?? delay;

  let attempt = 0;
  let lastError: string | undefined;

  while (attempt <= maxRetries) {
    attempt += 1;
    const result = await task(attempt);

    if (result.success) {
      return { success: true, attempts: attempt };
    }

    lastError = result.error ?? lastError;

    if (attempt > maxRetries) {
      break;
    }

    const backoffMs = baseDelayMs * Math.pow(2, attempt - 1);
    await delayFn(backoffMs);
  }

  return { success: false, error: lastError, attempts: attempt };
}
