import { InvariantViolationError } from '../../../shared/domain/domain-error';
import { ValueObject } from '../../../shared/domain/value-object';

export const MIN_GROUP_CAPACITY = 1;
export const MAX_GROUP_CAPACITY = 50;
export const DEFAULT_GROUP_CAPACITY = 10;

/** Nombre maximum de membres d'un groupe : entier entre 1 et 50. */
export class GroupCapacity extends ValueObject<{ value: number }> {
  private constructor(value: number) {
    super({ value });
  }

  static create(value: number = DEFAULT_GROUP_CAPACITY): GroupCapacity {
    if (!Number.isInteger(value) || value < MIN_GROUP_CAPACITY || value > MAX_GROUP_CAPACITY) {
      throw new InvariantViolationError(
        'INVALID_GROUP_CAPACITY',
        `Group capacity must be an integer between ${MIN_GROUP_CAPACITY} and ${MAX_GROUP_CAPACITY}`,
        { value },
      );
    }
    return new GroupCapacity(value);
  }

  get value(): number {
    return this.props.value;
  }
}
