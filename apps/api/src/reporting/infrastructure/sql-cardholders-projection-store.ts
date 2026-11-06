import { sql } from '../../shared/infrastructure/database/sql';
import type { TransactionContext } from '../../shared/infrastructure/database/transaction-context';
import type {
  CardholdersProjectionStore,
  ProjectedGroup,
  ProjectedPerson,
} from '../application/ports/cardholders-projection-store.port';

/** Écriture de `rm_people` / `rm_groups`, dans la transaction de l'inbox. */
export class SqlCardholdersProjectionStore implements CardholdersProjectionStore {
  constructor(private readonly transactions: TransactionContext) {}

  private get manager() {
    return this.transactions.current();
  }

  async insertPerson(p: ProjectedPerson): Promise<void> {
    await sql(
      this.manager,
      `INSERT INTO reporting.rm_people
         (id, first_name, last_name, email, registered_at, version)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.firstName, p.lastName, p.email, p.registeredAt, p.version],
    );
  }

  async updatePerson(
    id: string,
    changes: { firstName?: string; lastName?: string; status?: string },
    version: number,
  ): Promise<void> {
    await sql(
      this.manager,
      `UPDATE reporting.rm_people
          SET first_name = COALESCE($2, first_name),
              last_name  = COALESCE($3, last_name),
              status     = COALESCE($4, status),
              version    = $5
        WHERE id = $1 AND version < $5`,
      [id, changes.firstName ?? null, changes.lastName ?? null, changes.status ?? null, version],
    );
  }

  async setPersonGroup(personId: string, groupId: string): Promise<boolean> {
    const { rowCount } = await sql(
      this.manager,
      `UPDATE reporting.rm_people
          SET group_id = $2, group_name = (SELECT name FROM reporting.rm_groups WHERE id = $2)
        WHERE id = $1`,
      [personId, groupId],
    );
    return rowCount > 0;
  }

  async clearPersonGroup(personId: string, groupId: string): Promise<void> {
    await sql(
      this.manager,
      `UPDATE reporting.rm_people SET group_id = NULL, group_name = NULL
        WHERE id = $1 AND group_id = $2`,
      [personId, groupId],
    );
  }

  async insertGroup(g: ProjectedGroup): Promise<void> {
    await sql(
      this.manager,
      `INSERT INTO reporting.rm_groups (id, name, max_members, created_at, version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [g.id, g.name, g.maxMembers, g.createdAt, g.version],
    );
  }

  async updateGroup(
    id: string,
    changes: { name?: string; maxMembers?: number; status?: string; memberCountDelta?: number },
    version: number,
  ): Promise<boolean> {
    const { rowCount } = await sql(
      this.manager,
      `UPDATE reporting.rm_groups
          SET name         = COALESCE($2, name),
              max_members  = COALESCE($3, max_members),
              status       = COALESCE($4, status),
              member_count = member_count + $5,
              version      = $6
        WHERE id = $1 AND version < $6`,
      [
        id,
        changes.name ?? null,
        changes.maxMembers ?? null,
        changes.status ?? null,
        changes.memberCountDelta ?? 0,
        version,
      ],
    );
    return rowCount > 0;
  }

  async renameGroupOfPeople(groupId: string, name: string): Promise<void> {
    await sql(this.manager, `UPDATE reporting.rm_people SET group_name = $2 WHERE group_id = $1`, [
      groupId,
      name,
    ]);
  }
}
