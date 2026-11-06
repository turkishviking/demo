export interface IdGenerator {
  /** Identifiant unique (UUID v7 en production). */
  next(): string;
}

export const ID_GENERATOR = Symbol('IdGenerator');
