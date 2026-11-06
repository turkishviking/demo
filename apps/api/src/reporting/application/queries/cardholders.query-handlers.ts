import type {
  GroupDetails,
  GroupListItem,
  Page,
  PersonDetails,
  PersonListItem,
} from '@cardsim/shared';
import type { QueryHandler } from '../../../shared/application/query-bus';
import { ReadModelNotFoundError } from '../errors';
import { decodeCursor, pageSize, toPage } from '../pagination';
import type { CardholdersReadModel } from '../ports/cardholders-read-model.port';
import type {
  GetGroupDetailsQuery,
  GetPersonDetailsQuery,
  ListGroupsQuery,
  ListPersonsQuery,
} from './cardholders.queries';

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/** Retire les filtres absents ou vides (`?q=` dans l'URL). */
const withoutEmpty = <T extends object>(filter: T): Defined<T> =>
  Object.fromEntries(
    Object.entries(filter).filter(([, value]) => value !== undefined && value !== ''),
  ) as Defined<T>;

export class ListPersonsHandler implements QueryHandler<ListPersonsQuery, Page<PersonListItem>> {
  constructor(private readonly readModel: CardholdersReadModel) {}

  async execute(query: ListPersonsQuery): Promise<Page<PersonListItem>> {
    const size = pageSize(query.limit);
    const filter = withoutEmpty({ ...query.filter, q: query.filter.q?.trim() });
    const rows = await this.readModel.listPersons(filter, decodeCursor(query.cursor), size + 1);
    return toPage(rows, size, (p) => ({ sortKey: p.registeredAt, id: p.id }));
  }
}

export class GetPersonDetailsHandler implements QueryHandler<GetPersonDetailsQuery, PersonDetails> {
  constructor(private readonly readModel: CardholdersReadModel) {}

  async execute(query: GetPersonDetailsQuery): Promise<PersonDetails> {
    const person = await this.readModel.getPerson(query.personId);
    if (!person) throw new ReadModelNotFoundError('PERSON_NOT_FOUND', 'Person', query.personId);
    return person;
  }
}

export class ListGroupsHandler implements QueryHandler<ListGroupsQuery, Page<GroupListItem>> {
  constructor(private readonly readModel: CardholdersReadModel) {}

  async execute(query: ListGroupsQuery): Promise<Page<GroupListItem>> {
    const size = pageSize(query.limit);
    const rows = await this.readModel.listGroups(
      withoutEmpty(query.filter),
      decodeCursor(query.cursor),
      size + 1,
    );
    return toPage(rows, size, (g) => ({ sortKey: g.createdAt, id: g.id }));
  }
}

export class GetGroupDetailsHandler implements QueryHandler<GetGroupDetailsQuery, GroupDetails> {
  constructor(private readonly readModel: CardholdersReadModel) {}

  async execute(query: GetGroupDetailsQuery): Promise<GroupDetails> {
    const group = await this.readModel.getGroup(query.groupId);
    if (!group) throw new ReadModelNotFoundError('GROUP_NOT_FOUND', 'Group', query.groupId);
    return group;
  }
}
