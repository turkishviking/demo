import { InvariantViolationError } from '../../../shared/domain/domain-error';
import { ValueObject } from '../../../shared/domain/value-object';

// Volontairement simple : une partie locale, un @, un domaine avec au moins un point.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_LENGTH = 254;

/** Email normalisé (trimé, en minuscules) : c'est cette forme qui est unique. */
export class Email extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (value.length > MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
      throw new InvariantViolationError('INVALID_EMAIL', `"${raw}" is not a valid email`);
    }
    return new Email(value);
  }

  get value(): string {
    return this.props.value;
  }

  override toString(): string {
    return this.props.value;
  }
}
