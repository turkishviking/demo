import type { GroupLookup } from '../../src/cardholders/application/ports/group-lookup.port';
import type { PersonLookup } from '../../src/cardholders/application/ports/person-lookup.port';
import {
  EmailAlreadyUsedError,
  Group,
  GroupNameAlreadyUsedError,
  PersonAlreadyInAGroupError,
  Person,
  type Email,
  type GroupId,
  type GroupName,
  type GroupRepository,
  type GroupSnapshot,
  type PersonId,
  type PersonRepository,
  type PersonSnapshot,
  type PersonStatus,
} from '../../src/cardholders/domain';
import { ConcurrencyError } from '../../src/shared/application/concurrency-error';
import type { EventEnvelopeFactory } from '../../src/shared/application/event-envelope';
import type { EventPublisher } from '../../src/shared/application/event-publisher.port';

interface Stored<TSnapshot> {
  snapshot: TSnapshot;
  version: number;
}

/**
 * Fakes des repositories Cardholders. Même contrat que les implémentations Postgres
 * (voir `cardholders-repositories.contract.ts`) : copies à la lecture, verrou optimiste,
 * unicités, events publiés au save.
 */
export class InMemoryPersonRepository implements PersonRepository, PersonLookup {
  private readonly rows = new Map<string, Stored<PersonSnapshot>>();

  constructor(
    private readonly envelopes: EventEnvelopeFactory,
    private readonly publisher: EventPublisher,
  ) {}

  async findById(id: PersonId): Promise<Person | null> {
    const row = this.rows.get(id);
    return row ? Person.restore(row.snapshot, row.version) : null;
  }

  async save(person: Person): Promise<void> {
    const stored = this.rows.get(person.id);
    if (person.isNew ? stored !== undefined : stored?.version !== person.version) {
      throw new ConcurrencyError('Person', person.id, person.version);
    }
    const email = person.email.value;
    if (
      [...this.rows.values()].some(
        (r) => r.snapshot.id !== person.id && r.snapshot.email.value === email,
      )
    ) {
      throw new EmailAlreadyUsedError(email);
    }
    const { envelopes, nextVersion } = this.envelopes.pullFrom(person);
    this.rows.set(person.id, { snapshot: person.snapshot(), version: nextVersion });
    await this.publisher.publish(envelopes);
    person.markPersisted(nextVersion);
  }

  async statusOf(id: PersonId): Promise<PersonStatus | null> {
    return this.rows.get(id)?.snapshot.status ?? null;
  }

  async isEmailTaken(email: Email): Promise<boolean> {
    return [...this.rows.values()].some((r) => r.snapshot.email.equals(email));
  }
}

export class InMemoryGroupRepository implements GroupRepository, GroupLookup {
  private readonly rows = new Map<string, Stored<GroupSnapshot>>();

  constructor(
    private readonly envelopes: EventEnvelopeFactory,
    private readonly publisher: EventPublisher,
  ) {}

  async findById(id: GroupId): Promise<Group | null> {
    const row = this.rows.get(id);
    return row ? Group.restore(row.snapshot, row.version) : null;
  }

  async save(group: Group): Promise<void> {
    const stored = this.rows.get(group.id);
    if (group.isNew ? stored !== undefined : stored?.version !== group.version) {
      throw new ConcurrencyError('Group', group.id, group.version);
    }
    const others = [...this.rows.values()].filter((r) => r.snapshot.id !== group.id);
    const name = group.name.value.toLowerCase();
    if (others.some((r) => r.snapshot.name.value.toLowerCase() === name)) {
      throw new GroupNameAlreadyUsedError(group.name.value);
    }
    for (const { personId } of group.members) {
      const other = others.find((r) => r.snapshot.members.some((m) => m.personId === personId));
      if (other) throw new PersonAlreadyInAGroupError(personId, other.snapshot.id);
    }
    const { envelopes, nextVersion } = this.envelopes.pullFrom(group);
    this.rows.set(group.id, { snapshot: group.snapshot(), version: nextVersion });
    await this.publisher.publish(envelopes);
    group.markPersisted(nextVersion);
  }

  async findGroupOf(personId: PersonId): Promise<GroupId | null> {
    const row = [...this.rows.values()].find((r) =>
      r.snapshot.members.some((m) => m.personId === personId),
    );
    return row?.snapshot.id ?? null;
  }

  async isNameTaken(name: GroupName, except?: GroupId): Promise<boolean> {
    const lower = name.value.toLowerCase();
    return [...this.rows.values()].some(
      (r) => r.snapshot.id !== except && r.snapshot.name.value.toLowerCase() === lower,
    );
  }
}
