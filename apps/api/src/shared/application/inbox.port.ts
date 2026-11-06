/**
 * Déduplication côté consommateur. `runOnce` exécute `work` dans une transaction et
 * enregistre `(subscriber, eventId)` dans cette même transaction. Si le couple existe
 * déjà, `work` n'est pas exécuté et la méthode renvoie `false`.
 */
export interface Inbox {
  runOnce(subscriber: string, eventId: string, work: () => Promise<void>): Promise<boolean>;
}

export const INBOX = Symbol('Inbox');
