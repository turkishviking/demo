/**
 * Contrats publiés par le context Cardholders : seuls fichiers importables par un autre context.
 * Payloads versionnés, composés uniquement de primitives sérialisables.
 */
export const CardholdersEventTypes = {
  PersonRegistered: 'cardholders.PersonRegistered',
  PersonRenamed: 'cardholders.PersonRenamed',
  PersonDeactivated: 'cardholders.PersonDeactivated',
  GroupCreated: 'cardholders.GroupCreated',
  GroupRenamed: 'cardholders.GroupRenamed',
  GroupCapacityChanged: 'cardholders.GroupCapacityChanged',
  PersonJoinedGroup: 'cardholders.PersonJoinedGroup',
  PersonLeftGroup: 'cardholders.PersonLeftGroup',
  GroupArchived: 'cardholders.GroupArchived',
} as const;

export interface PersonRegisteredV1 {
  personId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** ISO 8601. */
  registeredAt: string;
}

export interface PersonRenamedV1 {
  personId: string;
  firstName: string;
  lastName: string;
}

export interface PersonDeactivatedV1 {
  personId: string;
}

export interface GroupCreatedV1 {
  groupId: string;
  name: string;
  maxMembers: number;
}

export interface GroupRenamedV1 {
  groupId: string;
  name: string;
}

export interface GroupCapacityChangedV1 {
  groupId: string;
  maxMembers: number;
}

export interface PersonJoinedGroupV1 {
  groupId: string;
  personId: string;
  /** ISO 8601. */
  joinedAt: string;
}

export interface PersonLeftGroupV1 {
  groupId: string;
  personId: string;
}

export interface GroupArchivedV1 {
  groupId: string;
}
