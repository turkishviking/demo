import { FixedClock } from '../../../test/fakes/clocks';
import { SequentialIdGenerator } from '../../../test/fakes/sequential-id-generator';
import { TestCounter } from '../../../test/fakes/test-counter.aggregate';
import { AsyncLocalCorrelationContext } from '../infrastructure/context/async-local-correlation-context';
import { EventEnvelopeFactory } from './event-envelope';

describe('EventEnvelopeFactory', () => {
  const clock = new FixedClock(new Date('2026-03-01T12:00:00.000Z'));
  let ids: SequentialIdGenerator;
  let correlation: AsyncLocalCorrelationContext;
  let factory: EventEnvelopeFactory;

  beforeEach(() => {
    ids = new SequentialIdGenerator();
    correlation = new AsyncLocalCorrelationContext();
    factory = new EventEnvelopeFactory(clock, ids, correlation);
  });

  it('numbers events after the persisted version of the aggregate', () => {
    const counter = TestCounter.restore('c-1', 4, 0);
    counter.increment();
    counter.increment();

    const { envelopes, nextVersion } = factory.pullFrom(counter);

    expect(envelopes.map((e) => e.aggregateVersion)).toEqual([5, 6]);
    expect(nextVersion).toBe(6);
    expect(counter.pendingEvents).toEqual([]);
  });

  it('bumps the version by one when there is no event', () => {
    const counter = TestCounter.restore('c-1', 4, 0);
    expect(factory.pullFrom(counter)).toEqual({ envelopes: [], nextVersion: 5 });
  });

  it('stamps id, date, type and payload', () => {
    const counter = TestCounter.create('c-1');
    const [created] = factory.pullFrom(counter).envelopes;

    expect(created).toMatchObject({
      type: 'test.CounterCreated',
      version: 1,
      aggregateId: 'c-1',
      aggregateVersion: 1,
      occurredAt: '2026-03-01T12:00:00.000Z',
      payload: { counterId: 'c-1' },
    });
    expect(created?.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('propagates the current correlation', () => {
    const counter = TestCounter.create('c-1');
    const [event] = correlation.run(
      { correlationId: 'corr-1', causationId: 'evt-0' },
      () => factory.pullFrom(counter).envelopes,
    );
    expect(event).toMatchObject({ correlationId: 'corr-1', causationId: 'evt-0' });
  });

  it('starts a new correlation outside of any context', () => {
    const [a, b] = factory.wrap('c-1', 0, [
      { type: 'test.A', version: 1, payload: {} },
      { type: 'test.B', version: 1, payload: {} },
    ]);
    expect(a?.correlationId).toBeDefined();
    expect(a?.correlationId).toBe(b?.correlationId);
    expect(a?.causationId).toBeNull();
  });
});
