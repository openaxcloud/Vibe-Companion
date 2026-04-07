// @ts-nocheck
import { db } from '../db';

export type TransactionClient = typeof db;

export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await fn(tx);
  });
}

export async function withTransactionAndRetry<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelayMs = 100 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        return await fn(tx);
      });
    } catch (error: any) {
      lastError = error;
      const isRetryable = 
        error.code === '40001' || // serialization_failure
        error.code === '40P01' || // deadlock_detected
        error.code === '55P03';   // lock_not_available

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
    }
  }

  throw lastError;
}
