import type { Person } from './person.aggregate';
import type { PersonId } from './person-id';

/** Port de persistance de l'agrégat `Person` (chargé et sauvegardé complet). */
export interface PersonRepository {
  findById(id: PersonId): Promise<Person | null>;
  /**
   * Insère ou met à jour la personne et publie ses events dans la même transaction.
   * Lève `ConcurrencyError` si la version est obsolète, `EmailAlreadyUsedError` si l'email est pris.
   */
  save(person: Person): Promise<void>;
}

export const PERSON_REPOSITORY = Symbol('PersonRepository');
