/** Seule source de temps autorisée dans `domain` et `application`. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('Clock');
