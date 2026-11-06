import type { DataSource } from 'typeorm';
import { ControllableClock } from '../../../../test/fakes/clocks';
import { SequentialIdGenerator } from '../../../../test/fakes/sequential-id-generator';
import { TestCounter } from '../../../../test/fakes/test-counter.aggregate';
import {
  createTestCounterTable,
  TEST_COUNTER_TABLE,
  TypeormTestCounterRepository,
} from '../../../../test/fakes/typeorm-test-counter.repository';
import { openTestDataSource, truncate } from '../../../../test/postgres/test-database';
import { ConcurrencyError } from '../../application/concurrency-error';
import { EventEnvelopeFactory } from '../../application/event-envelope';
import { AsyncLocalCorrelationContext } from '../context/async-local-correlation-context';
import { OutboxEventPublisher } from '../outbox/outbox-event-publisher';
import { PostgresHealthProbe } from './postgres-health-probe';
import { sql } from './sql';
import { TransactionContext } from './transaction-context';
import { TypeormUnitOfWork } from './typeorm-unit-of-work';

const ids = (n: number) => `00000000-0000-7000-9000-${n.toString(16).padStart(12, '0')}`;

describe('TypeormUnitOfWork + repository + outbox (integration)', () => {
  let dataSource: DataSource;
  let transactions: TransactionContext;
  let uow: TypeormUnitOfWork;
  let repository: TypeormTestCounterRepository;

  beforeAll(async () => {
    dataSource = await openTestDataSource();
    await createTestCounterTable(dataSource);
    transactions = new TransactionContext(dataSource);
    uow = new TypeormUnitOfWork(dataSource, transactions);
    const envelopes = new EventEnvelopeFactory(
      new ControllableClock(),
      new SequentialIdGenerator(),
      new AsyncLocalCorrelationContext(),
    );
    repository = new TypeormTestCounterRepository(
      transactions,
      envelopes,
      new OutboxEventPublisher(transactions),
    );
  });

  afterAll(() => dataSource.destroy());
  beforeEach(() => truncate(dataSource, [TEST_COUNTER_TABLE]));

  const outboxTypes = async () =>
    (await dataSource.query(`SELECT type FROM shared.outbox ORDER BY position`)).map(
      (r: { type: string }) => r.type,
    );

  it('persists the aggregate and its events atomically', async () => {
    await uow.run(async () => {
      const counter = TestCounter.create(ids(1));
      counter.increment(5);
      await repository.save(counter);
    });

    const reloaded = await repository.findById(ids(1));
    expect(reloaded?.value).toBe(5);
    expect(reloaded?.version).toBe(2);
    expect(await outboxTypes()).toEqual(['test.CounterCreated', 'test.CounterIncremented']);
  });

  it('rolls back state and events together when the work fails', async () => {
    await expect(
      uow.run(async () => {
        await repository.save(TestCounter.create(ids(2)));
        throw new Error('fail after save');
      }),
    ).rejects.toThrow('fail after save');

    expect(await repository.findById(ids(2))).toBeNull();
    expect(await outboxTypes()).toEqual([]);
  });

  it('joins the current transaction when nested', async () => {
    await expect(
      uow.run(async () => {
        await uow.run(() => repository.save(TestCounter.create(ids(3))));
        throw new Error('outer fails');
      }),
    ).rejects.toThrow('outer fails');

    expect(await repository.findById(ids(3))).toBeNull();
  });

  it('detects concurrent modifications with the optimistic lock', async () => {
    await uow.run(() => repository.save(TestCounter.create(ids(4))));

    const first = await repository.findById(ids(4));
    const second = await repository.findById(ids(4));
    first!.increment();
    second!.increment();

    await uow.run(() => repository.save(first!));
    await expect(uow.run(() => repository.save(second!))).rejects.toThrow(ConcurrencyError);

    const reloaded = await repository.findById(ids(4));
    expect(reloaded?.value).toBe(1);
  });

  it('refuses to publish events outside of a transaction', async () => {
    const counter = TestCounter.create(ids(5));
    await expect(repository.save(counter)).rejects.toThrow(/inside UnitOfWork.run/);
  });

  it('runs raw SQL outside of a transaction with the default manager', async () => {
    const { rows } = await sql<{ one: number }>(transactions.current(), 'SELECT 1 AS one');
    expect(rows).toEqual([{ one: 1 }]);
  });

  it('reports the database as up', async () => {
    await expect(new PostgresHealthProbe(dataSource).isUp()).resolves.toBe(true);
  });
});
