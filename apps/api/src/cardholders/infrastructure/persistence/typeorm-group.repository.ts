import { ConcurrencyError } from '../../../shared/application/concurrency-error';
import type { EventEnvelopeFactory } from '../../../shared/application/event-envelope';
import type { EventPublisher } from '../../../shared/application/event-publisher.port';
import {
  conflictingKey,
  isUniqueViolation,
} from '../../../shared/infrastructure/database/pg-errors';
import { sql } from '../../../shared/infrastructure/database/sql';
import type { TransactionContext } from '../../../shared/infrastructure/database/transaction-context';
import type { GroupLookup } from '../../application/ports/group-lookup.port';
import {
  GroupNameAlreadyUsedError,
  PersonAlreadyInAGroupError,
} from '../../domain/errors/cardholders.errors';
import { GroupCapacity } from '../../domain/group/group-capacity.vo';
import { Group, type GroupStatus } from '../../domain/group/group.aggregate';
import { GroupId } from '../../domain/group/group-id';
import { GroupName } from '../../domain/group/group-name.vo';
import type { GroupRepository } from '../../domain/group/group.repository';
import { PersonId } from '../../domain/person/person-id';

interface GroupRow {
  id: string;
  name: string;
  max_members: number;
  status: GroupStatus;
  version: number;
}

interface MemberRow {
  person_id: string;
  joined_at: Date;
}

/**
 * Persistance de `Group` et de ses membres (ADR-0003) : la racine est versionnée, les membres
 * sont synchronisés par diff (suppression des absents, insertion des nouveaux).
 */
export class TypeormGroupRepository implements GroupRepository {
  constructor(
    private readonly transactions: TransactionContext,
    private readonly envelopes: EventEnvelopeFactory,
    private readonly publisher: EventPublisher,
  ) {}

  async findById(id: GroupId): Promise<Group | null> {
    const manager = this.transactions.current();
    const { rows } = await sql<GroupRow>(
      manager,
      `SELECT id, name, max_members, status, version FROM cardholders.groups WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    const members = await sql<MemberRow>(
      manager,
      `SELECT person_id, joined_at FROM cardholders.group_members
        WHERE group_id = $1 ORDER BY joined_at, person_id`,
      [id],
    );
    return Group.restore(
      {
        id: GroupId.from(row.id),
        name: GroupName.create(row.name),
        capacity: GroupCapacity.create(row.max_members),
        status: row.status,
        members: members.rows.map((m) => ({
          personId: PersonId.from(m.person_id),
          joinedAt: m.joined_at,
        })),
      },
      row.version,
    );
  }

  async save(group: Group): Promise<void> {
    const manager = this.transactions.requireTransactional();
    const expectedVersion = group.version;
    const { envelopes, nextVersion } = this.envelopes.pullFrom(group);
    const values = [group.id, group.name.value, group.capacity.value, group.status, nextVersion];
    const members = group.members;

    try {
      if (group.isNew) {
        await sql(
          manager,
          `INSERT INTO cardholders.groups (id, name, max_members, status, version)
           VALUES ($1, $2, $3, $4, $5)`,
          values,
        );
      } else {
        const { rowCount } = await sql(
          manager,
          `UPDATE cardholders.groups SET name = $2, max_members = $3, status = $4, version = $5
            WHERE id = $1 AND version = $6`,
          [...values, expectedVersion],
        );
        if (rowCount === 0) throw new ConcurrencyError('Group', group.id, expectedVersion);
      }

      await sql(
        manager,
        `DELETE FROM cardholders.group_members
          WHERE group_id = $1 AND NOT (person_id = ANY($2::uuid[]))`,
        [group.id, members.map((m) => m.personId)],
      );
      if (members.length > 0) {
        await sql(
          manager,
          `INSERT INTO cardholders.group_members (group_id, person_id, joined_at)
           SELECT $1, person_id, joined_at
             FROM unnest($2::uuid[], $3::timestamptz[]) AS m(person_id, joined_at)
           ON CONFLICT (group_id, person_id) DO NOTHING`,
          [group.id, members.map((m) => m.personId), members.map((m) => m.joinedAt)],
        );
      }
    } catch (error) {
      if (isUniqueViolation(error, 'groups_name_unique')) {
        throw new GroupNameAlreadyUsedError(group.name.value);
      }
      if (isUniqueViolation(error, 'group_members_person_unique')) {
        throw new PersonAlreadyInAGroupError(conflictingKey(error) ?? 'unknown');
      }
      throw error;
    }

    await this.publisher.publish(envelopes);
    group.markPersisted(nextVersion);
  }
}

export class SqlGroupLookup implements GroupLookup {
  constructor(private readonly transactions: TransactionContext) {}

  async findGroupOf(personId: PersonId): Promise<GroupId | null> {
    const { rows } = await sql<{ group_id: string }>(
      this.transactions.current(),
      `SELECT group_id FROM cardholders.group_members WHERE person_id = $1`,
      [personId],
    );
    return rows[0] ? GroupId.from(rows[0].group_id) : null;
  }

  async isNameTaken(name: GroupName, except?: GroupId): Promise<boolean> {
    const { rows } = await sql(
      this.transactions.current(),
      `SELECT 1 FROM cardholders.groups
        WHERE lower(name) = lower($1) AND ($2::uuid IS NULL OR id <> $2::uuid)`,
      [name.value, except ?? null],
    );
    return rows.length > 0;
  }
}
