import type { EventEnvelope } from '../../src/shared/application/event-envelope';
import type { EventPublisher } from '../../src/shared/application/event-publisher.port';
import type { Inbox } from '../../src/shared/application/inbox.port';
import type { UnitOfWork } from '../../src/shared/application/unit-of-work.port';

export class InMemoryUnitOfWork implements UnitOfWork {
  runs = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.runs++;
    return work();
  }
}

export class RecordingEventPublisher implements EventPublisher {
  readonly published: EventEnvelope[] = [];

  async publish(envelopes: readonly EventEnvelope[]): Promise<void> {
    this.published.push(...envelopes);
  }

  ofType<TPayload>(type: string): EventEnvelope<TPayload>[] {
    return this.published.filter((e) => e.type === type) as EventEnvelope<TPayload>[];
  }
}

/** Même contrat que `PostgresInbox` : rien n'est enregistré si `work` échoue. */
export class InMemoryInbox implements Inbox {
  private readonly processed = new Set<string>();

  async runOnce(subscriber: string, eventId: string, work: () => Promise<void>): Promise<boolean> {
    const key = `${subscriber}|${eventId}`;
    if (this.processed.has(key)) return false;
    await work();
    this.processed.add(key);
    return true;
  }

  has(subscriber: string, eventId: string): boolean {
    return this.processed.has(`${subscriber}|${eventId}`);
  }
}
