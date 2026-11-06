import { InvariantViolationError } from './domain-error';
import { ValueObject } from './value-object';

export const SUPPORTED_CURRENCIES = ['EUR'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export function isCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Montant en unités mineures entières (centimes) + devise.
 * Jamais de flottant : toute l'arithmétique se fait sur des entiers sûrs.
 * Un `Money` peut être négatif (ex. un écart) ; les règles métier décident si c'est permis.
 */
export class Money extends ValueObject<{ amountMinor: number; currency: Currency }> {
  private constructor(amountMinor: number, currency: Currency) {
    super({ amountMinor, currency });
  }

  static of(amountMinor: number, currency: string): Money {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new InvariantViolationError(
        'INVALID_AMOUNT',
        `Amount must be a safe integer of minor units, got ${amountMinor}`,
        { amountMinor },
      );
    }
    if (!isCurrency(currency)) {
      throw new InvariantViolationError(
        'UNSUPPORTED_CURRENCY',
        `Unsupported currency ${currency}`,
        {
          currency,
        },
      );
    }
    return new Money(amountMinor, currency);
  }

  static eur(amountMinor: number): Money {
    return Money.of(amountMinor, 'EUR');
  }

  static zero(currency: Currency = 'EUR'): Money {
    return new Money(0, currency);
  }

  get amountMinor(): number {
    return this.props.amountMinor;
  }

  get currency(): Currency {
    return this.props.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinor - other.amountMinor, this.currency);
  }

  isZero(): boolean {
    return this.amountMinor === 0;
  }

  isPositive(): boolean {
    return this.amountMinor > 0;
  }

  isNegative(): boolean {
    return this.amountMinor < 0;
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor > other.amountMinor;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor;
  }

  isLessThan(other: Money): boolean {
    return other.isGreaterThan(this);
  }

  isLessThanOrEqual(other: Money): boolean {
    return other.isGreaterThanOrEqual(this);
  }

  toJSON(): { amountMinor: number; currency: Currency } {
    return { amountMinor: this.amountMinor, currency: this.currency };
  }

  override toString(): string {
    return `${this.amountMinor} ${this.currency} (minor units)`;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new InvariantViolationError(
        'CURRENCY_MISMATCH',
        `Cannot combine ${this.currency} and ${other.currency}`,
        { left: this.currency, right: other.currency },
      );
    }
  }
}
