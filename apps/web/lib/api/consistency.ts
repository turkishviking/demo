const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lecture après écriture sur un read model à cohérence éventuelle (docs/04-architecture/cqrs.md) :
 * relit jusqu'à ce que `isUpToDate` soit vrai ou que le délai expire, puis renvoie la dernière
 * valeur lue. Ne lève pas d'erreur au timeout : la page affiche alors l'état connu.
 */
export async function readYourWrite<T>(
  read: () => Promise<T>,
  isUpToDate: (value: T) => boolean,
  { timeoutMs = 2000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!isUpToDate(value) && Date.now() < deadline) {
    await sleep(intervalMs);
    value = await read();
  }
  return value;
}
