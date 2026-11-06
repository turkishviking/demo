import { InvariantViolationError } from '../../../shared/domain/domain-error';
import { ValueObject } from '../../../shared/domain/value-object';

const MIN_LENGTH = 2;
const MAX_LENGTH = 60;

/** Nom de groupe trimé, de 2 à 60 caractères. Son unicité est vérifiée hors de l'agrégat. */
export class GroupName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): GroupName {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      throw new InvariantViolationError(
        'INVALID_GROUP_NAME',
        `Group name must contain ${MIN_LENGTH} to ${MAX_LENGTH} characters`,
      );
    }
    return new GroupName(value);
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
