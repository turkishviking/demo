import type {
  GroupDetails,
  GroupListItem,
  GroupStatus,
  PersonDetails,
  PersonListItem,
  PersonStatus,
} from '@cardsim/shared';
import type {
  CardholdersProjectionStore,
  ProjectedGroup,
  ProjectedPerson,
} from '../../src/reporting/application/ports/cardholders-projection-store.port';
import type {
  CardholdersReadModel,
  GroupFilter,
  PersonFilter,
} from '../../src/reporting/application/ports/cardholders-read-model.port';
import type { Cursor } from '../../src/reporting/application/pagination';

interface PersonRow extends ProjectedPerson {
  status: PersonStatus;
  groupId: string | null;
  groupName: string | null;
}

interface GroupRow extends ProjectedGroup {
  memberCount: number;
  status: GroupStatus;
}

/** Tri `(sortKey desc, id desc)` et curseur exclusif, comme en SQL. */
function page<T>(rows: T[], key: (r: T) => [string, string], after: Cursor | null, limit: number) {
  const time = (iso: string) => new Date(iso).getTime();
  return rows
    .filter((r) => {
      if (!after) return true;
      const [at, id] = key(r);
      return time(at) < time(after.sortKey) || (time(at) === time(after.sortKey) && id < after.id);
    })
    .sort((a, b) => {
      const [atA, idA] = key(a);
      const [atB, idB] = key(b);
      return time(atB) - time(atA) || (idB > idA ? 1 : idB < idA ? -1 : 0);
    })
    .slice(0, limit);
}

/** Fake des read models Cardholders : même contrat que les adapters SQL. */
export class InMemoryCardholdersReadModels
  implements CardholdersProjectionStore, CardholdersReadModel
{
  private readonly people = new Map<string, PersonRow>();
  private readonly groups = new Map<string, GroupRow>();

  async insertPerson(p: ProjectedPerson): Promise<void> {
    if (!this.people.has(p.id)) {
      this.people.set(p.id, { ...p, status: 'ACTIVE', groupId: null, groupName: null });
    }
  }

  async updatePerson(
    id: string,
    changes: { firstName?: string; lastName?: string; status?: PersonStatus },
    version: number,
  ): Promise<void> {
    const row = this.people.get(id);
    if (row && row.version < version) Object.assign(row, changes, { version });
  }

  async setPersonGroup(personId: string, groupId: string): Promise<boolean> {
    const row = this.people.get(personId);
    if (!row) return false;
    row.groupId = groupId;
    row.groupName = this.groups.get(groupId)?.name ?? null;
    return true;
  }

  async clearPersonGroup(personId: string, groupId: string): Promise<void> {
    const row = this.people.get(personId);
    if (row?.groupId === groupId) Object.assign(row, { groupId: null, groupName: null });
  }

  async insertGroup(g: ProjectedGroup): Promise<void> {
    if (!this.groups.has(g.id)) this.groups.set(g.id, { ...g, memberCount: 0, status: 'ACTIVE' });
  }

  async updateGroup(
    id: string,
    changes: {
      name?: string;
      maxMembers?: number;
      status?: GroupStatus;
      memberCountDelta?: number;
    },
    version: number,
  ): Promise<boolean> {
    const row = this.groups.get(id);
    if (!row || row.version >= version) return false;
    const { memberCountDelta = 0, ...rest } = changes;
    Object.assign(row, rest, { version, memberCount: row.memberCount + memberCountDelta });
    return true;
  }

  async renameGroupOfPeople(groupId: string, name: string): Promise<void> {
    for (const row of this.people.values()) if (row.groupId === groupId) row.groupName = name;
  }

  async listPersons(filter: PersonFilter, after: Cursor | null, limit: number) {
    const q = filter.q?.toLowerCase();
    const rows = [...this.people.values()].filter(
      (p) =>
        (!q || `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q)) &&
        (!filter.groupId || p.groupId === filter.groupId) &&
        (!filter.status || p.status === filter.status),
    );
    return page(rows, (p) => [p.registeredAt, p.id], after, limit).map(toPerson);
  }

  async getPerson(id: string): Promise<PersonDetails | null> {
    const row = this.people.get(id);
    return row ? toPerson(row) : null;
  }

  async listGroups(filter: GroupFilter, after: Cursor | null, limit: number) {
    const rows = [...this.groups.values()].filter(
      (g) => !filter.status || g.status === filter.status,
    );
    return page(rows, (g) => [g.createdAt, g.id], after, limit).map(toGroup);
  }

  async getGroup(id: string): Promise<GroupDetails | null> {
    const row = this.groups.get(id);
    if (!row) return null;
    const members = [...this.people.values()]
      .filter((p) => p.groupId === id)
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
      .map(({ id: personId, firstName, lastName, email, status }) => ({
        id: personId,
        firstName,
        lastName,
        email,
        status,
      }));
    return { ...toGroup(row), members };
  }
}

const toPerson = (p: PersonRow): PersonListItem => ({
  id: p.id,
  firstName: p.firstName,
  lastName: p.lastName,
  email: p.email,
  status: p.status,
  registeredAt: new Date(p.registeredAt).toISOString(),
  group: p.groupId && p.groupName ? { id: p.groupId, name: p.groupName } : null,
});

const toGroup = (g: GroupRow): GroupListItem => ({
  id: g.id,
  name: g.name,
  maxMembers: g.maxMembers,
  memberCount: g.memberCount,
  status: g.status,
  createdAt: new Date(g.createdAt).toISOString(),
});
