/** Réponse d'une commande de création : `201 { id }`. */
export interface CreatedDto {
  id: string;
}

export type PersonStatus = 'ACTIVE' | 'DEACTIVATED';
export type GroupStatus = 'ACTIVE' | 'ARCHIVED';

export interface GroupRef {
  id: string;
  name: string;
}

export interface PersonListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PersonStatus;
  /** ISO 8601. */
  registeredAt: string;
  group: GroupRef | null;
}

export type PersonDetails = PersonListItem;

export interface GroupListItem {
  id: string;
  name: string;
  maxMembers: number;
  memberCount: number;
  status: GroupStatus;
  /** ISO 8601. */
  createdAt: string;
}

export interface GroupMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PersonStatus;
}

export interface GroupDetails extends GroupListItem {
  members: GroupMember[];
}

/** Codes d'erreur métier du context Cardholders. */
export type CardholdersErrorCode =
  | 'PERSON_NOT_FOUND'
  | 'PERSON_DEACTIVATED'
  | 'EMAIL_ALREADY_USED'
  | 'INVALID_FULL_NAME'
  | 'INVALID_EMAIL'
  | 'GROUP_NOT_FOUND'
  | 'GROUP_NAME_ALREADY_USED'
  | 'INVALID_GROUP_NAME'
  | 'INVALID_GROUP_CAPACITY'
  | 'GROUP_ARCHIVED'
  | 'GROUP_FULL'
  | 'PERSON_ALREADY_IN_A_GROUP'
  | 'PERSON_NOT_MEMBER'
  | 'GROUP_NOT_EMPTY'
  | 'CAPACITY_BELOW_MEMBER_COUNT';
