import type {
  GroupDetails,
  GroupListItem,
  GroupMember,
  GroupStatus,
  PersonDetails,
  PersonListItem,
  PersonStatus,
} from '@cardsim/shared';
import { sql } from '../../shared/infrastructure/database/sql';
import type { TransactionContext } from '../../shared/infrastructure/database/transaction-context';
import { InvalidCursorError } from '../application/errors';
import type { Cursor } from '../application/pagination';
import type {
  CardholdersReadModel,
  GroupFilter,
  PersonFilter,
} from '../application/ports/cardholders-read-model.port';

interface PersonRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: PersonStatus;
  registered_at: Date;
  group_id: string | null;
  group_name: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  max_members: number;
  member_count: number;
  status: GroupStatus;
  created_at: Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Paramètres SQL d'un curseur ; un curseur forgé donne `INVALID_CURSOR`, pas une erreur SQL. */
function cursorParams(after: Cursor | null): [string | null, string | null] {
  if (!after) return [null, null];
  if (!UUID.test(after.id) || Number.isNaN(Date.parse(after.sortKey))) {
    throw new InvalidCursorError();
  }
  return [after.sortKey, after.id];
}

/** Motif `ILIKE` d'une recherche libre, avec `%`, `_` et `\` échappés. */
const containsPattern = (q: string | undefined) =>
  q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;

const PERSON_COLUMNS = `id, first_name, last_name, email, status, registered_at, group_id, group_name`;
const GROUP_COLUMNS = `id, name, max_members, member_count, status, created_at`;

const toPerson = (r: PersonRow): PersonListItem => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  status: r.status,
  registeredAt: r.registered_at.toISOString(),
  group: r.group_id && r.group_name ? { id: r.group_id, name: r.group_name } : null,
});

const toGroup = (r: GroupRow): GroupListItem => ({
  id: r.id,
  name: r.name,
  maxMembers: r.max_members,
  memberCount: r.member_count,
  status: r.status,
  createdAt: r.created_at.toISOString(),
});

/** Requêtes SQL directes sur les read models (CQRS : aucune lecture d'agrégat). */
export class SqlCardholdersReadModel implements CardholdersReadModel {
  constructor(private readonly transactions: TransactionContext) {}

  async listPersons(
    filter: PersonFilter,
    after: Cursor | null,
    limit: number,
  ): Promise<PersonListItem[]> {
    const [afterAt, afterId] = cursorParams(after);
    const { rows } = await sql<PersonRow>(
      this.transactions.current(),
      `SELECT ${PERSON_COLUMNS} FROM reporting.rm_people
        WHERE ($1::text IS NULL OR (first_name || ' ' || last_name || ' ' || email) ILIKE $1)
          AND ($2::uuid IS NULL OR group_id = $2::uuid)
          AND ($3::text IS NULL OR status = $3)
          AND ($4::timestamptz IS NULL OR (registered_at, id) < ($4::timestamptz, $5::uuid))
        ORDER BY registered_at DESC, id DESC
        LIMIT $6`,
      [
        containsPattern(filter.q),
        filter.groupId ?? null,
        filter.status ?? null,
        afterAt,
        afterId,
        limit,
      ],
    );
    return rows.map(toPerson);
  }

  async getPerson(id: string): Promise<PersonDetails | null> {
    const { rows } = await sql<PersonRow>(
      this.transactions.current(),
      `SELECT ${PERSON_COLUMNS} FROM reporting.rm_people WHERE id = $1`,
      [id],
    );
    return rows[0] ? toPerson(rows[0]) : null;
  }

  async listGroups(
    filter: GroupFilter,
    after: Cursor | null,
    limit: number,
  ): Promise<GroupListItem[]> {
    const [afterAt, afterId] = cursorParams(after);
    const { rows } = await sql<GroupRow>(
      this.transactions.current(),
      `SELECT ${GROUP_COLUMNS} FROM reporting.rm_groups
        WHERE ($1::text IS NULL OR status = $1)
          AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::uuid))
        ORDER BY created_at DESC, id DESC
        LIMIT $4`,
      [filter.status ?? null, afterAt, afterId, limit],
    );
    return rows.map(toGroup);
  }

  async getGroup(id: string): Promise<GroupDetails | null> {
    const manager = this.transactions.current();
    const { rows } = await sql<GroupRow>(
      manager,
      `SELECT ${GROUP_COLUMNS} FROM reporting.rm_groups WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const members = await sql<PersonRow>(
      manager,
      `SELECT ${PERSON_COLUMNS} FROM reporting.rm_people
        WHERE group_id = $1 ORDER BY last_name, first_name, id`,
      [id],
    );
    return {
      ...toGroup(rows[0]),
      members: members.rows.map((m): GroupMember => ({
        id: m.id,
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        status: m.status,
      })),
    };
  }
}
