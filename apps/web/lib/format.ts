import type { MoneyDto } from '@cardsim/shared';

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** `{ amountMinor: 4250, currency: 'EUR' }` → `42,50 €` (fr-FR). */
export function formatMoney({ amountMinor, currency }: MoneyDto): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(amountMinor / 100);
}

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Paris',
});

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
