import type { GroupStatus, PersonStatus } from '@cardsim/shared';

export interface ProjectedPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  registeredAt: string;
  version: number;
}

export interface ProjectedGroup {
  id: string;
  name: string;
  maxMembers: number;
  createdAt: string;
  version: number;
}

/**
 * Écriture des read models `rm_people` / `rm_groups`. Les mises à jour versionnées ne
 * s'appliquent que si `version` est plus récente que celle de la ligne : un event en retard
 * ou rejoué est ignoré (projection idempotente).
 */
export interface CardholdersProjectionStore {
  insertPerson(person: ProjectedPerson): Promise<void>;
  updatePerson(
    id: string,
    changes: { firstName?: string; lastName?: string; status?: PersonStatus },
    version: number,
  ): Promise<void>;
  /** Renvoie `false` si la personne n'est pas (encore) projetée. */
  setPersonGroup(personId: string, groupId: string): Promise<boolean>;
  /** Ne retire le groupe que s'il s'agit encore de `groupId`. */
  clearPersonGroup(personId: string, groupId: string): Promise<void>;

  insertGroup(group: ProjectedGroup): Promise<void>;
  /** Renvoie `false` si la mise à jour est ignorée (version déjà appliquée). */
  updateGroup(
    id: string,
    changes: {
      name?: string;
      maxMembers?: number;
      status?: GroupStatus;
      memberCountDelta?: number;
    },
    version: number,
  ): Promise<boolean>;
  renameGroupOfPeople(groupId: string, name: string): Promise<void>;
}

export const CARDHOLDERS_PROJECTION_STORE = Symbol('CardholdersProjectionStore');
