import type { EventEnvelope } from './event-envelope';

/**
 * Publie des events de façon fiable. L'implémentation de production écrit dans
 * l'outbox avec la transaction courante : l'event n'existe que si le save est commité.
 */
export interface EventPublisher {
  publish(envelopes: readonly EventEnvelope[]): Promise<void>;
}

export const EVENT_PUBLISHER = Symbol('EventPublisher');
