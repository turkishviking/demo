/** Représentation d'un montant dans l'API : unités mineures entières + devise ISO 4217. */
export interface MoneyDto {
  amountMinor: number;
  currency: 'EUR';
}
