import { AggregateRoot } from '../../src/shared/domain/aggregate-root';
import type { Brand } from '../../src/shared/domain/brand';
import { InvariantViolationError } from '../../src/shared/domain/domain-error';

export type CounterId = Brand<string, 'CounterId'>;

/**
 * Agrégat minimal, réservé aux tests du socle (repository, outbox, relais) en attendant
 * les vrais agrégats des bounded contexts.
 */
export class TestCounter extends AggregateRoot<CounterId> {
  private constructor(
    id: CounterId,
    version: number,
    private _value: number,
  ) {
    super(id, version);
  }

  static create(id: string): TestCounter {
    const counter = new TestCounter(id as CounterId, 0, 0);
    counter.record({ type: 'test.CounterCreated', version: 1, payload: { counterId: id } });
    return counter;
  }

  static restore(id: string, version: number, value: number): TestCounter {
    return new TestCounter(id as CounterId, version, value);
  }

  get value(): number {
    return this._value;
  }

  increment(by = 1): void {
    if (by <= 0) throw new InvariantViolationError('INVALID_INCREMENT', 'Increment must be > 0');
    this._value += by;
    this.record({
      type: 'test.CounterIncremented',
      version: 1,
      payload: { counterId: this.id, by, value: this._value },
    });
  }
}
