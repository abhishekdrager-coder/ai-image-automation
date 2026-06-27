export async function withRetry(operation, options = {}) {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 800;
  const shouldRetry = options.shouldRetry ?? (() => false);

  let attempt = 0;

  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      attempt += 1;

      if (attempt > retries || !shouldRetry(error)) {
        throw error;
      }

      const delayMs = baseDelayMs * (2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
