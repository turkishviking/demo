export interface Correlation {
  /** Suit une requête ou une saga de bout en bout. */
  readonly correlationId: string;
  /** Event (ou commande) qui a directement causé le traitement courant. */
  readonly causationId: string | null;
}

/** Contexte de corrélation propagé implicitement (AsyncLocalStorage en production). */
export interface CorrelationContext {
  current(): Correlation | undefined;
  run<T>(correlation: Correlation, work: () => T): T;
}

export const CORRELATION_CONTEXT = Symbol('CorrelationContext');
