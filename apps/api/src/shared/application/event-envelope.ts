import type { AggregateRoot } from '../domain/aggregate-root';
import type { DomainEvent } from '../domain/domain-event';
import type { Clock } from './clock.port';
import type { CorrelationContext } from './correlation.port';
import type { IdGenerator } from './id-generator.port';

/** Forme sérialisée d'un event, telle qu'écrite dans l'outbox et transportée par le bus. */
export interface EventEnvelope<TPayload = unknown> {
  readonly eventId: string;
  readonly type: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  /** ISO 8601. */
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly payload: TPayload;
}

/**
 * Met les events d'un agrégat en enveloppe. La version d'agrégat de chaque event est
 * `version persistée + rang`, la version finale de l'agrégat étant celle du dernier event
 * (ou `version + 1` s'il n'y en a aucun).
 */
export class EventEnvelopeFactory {
  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly correlation: CorrelationContext,
  ) {}

  wrap(aggregateId: string, baseVersion: number, events: readonly DomainEvent[]): EventEnvelope[] {
    const occurredAt = this.clock.now().toISOString();
    const current = this.correlation.current();
    const correlationId = current?.correlationId ?? this.ids.next();
    const causationId = current?.causationId ?? null;

    return events.map((event, index) => ({
      eventId: this.ids.next(),
      type: event.type,
      version: event.version,
      aggregateId,
      aggregateVersion: baseVersion + index + 1,
      occurredAt,
      correlationId,
      causationId,
      payload: event.payload,
    }));
  }

  /** Retire les events de l'agrégat et calcule la prochaine version à persister. */
  pullFrom(aggregate: AggregateRoot<string>): { envelopes: EventEnvelope[]; nextVersion: number } {
    const events = aggregate.pullEvents();
    const envelopes = this.wrap(aggregate.id, aggregate.version, events);
    const nextVersion = aggregate.version + Math.max(events.length, 1);
    return { envelopes, nextVersion };
  }
}

export const EVENT_ENVELOPE_FACTORY = Symbol('EventEnvelopeFactory');
