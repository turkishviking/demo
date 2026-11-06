import type {
  GroupDetails,
  GroupListItem,
  GroupStatus,
  PersonDetails,
  PersonListItem,
  PersonStatus,
} from '@cardsim/shared';
import type { Cursor } from '../pagination';

export interface PersonFilter {
  q?: string;
  groupId?: string;
  status?: PersonStatus;
}

export interface GroupFilter {
  status?: GroupStatus;
}

/** Lecture des read models Cardholders, triés par date de création décroissante. */
export interface CardholdersReadModel {
  listPersons(filter: PersonFilter, after: Cursor | null, limit: number): Promise<PersonListItem[]>;
  getPerson(id: string): Promise<PersonDetails | null>;
  listGroups(filter: GroupFilter, after: Cursor | null, limit: number): Promise<GroupListItem[]>;
  getGroup(id: string): Promise<GroupDetails | null>;
}

export const CARDHOLDERS_READ_MODEL = Symbol('CardholdersReadModel');
