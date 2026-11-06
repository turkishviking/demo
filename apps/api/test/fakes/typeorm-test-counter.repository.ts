import type { DataSource } from 'typeorm';
import { ConcurrencyError } from '../../src/shared/application/concurrency-error';
import type { EventEnvelopeFactory } from '../../src/shared/application/event-envelope';
import type { EventPublisher } from '../../src/shared/application/event-publisher.port';
import { sql } from '../../src/shared/infrastructure/database/sql';
import type { TransactionContext } from '../../src/shared/infrastructure/database/transaction-context';
import { TestCounter } from './test-counter.aggregate';

export const TEST_COUNTER_TABLE = 'shared.test_counters';

export async function createTestCounterTable(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS ${TEST_COUNTER_TABLE} (
      id uuid PRIMARY KEY, value integer NOT NULL, version integer NOT NULL
    )`);
}

/**
 * Repository de référence, tel que les bounded contexts l'implémenteront (ADR-0003) :
 * SQL explicite via le manager de la transaction courante, verrou optimiste, events
 * écrits dans l'outbox dans la même transaction.
 */
export class TypeormTestCounterRepository {
  constructor(
    private readonly transactions: TransactionContext,
    private readonly envelopes: EventEnvelopeFactory,
    private readonly publisher: EventPublisher,
  ) {}

  async findById(id: string): Promise<TestCounter | null> {
    const { rows } = await sql<{ id: string; value: number; version: number }>(
      this.transactions.current(),
      `SELECT id, value, version FROM ${TEST_COUNTER_TABLE} WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    return row ? TestCounter.restore(row.id, row.version, row.value) : null;
  }

  async save(counter: TestCounter): Promise<void> {
    const manager = this.transactions.requireTransactional();
    const expectedVersion = counter.version;
    const { envelopes, nextVersion } = this.envelopes.pullFrom(counter);

    if (counter.isNew) {
      await sql(
        manager,
        `INSERT INTO ${TEST_COUNTER_TABLE} (id, value, version) VALUES ($1, $2, $3)`,
        [counter.id, counter.value, nextVersion],
      );
    } else {
      const { rowCount } = await sql(
        manager,
        `UPDATE ${TEST_COUNTER_TABLE} SET value = $2, version = $3 WHERE id = $1 AND version = $4`,
        [counter.id, counter.value, nextVersion, expectedVersion],
      );
      if (rowCount === 0) throw new ConcurrencyError('TestCounter', counter.id, expectedVersion);
    }

    await this.publisher.publish(envelopes);
    counter.markPersisted(nextVersion);
  }
}
