import { RetryPolicy, ServiceOperationError } from "../interfaces/service-reliability.js";

export async function withRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
  classifyError?: (error: unknown) => ServiceOperationError
): Promise<T> {
  const maxAttempts = Math.max(1, policy.maxAttempts);
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      const classified = classifyError?.(error);
      const retryable = classified?.retryable ?? true;
      lastError = error;
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Operation failed without error context");
}
