import type { Group } from './group.aggregate';
import type { GroupId } from './group-id';

/** Port de persistance de l'agrégat `Group`, membres compris. */
export interface GroupRepository {
  findById(id: GroupId): Promise<Group | null>;
  /**
   * Insère ou met à jour le groupe et ses membres, et publie ses events dans la même transaction.
   * Lève `ConcurrencyError` si la version est obsolète, `GroupNameAlreadyUsedError` si le nom
   * est pris, `PersonAlreadyInAGroupError` si un membre appartient déjà à un autre groupe.
   */
  save(group: Group): Promise<void>;
}

export const GROUP_REPOSITORY = Symbol('GroupRepository');
