import type { GroupLookup } from '../../src/cardholders/application/ports/group-lookup.port';
import type { PersonLookup } from '../../src/cardholders/application/ports/person-lookup.port';
import {
  Email,
  FullName,
  GroupCapacity,
  GroupName,
  type GroupRepository,
  type PersonRepository,
} from '../../src/cardholders/domain';
import { ConcurrencyError } from '../../src/shared/application/concurrency-error';
import { aGroup, aPerson } from './builders';

export interface CardholdersRepositoriesHarness {
  persons: PersonRepository;
  personLookup: PersonLookup;
  groups: GroupRepository;
  groupLookup: GroupLookup;
  /** Exécute `work` dans une transaction (UnitOfWork). */
  run<T>(work: () => Promise<T>): Promise<T>;
  /** Events publiés (outbox ou publisher in-memory), dans l'ordre. */
  publishedEvents(): Promise<
    Array<{ type: string; aggregateId: string; aggregateVersion: number }>
  >;
}

/**
 * Comportements attendus de toute implémentation des repositories Cardholders
 * (docs/04-architecture/ports-and-adapters.md#tests-de-contrat).
 */
export function describeCardholdersRepositoriesContract(
  name: string,
  setup: () => Promise<CardholdersRepositoriesHarness>,
): void {
  describe(`${name} — contrat des repositories Cardholders`, () => {
    let h: CardholdersRepositoriesHarness;

    beforeEach(async () => {
      h = await setup();
    });

    const savedPerson = async (email?: string) => {
      const builder = aPerson().unsaved();
      const person = (email ? builder.withEmail(email) : builder).build();
      await h.run(() => h.persons.save(person));
      return person;
    };

    describe('PersonRepository', () => {
      it('round-trips a person and publishes its events', async () => {
        const person = await savedPerson('ada@example.com');

        const loaded = await h.persons.findById(person.id);
        expect(loaded?.snapshot()).toEqual(person.snapshot());
        expect(loaded?.version).toBe(1);
        expect(person.version).toBe(1);
        expect(await h.publishedEvents()).toEqual([
          { type: 'cardholders.PersonRegistered', aggregateId: person.id, aggregateVersion: 1 },
        ]);
      });

      it('returns null for an unknown person', async () => {
        expect(await h.persons.findById(aPerson().build().id)).toBeNull();
      });

      it('persists changes and increments the version per event', async () => {
        const person = await savedPerson();
        const loaded = (await h.persons.findById(person.id))!;
        loaded.rename(FullName.create('Grace', 'Hopper'));
        loaded.deactivate();
        await h.run(() => h.persons.save(loaded));

        const reloaded = (await h.persons.findById(person.id))!;
        expect(reloaded.fullName.toString()).toBe('Grace Hopper');
        expect(reloaded.status).toBe('DEACTIVATED');
        expect(reloaded.version).toBe(3);
        expect((await h.publishedEvents()).map((e) => e.aggregateVersion)).toEqual([1, 2, 3]);
      });

      it('rejects a stale version with ConcurrencyError (optimistic lock)', async () => {
        const person = await savedPerson();
        const first = (await h.persons.findById(person.id))!;
        const second = (await h.persons.findById(person.id))!;
        first.rename(FullName.create('Grace', 'Hopper'));
        await h.run(() => h.persons.save(first));

        second.deactivate();
        await expect(h.run(() => h.persons.save(second))).rejects.toBeInstanceOf(ConcurrencyError);
        expect((await h.persons.findById(person.id))!.status).toBe('ACTIVE');
      });

      it('rejects a second person with the same email (P2)', async () => {
        await savedPerson('ada@example.com');
        const duplicate = aPerson().unsaved().withEmail('ADA@example.com').build();
        await expect(h.run(() => h.persons.save(duplicate))).rejects.toMatchObject({
          code: 'EMAIL_ALREADY_USED',
        });
        expect(await h.persons.findById(duplicate.id)).toBeNull();
      });
    });

    describe('PersonLookup', () => {
      it('reads the status and email usage', async () => {
        const person = await savedPerson('ada@example.com');
        expect(await h.personLookup.statusOf(person.id)).toBe('ACTIVE');
        expect(await h.personLookup.statusOf(aPerson().build().id)).toBeNull();
        expect(await h.personLookup.isEmailTaken(Email.create('Ada@Example.com'))).toBe(true);
        expect(await h.personLookup.isEmailTaken(Email.create('grace@example.com'))).toBe(false);
      });
    });

    describe('GroupRepository', () => {
      const at = new Date('2026-02-01T09:00:00.000Z');

      it('round-trips a group with its members', async () => {
        const [p1, p2] = [await savedPerson(), await savedPerson()];
        const group = aGroup().unsaved().named('Famille Martin').withCapacity(3).build();
        group.addMember(p1.id, at);
        group.addMember(p2.id, new Date(at.getTime() + 1000));
        await h.run(() => h.groups.save(group));

        const loaded = await h.groups.findById(group.id);
        expect(loaded?.snapshot()).toEqual(group.snapshot());
        expect(loaded?.version).toBe(3);
        expect((await h.publishedEvents()).filter((e) => e.aggregateId === group.id)).toEqual([
          { type: 'cardholders.GroupCreated', aggregateId: group.id, aggregateVersion: 1 },
          { type: 'cardholders.PersonJoinedGroup', aggregateId: group.id, aggregateVersion: 2 },
          { type: 'cardholders.PersonJoinedGroup', aggregateId: group.id, aggregateVersion: 3 },
        ]);
      });

      it('returns null for an unknown group', async () => {
        expect(await h.groups.findById(aGroup().build().id)).toBeNull();
      });

      it('synchronizes removed and added members', async () => {
        const [p1, p2] = [await savedPerson(), await savedPerson()];
        const group = aGroup().unsaved().build();
        group.addMember(p1.id, at);
        await h.run(() => h.groups.save(group));

        const loaded = (await h.groups.findById(group.id))!;
        loaded.removeMember(p1.id);
        loaded.addMember(p2.id, at);
        loaded.changeCapacity(GroupCapacity.create(2));
        loaded.rename(GroupName.create('Renamed'));
        await h.run(() => h.groups.save(loaded));

        const reloaded = (await h.groups.findById(group.id))!;
        expect(reloaded.members.map((m) => m.personId)).toEqual([p2.id]);
        expect(reloaded.capacity.value).toBe(2);
        expect(reloaded.name.value).toBe('Renamed');
      });

      it('rejects a stale version with ConcurrencyError (optimistic lock)', async () => {
        const group = aGroup().unsaved().build();
        await h.run(() => h.groups.save(group));
        const first = (await h.groups.findById(group.id))!;
        const second = (await h.groups.findById(group.id))!;
        first.rename(GroupName.create('First'));
        await h.run(() => h.groups.save(first));
        second.rename(GroupName.create('Second'));
        await expect(h.run(() => h.groups.save(second))).rejects.toBeInstanceOf(ConcurrencyError);
      });

      it('rejects a group name already used, case-insensitively', async () => {
        await h.run(() => h.groups.save(aGroup().unsaved().named('Alpha').build()));
        await expect(
          h.run(() => h.groups.save(aGroup().unsaved().named('ALPHA').build())),
        ).rejects.toMatchObject({ code: 'GROUP_NAME_ALREADY_USED' });
      });

      it('rejects a person who is a member of another group (one group per person)', async () => {
        const person = await savedPerson();
        const alpha = aGroup().unsaved().build();
        alpha.addMember(person.id, at);
        await h.run(() => h.groups.save(alpha));

        const beta = aGroup().unsaved().build();
        beta.addMember(person.id, at);
        await expect(h.run(() => h.groups.save(beta))).rejects.toMatchObject({
          code: 'PERSON_ALREADY_IN_A_GROUP',
          context: expect.objectContaining({ personId: person.id }),
        });
        expect(await h.groups.findById(beta.id)).toBeNull();
      });
    });

    describe('GroupLookup', () => {
      it('finds the group of a person and checks name usage', async () => {
        const person = await savedPerson();
        const group = aGroup().unsaved().named('Alpha').build();
        group.addMember(person.id, new Date('2026-02-01T09:00:00.000Z'));
        await h.run(() => h.groups.save(group));

        expect(await h.groupLookup.findGroupOf(person.id)).toBe(group.id);
        expect(await h.groupLookup.findGroupOf((await savedPerson()).id)).toBeNull();
        expect(await h.groupLookup.isNameTaken(GroupName.create('alpha'))).toBe(true);
        expect(await h.groupLookup.isNameTaken(GroupName.create('alpha'), group.id)).toBe(false);
        expect(await h.groupLookup.isNameTaken(GroupName.create('Beta'))).toBe(false);
      });
    });
  });
}
