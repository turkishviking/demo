import type { DataSource } from 'typeorm';
import { describeCardholdersRepositoriesContract } from '../../../../test/cardholders/repositories.contract';
import { FixedClock } from '../../../../test/fakes/clocks';
import { SequentialIdGenerator } from '../../../../test/fakes/sequential-id-generator';
import { openTestDataSource, truncate } from '../../../../test/postgres/test-database';
import { EventEnvelopeFactory } from '../../../shared/application/event-envelope';
import { AsyncLocalCorrelationContext } from '../../../shared/infrastructure/context/async-local-correlation-context';
import { TransactionContext } from '../../../shared/infrastructure/database/transaction-context';
import { TypeormUnitOfWork } from '../../../shared/infrastructure/database/typeorm-unit-of-work';
import { OutboxEventPublisher } from '../../../shared/infrastructure/outbox/outbox-event-publisher';
import { SqlGroupLookup, TypeormGroupRepository } from './typeorm-group.repository';
import { SqlPersonLookup, TypeormPersonRepository } from './typeorm-person.repository';

export const CARDHOLDERS_TABLES = [
  'cardholders.group_members',
  'cardholders.groups',
  'cardholders.persons',
];

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = await openTestDataSource();
});
afterAll(() => dataSource.destroy());

describeCardholdersRepositoriesContract('Postgres', async () => {
  await truncate(dataSource, CARDHOLDERS_TABLES);
  const transactions = new TransactionContext(dataSource);
  const uow = new TypeormUnitOfWork(dataSource, transactions);
  const envelopes = new EventEnvelopeFactory(
    new FixedClock(),
    new SequentialIdGenerator('00000000-0000-7000-9000'),
    new AsyncLocalCorrelationContext(),
  );
  const publisher = new OutboxEventPublisher(transactions);
  return {
    persons: new TypeormPersonRepository(transactions, envelopes, publisher),
    personLookup: new SqlPersonLookup(transactions),
    groups: new TypeormGroupRepository(transactions, envelopes, publisher),
    groupLookup: new SqlGroupLookup(transactions),
    run: (work) => uow.run(work),
    publishedEvents: async () =>
      (
        await dataSource.query(
          `SELECT type, aggregate_id, aggregate_version FROM shared.outbox ORDER BY position`,
        )
      ).map((r: { type: string; aggregate_id: string; aggregate_version: number }) => ({
        type: r.type,
        aggregateId: r.aggregate_id,
        aggregateVersion: r.aggregate_version,
      })),
  };
});
