/**
 * Erreur technique : l'agrégat a été modifié entre son chargement et son save
 * (verrou optimiste). Ce n'est pas une `DomainError` : le `CommandBus` rejoue la commande.
 */
export class ConcurrencyError extends Error {
  readonly code = 'CONCURRENT_MODIFICATION';

  constructor(
    readonly aggregateType: string,
    readonly aggregateId: string,
    readonly expectedVersion: number,
  ) {
    super(
      `${aggregateType} ${aggregateId} was modified concurrently (expected v${expectedVersion})`,
    );
    this.name = 'ConcurrencyError';
  }
}
