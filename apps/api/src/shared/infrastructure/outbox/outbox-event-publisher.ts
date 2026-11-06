import type { EventEnvelope } from '../../application/event-envelope';
import type { EventPublisher } from '../../application/event-publisher.port';
import { sql } from '../database/sql';
import type { TransactionContext } from '../database/transaction-context';

export const OUTBOX_CHANNEL = 'outbox_events';

/**
 * Écrit les events dans `shared.outbox` avec la transaction courante, puis émet un
 * `pg_notify` : Postgres ne le délivre qu'au commit, ce qui réveille le relais au bon moment.
 */
export class OutboxEventPublisher implements EventPublisher {
  constructor(private readonly transactions: TransactionContext) {}

  async publish(envelopes: readonly EventEnvelope[]): Promise<void> {
    if (envelopes.length === 0) return;
    const manager = this.transactions.requireTransactional();

    const values: unknown[] = [];
    const tuples = envelopes.map((e, i) => {
      const base = i * 9;
      values.push(
        e.eventId,
        e.type,
        e.version,
        e.aggregateId,
        e.aggregateVersion,
        JSON.stringify(e.payload),
        e.correlationId,
        e.causationId,
        e.occurredAt,
      );
      const placeholders = Array.from({ length: 9 }, (_, k) => `$${base + k + 1}`);
      // next_attempt_at = occurred_at : le relais compare avec le même port Clock, pas l'horloge DB
      return `(${placeholders.join(', ')}, $${base + 9})`;
    });

    await sql(
      manager,
      `INSERT INTO shared.outbox
         (event_id, type, version, aggregate_id, aggregate_version, payload, correlation_id, causation_id,
          occurred_at, next_attempt_at)
       VALUES ${tuples.join(', ')}`,
      values,
    );
    await sql(manager, `SELECT pg_notify($1, '')`, [OUTBOX_CHANNEL]);
  }
}
