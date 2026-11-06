import type { CorrelationContext } from './correlation.port';
import type { EventEnvelope } from './event-envelope';
import type { Inbox } from './inbox.port';

export type EventHandler<TPayload = unknown> = (event: EventEnvelope<TPayload>) => Promise<void>;

export interface EventSubscription<TPayload = unknown> {
  /** Type d'event écouté : `transactions.TransactionRequested`. */
  readonly eventType: string;
  /** Nom stable de l'abonné, clé de déduplication dans l'inbox. */
  readonly subscriber: string;
  readonly handle: EventHandler<TPayload>;
}

export interface EventBus {
  subscribe<TPayload>(subscription: EventSubscription<TPayload>): void;
  /** Livre l'event à tous ses abonnés. Rejette si au moins un abonné échoue. */
  dispatch(event: EventEnvelope): Promise<void>;
}

export const EVENT_BUS = Symbol('EventBus');

export class EventDispatchError extends Error {
  constructor(
    readonly eventId: string,
    readonly failures: ReadonlyArray<{ subscriber: string; error: unknown }>,
  ) {
    super(
      `Event ${eventId} failed for ${failures.length} subscriber(s): ${failures
        .map(
          (f) =>
            `${f.subscriber} (${f.error instanceof Error ? f.error.message : String(f.error)})`,
        )
        .join(', ')}`,
    );
    this.name = 'EventDispatchError';
  }
}

/**
 * Bus in-process. Chaque abonné traite l'event :
 * - dans sa propre transaction, dédupliquée par l'inbox (exactly-once effectif) ;
 * - avec la corrélation de l'event (`causationId` = id de l'event).
 * Un abonné en échec n'empêche pas les autres ; l'event sera relivré et l'inbox
 * ignorera les abonnés qui l'ont déjà traité.
 */
export class InProcessEventBus implements EventBus {
  private readonly subscriptions = new Map<string, EventSubscription[]>();

  constructor(
    private readonly inbox: Inbox,
    private readonly correlation: CorrelationContext,
  ) {}

  subscribe<TPayload>(subscription: EventSubscription<TPayload>): void {
    const existing = this.subscriptions.get(subscription.eventType) ?? [];
    if (existing.some((s) => s.subscriber === subscription.subscriber)) {
      throw new Error(
        `Subscriber ${subscription.subscriber} already subscribed to ${subscription.eventType}`,
      );
    }
    existing.push(subscription as EventSubscription);
    this.subscriptions.set(subscription.eventType, existing);
  }

  subscribersOf(eventType: string): string[] {
    return (this.subscriptions.get(eventType) ?? []).map((s) => s.subscriber);
  }

  async dispatch(event: EventEnvelope): Promise<void> {
    const subscriptions = this.subscriptions.get(event.type) ?? [];
    const failures: Array<{ subscriber: string; error: unknown }> = [];

    for (const subscription of subscriptions) {
      try {
        await this.correlation.run(
          { correlationId: event.correlationId, causationId: event.eventId },
          () =>
            this.inbox.runOnce(subscription.subscriber, event.eventId, () =>
              subscription.handle(event),
            ),
        );
      } catch (error) {
        failures.push({ subscriber: subscription.subscriber, error });
      }
    }

    if (failures.length > 0) throw new EventDispatchError(event.eventId, failures);
  }
}
