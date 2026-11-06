import { formatDateTime, formatMoney } from './format';

/** Intl utilise des espaces insécables : on normalise pour comparer. */
const normalize = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('formatMoney', () => {
  it('formats minor units as euros in fr-FR', () => {
    expect(normalize(formatMoney({ amountMinor: 4250, currency: 'EUR' }))).toBe('42,50 €');
    expect(normalize(formatMoney({ amountMinor: 123456789, currency: 'EUR' }))).toBe(
      '1 234 567,89 €',
    );
    expect(normalize(formatMoney({ amountMinor: -5, currency: 'EUR' }))).toBe('-0,05 €');
  });
});

describe('formatDateTime', () => {
  it('formats in Europe/Paris time', () => {
    expect(formatDateTime('2026-01-15T13:05:09.000Z')).toBe('15/01/2026 14:05:09');
  });
});
