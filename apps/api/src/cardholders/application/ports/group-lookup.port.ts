import type { GroupId } from '../../domain/group/group-id';
import type { GroupName } from '../../domain/group/group-name.vo';
import type { PersonId } from '../../domain/person/person-id';

/** Lecture des groupes du context, pour les règles qui portent sur plusieurs groupes. */
export interface GroupLookup {
  /** Groupe de la personne (au plus un), ou `null`. */
  findGroupOf(personId: PersonId): Promise<GroupId | null>;
  /** Vrai si un autre groupe que `except` porte déjà ce nom (insensible à la casse). */
  isNameTaken(name: GroupName, except?: GroupId): Promise<boolean>;
}

export const GROUP_LOOKUP = Symbol('GroupLookup');
