/**
 * Réessaie une assertion jusqu'à ce qu'elle passe ou que le délai expire.
 * À utiliser pour les effets asynchrones (events), jamais un `sleep` fixe.
 */
export async function eventually<T>(
  assertion: () => T | Promise<T>,
  { timeoutMs = 5000, intervalMs = 25 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() <= deadline) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw lastError;
}
