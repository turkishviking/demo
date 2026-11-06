import { DomainError, NotFoundError } from '../../shared/domain/domain-error';

/** Ressource absente du read model (inconnue, ou pas encore projetée). */
export class ReadModelNotFoundError extends NotFoundError {
  constructor(
    readonly code: string,
    resource: string,
    id: string,
  ) {
    super(`${resource} ${id} not found`, { id });
  }
}

export class InvalidCursorError extends DomainError {
  readonly code = 'INVALID_CURSOR';
  constructor() {
    super('The pagination cursor is invalid');
  }
}

/**
 * La projection reçoit un event qui dépend d'une ligne pas encore projetée (events
 * d'agrégats différents, sans ordre global). L'échec fait rejouer l'event par le relais.
 */
export class ProjectionNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectionNotReadyError';
  }
}
