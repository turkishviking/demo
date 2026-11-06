import { InMemoryInbox } from '../../../test/fakes/in-memory-messaging';
import { AsyncLocalCorrelationContext } from '../infrastructure/context/async-local-correlation-context';
import { EventDispatchError, InProcessEventBus } from './event-bus';
import type { EventEnvelope } from './event-envelope';

const anEvent = (overrides: Partial<EventEnvelope> = {}): EventEnvelope => ({
  eventId: 'evt-1',
  type: 'test.Happened',
  version: 1,
  aggregateId: 'agg-1',
  aggregateVersion: 1,
  occurredAt: '2026-01-01T00:00:00.000Z',
  correlationId: 'corr-1',
  causationId: null,
  payload: { foo: 'bar' },
  ...overrides,
});

describe('InProcessEventBus', () => {
  let inbox: InMemoryInbox;
  let correlation: AsyncLocalCorrelationContext;
  let bus: InProcessEventBus;

  beforeEach(() => {
    inbox = new InMemoryInbox();
    correlation = new AsyncLocalCorrelationContext();
    bus = new InProcessEventBus(inbox, correlation);
  });

  it('delivers an event to every subscriber of its type only', async () => {
    const received: string[] = [];
    bus.subscribe({
      eventType: 'test.Happened',
      subscriber: 'a',
      handle: async () => void received.push('a'),
    });
    bus.subscribe({
      eventType: 'test.Happened',
      subscriber: 'b',
      handle: async () => void received.push('b'),
    });
    bus.subscribe({
      eventType: 'test.Other',
      subscriber: 'c',
      handle: async () => void received.push('c'),
    });

    await bus.dispatch(anEvent());

    expect(received).toEqual(['a', 'b']);
    expect(bus.subscribersOf('test.Happened')).toEqual(['a', 'b']);
  });

  it('does nothing for an event without subscribers', async () => {
    await expect(bus.dispatch(anEvent({ type: 'test.Nobody' }))).resolves.toBeUndefined();
  });

  it('processes a redelivered event only once per subscriber', async () => {
    const handle = jest.fn(async () => undefined);
    bus.subscribe({ eventType: 'test.Happened', subscriber: 'a', handle });

    await bus.dispatch(anEvent());
    await bus.dispatch(anEvent());

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('runs handlers with the event correlation and the event as causation', async () => {
    let seen: unknown;
    bus.subscribe({
      eventType: 'test.Happened',
      subscriber: 'a',
      handle: async () => {
        seen = correlation.current();
      },
    });

    await bus.dispatch(anEvent({ eventId: 'evt-42', correlationId: 'corr-9' }));

    expect(seen).toEqual({ correlationId: 'corr-9', causationId: 'evt-42' });
  });

  it('isolates failures: other subscribers still run, then dispatch rejects', async () => {
    const ok = jest.fn(async () => undefined);
    bus.subscribe({
      eventType: 'test.Happened',
      subscriber: 'failing',
      handle: async () => {
        throw new Error('boom');
      },
    });
    bus.subscribe({ eventType: 'test.Happened', subscriber: 'ok', handle: ok });

    const dispatch = bus.dispatch(anEvent());

    await expect(dispatch).rejects.toThrow(EventDispatchError);
    await expect(dispatch).rejects.toThrow(/failing \(boom\)/);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(inbox.has('failing', 'evt-1')).toBe(false);
    expect(inbox.has('ok', 'evt-1')).toBe(true);
  });

  it('reports non-Error failures', async () => {
    bus.subscribe({
      eventType: 'test.Happened',
      subscriber: 'weird',
      handle: () => Promise.reject('plain string'),
    });
    await expect(bus.dispatch(anEvent())).rejects.toThrow(/weird \(plain string\)/);
  });

  it('refuses the same subscriber twice on the same event type', () => {
    const handle = async () => undefined;
    bus.subscribe({ eventType: 'test.Happened', subscriber: 'a', handle });
    expect(() => bus.subscribe({ eventType: 'test.Happened', subscriber: 'a', handle })).toThrow(
      /already subscribed/,
    );
  });
});
