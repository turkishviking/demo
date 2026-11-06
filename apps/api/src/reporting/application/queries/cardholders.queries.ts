import type {
  GroupDetails,
  GroupListItem,
  GroupStatus,
  Page,
  PersonDetails,
  PersonListItem,
  PersonStatus,
} from '@cardsim/shared';
import { Query } from '../../../shared/application/query-bus';

export class ListPersonsQuery extends Query<Page<PersonListItem>> {
  constructor(
    readonly filter: { q?: string; groupId?: string; status?: PersonStatus } = {},
    readonly cursor?: string,
    readonly limit?: number,
  ) {
    super();
  }
}

export class GetPersonDetailsQuery extends Query<PersonDetails> {
  constructor(readonly personId: string) {
    super();
  }
}

export class ListGroupsQuery extends Query<Page<GroupListItem>> {
  constructor(
    readonly filter: { status?: GroupStatus } = {},
    readonly cursor?: string,
    readonly limit?: number,
  ) {
    super();
  }
}

export class GetGroupDetailsQuery extends Query<GroupDetails> {
  constructor(readonly groupId: string) {
    super();
  }
}
