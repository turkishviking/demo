/**
 * Violation d'une règle métier. Le `code` est stable : il est exposé dans l'API
 * (`problem+json`) et utilisé par le front pour afficher un message.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(
    message: string,
    readonly context: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Ressource métier introuvable (traduite en HTTP 404). */
export abstract class NotFoundError extends DomainError {}

/** Valeur invalide passée à un value object ou un agrégat. */
export class InvariantViolationError extends DomainError {
  readonly code: string;

  constructor(code: string, message: string, context: Record<string, unknown> = {}) {
    super(message, context);
    this.code = code;
  }
}
