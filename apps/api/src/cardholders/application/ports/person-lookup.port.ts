import type { Email } from '../../domain/person/email.vo';
import type { PersonStatus } from '../../domain/person/person.aggregate';
import type { PersonId } from '../../domain/person/person-id';

/** Lecture des personnes du context, sans charger l'agrégat (tables write de Cardholders). */
export interface PersonLookup {
  /** Statut de la personne, ou `null` si elle n'existe pas. */
  statusOf(id: PersonId): Promise<PersonStatus | null>;
  isEmailTaken(email: Email): Promise<boolean>;
}

export const PERSON_LOOKUP = Symbol('PersonLookup');
