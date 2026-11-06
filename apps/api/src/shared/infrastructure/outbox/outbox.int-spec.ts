import type { DataSource } from 'typeorm';
import { ControllableClock } from '../../../../test/fakes/clocks';
import { SequentialIdGenerator } from '../../../../test/fakes/sequential-id-generator';
import { eventually } from '../../../../test/helpers/eventually';
import {
  testDatabaseUrl,
  openTestDataSource,
  truncate,
} from '../../../../test/postgres/test-database';
import { InProcessEventBus } from '../../application/event-bus';
import { type EventEnvelope, EventEnvelopeFactory } from '../../application/event-envelope';
import type { DomainEvent } from '../../domain/domain-event';
import { AsyncLocalCorrelationContext } from '../context/async-local-correlation-context';
import { TransactionContext } from '../database/transaction-context';
import { TypeormUnitOfWork } from '../database/typeorm-unit-of-work';
import { PostgresInbox } from '../inbox/postgres-inbox';
import { OutboxEventPublisher } from './outbox-event-publisher';
import { OutboxRelay } from './outbox-relay';
import { OutboxRelayRunner } from './outbox-relay-runner';
import { PostgresOutboxStatsReader } from './postgres-outbox-stats-reader';

const AGG_A = '00000000-0000-7000-a000-00000000000a';
const AGG_B = '00000000-0000-7000-a000-00000000000b';
const event = (type: string, payload: Record<string, unknown> = {}): DomainEvent => ({
  type,
  version: 1,
  payload,
});

describe('Outbox → relay → bus → inbox (integration)', () => {
  let dataSource: DataSource;
  let clock: ControllableClock;
  let transactions: TransactionContext;
  let uow: TypeormUnitOfWork;
  let correlation: AsyncLocalCorrelationContext;
  let envelopes: EventEnvelopeFactory;
  let publisher: OutboxEventPublisher;
  let bus: InProcessEventBus;
  let relay: OutboxRelay;
  const MAX_ATTEMPTS = 3;

  beforeAll(async () => {
    dataSource = await openTestDataSource();
  });
  afterAll(() => dataSource.destroy());

  beforeEach(async () => {
    await truncate(dataSource);
    clock = new ControllableClock(new Date('2026-01-01T10:00:00.000Z'));
    transactions = new TransactionContext(dataSource);
    uow = new TypeormUnitOfWork(dataSource, transactions);
    correlation = new AsyncLocalCorrelationContext();
    envelopes = new EventEnvelopeFactory(clock, new SequentialIdGenerator(), correlation);
    publisher = new OutboxEventPublisher(transactions);
    bus = new InProcessEventBus(new PostgresInbox(uow, transactions), correlation);
    relay = new OutboxRelay(dataSource, bus, clock, {
      batchSize: 10,
      maxAttempts: MAX_ATTEMPTS,
      baseRetryDelayMs: 1000,
    });
  });

  /** Simule le save d'un agrégat : events écrits dans l'outbox dans une transaction. */
  const emit = (aggregateId: string, baseVersion: number, ...events: DomainEvent[]) =>
    uow.run(() => publisher.publish(envelopes.wrap(aggregateId, baseVersion, events)));

  const outboxRow = async (type: string) =>
    (await dataSource.query(`SELECT * FROM shared.outbox WHERE type = $1`, [type]))[0];

  it('delivers committed events to subscribers, in order per aggregate', async () => {
    const received: string[] = [];
    bus.subscribe({
      eventType: 'test.A1',
      subscriber: 's',
      handle: async (e) => void received.push(e.type),
    });
    bus.subscribe({
      eventType: 'test.A2',
      subscriber: 's',
      handle: async (e) => void received.push(e.type),
    });

    await emit(AGG_A, 0, event('test.A1'), event('test.A2'));
    await emit(AGG_B, 0, event('test.A1'));

    // Un lot livre au plus un event par agrégat (le suivant attend que le précédent soit livré)
    expect(await relay.processBatch()).toEqual({ selected: 2, dispatched: 2, failed: 0 });
    expect(received).toEqual(['test.A1', 'test.A1']);
    expect((await outboxRow('test.A1')).dispatched_at).not.toBeNull();

    expect(await relay.drain()).toBe(1);
    expect(received).toEqual(['test.A1', 'test.A1', 'test.A2']);
    expect(await relay.processBatch()).toEqual({ selected: 0, dispatched: 0, failed: 0 });
  });

  it('transports the envelope intact (payload, correlation, versions)', async () => {
    let delivered: EventEnvelope | undefined;
    bus.subscribe({
      eventType: 'test.Rich',
      subscriber: 's',
      handle: async (e) => void (delivered = e),
    });

    await correlation.run({ correlationId: 'corr-42', causationId: 'cause-1' }, () =>
      emit(AGG_A, 4, event('test.Rich', { amount: { amountMinor: 4250, currency: 'EUR' } })),
    );
    await relay.drain();

    expect(delivered).toMatchObject({
      type: 'test.Rich',
      version: 1,
      aggregateId: AGG_A,
      aggregateVersion: 5,
      occurredAt: '2026-01-01T10:00:00.000Z',
      correlationId: 'corr-42',
      causationId: 'cause-1',
      payload: { amount: { amountMinor: 4250, currency: 'EUR' } },
    });
  });

  it('never delivers events of a rolled back transaction', async () => {
    const handle = jest.fn(async () => undefined);
    bus.subscribe({ eventType: 'test.Ghost', subscriber: 's', handle });

    await expect(
      uow.run(async () => {
        await publisher.publish(envelopes.wrap(AGG_A, 0, [event('test.Ghost')]));
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    await relay.drain();

    expect(handle).not.toHaveBeenCalled();
  });

  it('retries a failing event with backoff and blocks later events of the same aggregate', async () => {
    let failuresLeft = 1;
    const received: string[] = [];
    bus.subscribe({
      eventType: 'test.Flaky',
      subscriber: 's',
      handle: async (e) => {
        if (failuresLeft-- > 0) throw new Error('temporary failure');
        received.push(e.type);
      },
    });
    for (const type of ['test.Next', 'test.Other']) {
      bus.subscribe({
        eventType: type,
        subscriber: 's',
        handle: async (e) => void received.push(e.type),
      });
    }

    await emit(AGG_A, 0, event('test.Flaky'), event('test.Next'));
    await emit(AGG_B, 0, event('test.Other'));

    expect(await relay.processBatch()).toEqual({ selected: 2, dispatched: 1, failed: 1 });
    expect(received).toEqual(['test.Other']); // B n'est pas bloqué par A
    const failed = await outboxRow('test.Flaky');
    expect(failed).toMatchObject({
      attempts: 1,
      last_error: expect.stringContaining('temporary failure'),
    });

    // Pendant le backoff, rien n'est retenté, et test.Next attend son prédécesseur.
    expect(await relay.processBatch()).toEqual({ selected: 0, dispatched: 0, failed: 0 });

    clock.advance(1000);
    await relay.drain();
    expect(received).toEqual(['test.Other', 'test.Flaky', 'test.Next']);
  });

  it('moves an event to dead letter after max attempts and reports it', async () => {
    const logger = { warn: jest.fn(), error: jest.fn() };
    relay = new OutboxRelay(
      dataSource,
      bus,
      clock,
      { batchSize: 10, maxAttempts: MAX_ATTEMPTS, baseRetryDelayMs: 10 },
      logger,
    );
    bus.subscribe({
      eventType: 'test.Poison',
      subscriber: 's',
      handle: async () => {
        throw new Error('always fails');
      },
    });

    await emit(AGG_A, 0, event('test.Poison'));
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) {
      await relay.processBatch();
      clock.advance(60_000);
    }

    expect((await outboxRow('test.Poison')).attempts).toBe(MAX_ATTEMPTS);
    expect(logger.warn).toHaveBeenCalledTimes(MAX_ATTEMPTS - 1);
    expect(logger.error).toHaveBeenCalledWith(
      'Outbox event moved to dead letter',
      expect.any(Object),
    );
    await expect(new PostgresOutboxStatsReader(dataSource, MAX_ATTEMPTS).read()).resolves.toEqual({
      pending: 0,
      deadLetter: 1,
    });
  });

  it('counts pending events', async () => {
    await emit(AGG_A, 0, event('test.Pending'), event('test.Pending2'));
    await expect(new PostgresOutboxStatsReader(dataSource, MAX_ATTEMPTS).read()).resolves.toEqual({
      pending: 2,
      deadLetter: 0,
    });
  });

  it('is idempotent per subscriber when an event is redelivered', async () => {
    const handle = jest.fn(async () => undefined);
    bus.subscribe({ eventType: 'test.Once', subscriber: 's', handle });
    await emit(AGG_A, 0, event('test.Once'));
    const [row] = await dataSource.query(`SELECT * FROM shared.outbox`);

    await relay.drain();
    // Redelivery forcée (ex. crash du relais avant la mise à jour de dispatched_at)
    await dataSource.query(`UPDATE shared.outbox SET dispatched_at = NULL`);
    await relay.drain();

    expect(handle).toHaveBeenCalledTimes(1);
    const inbox = await dataSource.query(`SELECT * FROM shared.inbox WHERE event_id = $1`, [
      row.event_id,
    ]);
    expect(inbox).toHaveLength(1);
  });

  it('lets subscribers write in their own transaction, rolled back with the inbox on failure', async () => {
    const otherAgg = '00000000-0000-7000-a000-0000000000cc';
    let fail = true;
    bus.subscribe({
      eventType: 'test.Trigger',
      subscriber: 'policy',
      handle: async () => {
        // une policy qui publie un event en réaction, puis échoue la première fois
        await publisher.publish(envelopes.wrap(otherAgg, 0, [event('test.Reaction')]));
        if (fail) {
          fail = false;
          throw new Error('policy failed');
        }
      },
    });

    await emit(AGG_A, 0, event('test.Trigger'));
    await relay.processBatch();
    expect(await outboxRow('test.Reaction')).toBeUndefined();

    clock.advance(10_000);
    await relay.processBatch();
    const reaction = await outboxRow('test.Reaction');
    expect(reaction).toBeDefined();
    expect(reaction.causation_id).toBe((await outboxRow('test.Trigger')).event_id);
  });

  it('runner: wakes up on NOTIFY and delivers without waiting for the poll interval', async () => {
    const realClockRelay = new OutboxRelay(
      dataSource,
      bus,
      { now: () => new Date() },
      { batchSize: 10, maxAttempts: 3 },
    );
    const runner = new OutboxRelayRunner(realClockRelay, testDatabaseUrl(), 60_000);
    const received: string[] = [];
    bus.subscribe({
      eventType: 'test.Live',
      subscriber: 's',
      handle: async (e) => void received.push(e.eventId),
    });

    await runner.start();
    try {
      await emit(AGG_A, 0, event('test.Live'));
      await eventually(() => expect(received).toHaveLength(1), { timeoutMs: 3000 });
    } finally {
      await runner.stop();
    }
  });
});
