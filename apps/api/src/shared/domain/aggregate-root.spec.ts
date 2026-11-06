import { TestCounter } from '../../../test/fakes/test-counter.aggregate';
import { InvariantViolationError } from './domain-error';
import { ValueObject } from './value-object';

describe('AggregateRoot', () => {
  it('is new until persisted', () => {
    const counter = TestCounter.create('c-1');
    expect(counter.isNew).toBe(true);
    expect(counter.version).toBe(0);

    counter.markPersisted(1);
    expect(counter.isNew).toBe(false);
    expect(counter.version).toBe(1);
  });

  it('records events and hands them out exactly once', () => {
    const counter = TestCounter.create('c-1');
    counter.increment(2);

    expect(counter.pendingEvents.map((e) => e.type)).toEqual([
      'test.CounterCreated',
      'test.CounterIncremented',
    ]);
    expect(counter.pullEvents()).toHaveLength(2);
    expect(counter.pullEvents()).toEqual([]);
  });

  it('does not record events when restored', () => {
    const counter = TestCounter.restore('c-1', 3, 10);
    expect(counter.pendingEvents).toEqual([]);
    expect(counter.version).toBe(3);
    expect(counter.value).toBe(10);
  });

  it('enforces its invariants', () => {
    expect(() => TestCounter.create('c-1').increment(0)).toThrow(InvariantViolationError);
  });

  it('refuses a version that does not increase', () => {
    const counter = TestCounter.restore('c-1', 3, 0);
    expect(() => counter.markPersisted(3)).toThrow(RangeError);
  });

  it('refuses an invalid initial version', () => {
    expect(() => TestCounter.restore('c-1', -1, 0)).toThrow(RangeError);
  });

  it('compares entities by type and id', () => {
    const a = TestCounter.restore('c-1', 1, 0);
    expect(a.equals(TestCounter.restore('c-1', 2, 5))).toBe(true);
    expect(a.equals(a)).toBe(true);
    expect(a.equals(TestCounter.restore('c-2', 1, 0))).toBe(false);
    expect(a.equals(undefined)).toBe(false);
  });
});

class Pair extends ValueObject<{ left: string; right: number }> {
  static of(left: string, right: number): Pair {
    return new Pair({ left, right });
  }
}

class OtherPair extends ValueObject<{ left: string; right: number }> {
  static of(left: string, right: number): OtherPair {
    return new OtherPair({ left, right });
  }
}

class Single extends ValueObject<{ left: string }> {
  static of(left: string): Single {
    return new Single({ left });
  }
}

describe('ValueObject', () => {
  it('compares by value and by type', () => {
    expect(Pair.of('a', 1).equals(Pair.of('a', 1))).toBe(true);
    expect(Pair.of('a', 1).equals(Pair.of('a', 2))).toBe(false);
    expect(Pair.of('a', 1).equals(OtherPair.of('a', 1))).toBe(false);
    expect(Pair.of('a', 1).equals(undefined)).toBe(false);
  });

  it('considers different shapes as different', () => {
    const single = Single.of('a') as unknown as Pair;
    Object.setPrototypeOf(single, Pair.prototype);
    expect(Pair.of('a', 1).equals(single)).toBe(false);
  });
});
