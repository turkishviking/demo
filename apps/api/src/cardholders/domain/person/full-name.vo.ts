import { InvariantViolationError } from '../../../shared/domain/domain-error';
import { ValueObject } from '../../../shared/domain/value-object';

const MAX_LENGTH = 100;

/** Prénom et nom, trimés, de 1 à 100 caractères chacun. */
export class FullName extends ValueObject<{ firstName: string; lastName: string }> {
  private constructor(firstName: string, lastName: string) {
    super({ firstName, lastName });
  }

  static create(firstName: string, lastName: string): FullName {
    const first = firstName.trim();
    const last = lastName.trim();
    for (const [field, value] of [
      ['firstName', first],
      ['lastName', last],
    ] as const) {
      if (value.length === 0 || value.length > MAX_LENGTH) {
        throw new InvariantViolationError(
          'INVALID_FULL_NAME',
          `${field} must contain 1 to ${MAX_LENGTH} characters`,
          { field },
        );
      }
    }
    return new FullName(first, last);
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  override toString(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }
}
