import { InvariantViolationError } from './domain-error';
import { isCurrency, Money } from './money';

describe('Money', () => {
  it('stores an integer amount of minor units with its currency', () => {
    const money = Money.eur(4250);
    expect(money.amountMinor).toBe(4250);
    expect(money.currency).toBe('EUR');
    expect(money.toJSON()).toEqual({ amountMinor: 4250, currency: 'EUR' });
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects non safe-integer amount %p',
    (amount) => {
      expect(() => Money.eur(amount)).toThrow(
        expect.objectContaining({ code: 'INVALID_AMOUNT' }) as unknown as Error,
      );
    },
  );

  it('rejects an unsupported currency', () => {
    expect(() => Money.of(100, 'USD')).toThrow(InvariantViolationError);
    expect(isCurrency('EUR')).toBe(true);
    expect(isCurrency('USD')).toBe(false);
  });

  it('adds and subtracts without floating point errors', () => {
    expect(Money.eur(10).add(Money.eur(20)).amountMinor).toBe(30);
    expect(Money.eur(10).subtract(Money.eur(25)).amountMinor).toBe(-15);
  });

  it('refuses to combine different currencies', () => {
    const fake = Object.create(Money.prototype, {
      props: { value: { amountMinor: 1, currency: 'USD' } },
    }) as Money;
    expect(() => Money.eur(1).add(fake)).toThrow(
      expect.objectContaining({ code: 'CURRENCY_MISMATCH' }) as unknown as Error,
    );
  });

  it('compares amounts', () => {
    const ten = Money.eur(1000);
    const twenty = Money.eur(2000);
    expect(twenty.isGreaterThan(ten)).toBe(true);
    expect(ten.isGreaterThan(ten)).toBe(false);
    expect(ten.isGreaterThanOrEqual(ten)).toBe(true);
    expect(ten.isLessThan(twenty)).toBe(true);
    expect(ten.isLessThanOrEqual(ten)).toBe(true);
    expect(twenty.isLessThanOrEqual(ten)).toBe(false);
  });

  it('exposes sign helpers', () => {
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.eur(1).isPositive()).toBe(true);
    expect(Money.eur(-1).isNegative()).toBe(true);
    expect(Money.zero().isPositive()).toBe(false);
  });

  it('is compared by value', () => {
    expect(Money.eur(100).equals(Money.eur(100))).toBe(true);
    expect(Money.eur(100).equals(Money.eur(101))).toBe(false);
    expect(Money.eur(100).equals(null)).toBe(false);
    expect(Money.eur(100).toString()).toBe('100 EUR (minor units)');
  });
});
