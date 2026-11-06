/**
 * Fait métier enregistré par un agrégat.
 *
 * Le domaine ne connaît ni l'horloge ni le générateur d'ids : l'identifiant, la date,
 * la version d'agrégat et la corrélation sont ajoutés par la couche application
 * lors de la mise en enveloppe (voir `EventEnvelopeFactory`).
 */
export interface DomainEvent<TPayload = unknown> {
  /** Préfixé par le context, au passé : `cards.CardBlocked`. */
  readonly type: string;
  /** Version du schéma de payload. */
  readonly version: number;
  /** Primitives sérialisables uniquement. */
  readonly payload: TPayload;
}
