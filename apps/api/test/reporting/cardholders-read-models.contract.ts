import { CardholdersEventTypes as T } from '../../src/cardholders/contracts/cardholders.events';
import type { EventEnvelope } from '../../src/shared/application/event-envelope';
import { ProjectionNotReadyError } from '../../src/reporting/application/errors';
import { encodeCursor } from '../../src/reporting/application/pagination';
import type { CardholdersProjectionStore } from '../../src/reporting/application/ports/cardholders-projection-store.port';
import type { CardholdersReadModel } from '../../src/reporting/application/ports/cardholders-read-model.port';
import { CardholdersProjection } from '../../src/reporting/application/projections/cardholders.projection';

export interface CardholdersReadModelsHarness {
  store: CardholdersProjectionStore;
  readModel: CardholdersReadModel;
  /** Exécute `work` dans une transaction, comme l'inbox. */
  run<R>(work: () => Promise<R>): Promise<R>;
}

const P1 = '00000000-0000-7000-8000-000000000001';
const P2 = '00000000-0000-7000-8000-000000000002';
const P3 = '00000000-0000-7000-8000-000000000003';
const G1 = '00000000-0000-7000-8000-0000000000a1';
const G2 = '00000000-0000-7000-8000-0000000000a2';

let sequence = 0;
function envelope<P>(type: string, aggregateId: string, aggregateVersion: number, payload: P) {
  return {
    eventId: `00000000-0000-7000-9000-${(++sequence).toString(16).padStart(12, '0')}`,
    type,
    version: 1,
    aggregateId,
    aggregateVersion,
    occurredAt: new Date(Date.UTC(2026, 0, 1, 10, 0, sequence)).toISOString(),
    correlationId: 'corr',
    causationId: null,
    payload,
  } satisfies EventEnvelope<P>;
}

const registered = (id: string, first: string, last: string, minute: number) =>
  envelope(T.PersonRegistered, id, 1, {
    personId: id,
    firstName: first,
    lastName: last,
    email: `${first.toLowerCase()}@example.com`,
    registeredAt: new Date(Date.UTC(2026, 0, 1, 9, minute)).toISOString(),
  });

/**
 * Contrat « projection + read model » : rejouer des events de Cardholders dans la projection
 * produit les lectures attendues, quelle que soit l'implémentation (in-memory ou SQL).
 */
export function describeCardholdersReadModelsContract(
  name: string,
  setup: () => Promise<CardholdersReadModelsHarness>,
): void {
  describe(`${name} — contrat des read models Cardholders`, () => {
    let h: CardholdersReadModelsHarness;
    let projection: CardholdersProjection;
    const apply = <P>(handler: (e: EventEnvelope<P>) => Promise<void>, e: EventEnvelope<P>) =>
      h.run(() => handler.call(projection, e));

    beforeEach(async () => {
      h = await setup();
      projection = new CardholdersProjection(h.store);
    });

    const seedPeople = async () => {
      await apply(projection.personRegistered, registered(P1, 'Ada', 'Lovelace', 1));
      await apply(projection.personRegistered, registered(P2, 'Grace', 'Hopper', 2));
      await apply(projection.personRegistered, registered(P3, 'Alan', 'Turing', 3));
    };

    it('projects registered persons, newest first', async () => {
      await seedPeople();
      const persons = await h.readModel.listPersons({}, null, 10);
      expect(persons.map((p) => p.id)).toEqual([P3, P2, P1]);
      expect(persons[2]).toEqual({
        id: P1,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        status: 'ACTIVE',
        registeredAt: '2026-01-01T09:01:00.000Z',
        group: null,
      });
      expect(await h.readModel.getPerson(P2)).toMatchObject({ firstName: 'Grace' });
      expect(await h.readModel.getPerson('00000000-0000-7000-8000-00000000ffff')).toBeNull();
    });

    it('paginates with an exclusive cursor', async () => {
      await seedPeople();
      const first = await h.readModel.listPersons({}, null, 2);
      const last = first.at(-1)!;
      const next = await h.readModel.listPersons(
        {},
        { sortKey: last.registeredAt, id: last.id },
        2,
      );
      expect(first.map((p) => p.id)).toEqual([P3, P2]);
      expect(next.map((p) => p.id)).toEqual([P1]);
      expect(encodeCursor({ sortKey: last.registeredAt, id: last.id })).toEqual(expect.any(String));
    });

    it('filters persons by text, status and group', async () => {
      await seedPeople();
      await apply(
        projection.personDeactivated,
        envelope(T.PersonDeactivated, P2, 2, { personId: P2 }),
      );
      await apply(
        projection.groupCreated,
        envelope(T.GroupCreated, G1, 1, { groupId: G1, name: 'Team', maxMembers: 5 }),
      );
      await apply(
        projection.personJoinedGroup,
        envelope(T.PersonJoinedGroup, G1, 2, {
          groupId: G1,
          personId: P3,
          joinedAt: '2026-01-02T00:00:00.000Z',
        }),
      );

      const ids = async (filter: Parameters<CardholdersReadModel['listPersons']>[0]) =>
        (await h.readModel.listPersons(filter, null, 10)).map((p) => p.id);
      expect(await ids({ q: 'LOVE' })).toEqual([P1]);
      expect(await ids({ q: 'grace@' })).toEqual([P2]);
      expect(await ids({ q: '100%' })).toEqual([]);
      expect(await ids({ status: 'DEACTIVATED' })).toEqual([P2]);
      expect(await ids({ status: 'ACTIVE' })).toEqual([P3, P1]);
      expect(await ids({ groupId: G1 })).toEqual([P3]);
    });

    it('ignores replayed or stale person events (version check)', async () => {
      await seedPeople();
      await apply(
        projection.personRenamed,
        envelope(T.PersonRenamed, P1, 3, { personId: P1, firstName: 'Ada', lastName: 'King' }),
      );
      await apply(
        projection.personRenamed,
        envelope(T.PersonRenamed, P1, 2, { personId: P1, firstName: 'Old', lastName: 'Name' }),
      );
      await apply(projection.personRegistered, registered(P1, 'Again', 'Registered', 1));
      expect(await h.readModel.getPerson(P1)).toMatchObject({ firstName: 'Ada', lastName: 'King' });
    });

    it('projects groups, their capacity, members and archiving', async () => {
      await seedPeople();
      await apply(
        projection.groupCreated,
        envelope(T.GroupCreated, G1, 1, { groupId: G1, name: 'Alpha', maxMembers: 3 }),
      );
      await apply(
        projection.groupCreated,
        envelope(T.GroupCreated, G2, 1, { groupId: G2, name: 'Beta', maxMembers: 10 }),
      );
      const join = (groupId: string, personId: string, v: number) =>
        apply(
          projection.personJoinedGroup,
          envelope(T.PersonJoinedGroup, groupId, v, {
            groupId,
            personId,
            joinedAt: '2026-01-02T00:00:00.000Z',
          }),
        );
      await join(G1, P1, 2);
      await join(G1, P2, 3);
      await apply(
        projection.groupCapacityChanged,
        envelope(T.GroupCapacityChanged, G1, 4, { groupId: G1, maxMembers: 2 }),
      );
      await apply(
        projection.groupRenamed,
        envelope(T.GroupRenamed, G1, 5, { groupId: G1, name: 'Alpha+' }),
      );

      const g1 = await h.readModel.getGroup(G1);
      expect(g1).toMatchObject({ name: 'Alpha+', maxMembers: 2, memberCount: 2, status: 'ACTIVE' });
      expect(g1?.members.map((m) => m.id)).toEqual([P2, P1]); // tri par nom : Hopper, Lovelace
      expect((await h.readModel.getPerson(P1))?.group).toEqual({ id: G1, name: 'Alpha+' });

      // Rejouer un event déjà appliqué ne recompte pas le membre
      await join(G1, P2, 3);
      expect((await h.readModel.getGroup(G1))?.memberCount).toBe(2);

      await apply(
        projection.personLeftGroup,
        envelope(T.PersonLeftGroup, G1, 6, { groupId: G1, personId: P1 }),
      );
      await apply(
        projection.personLeftGroup,
        envelope(T.PersonLeftGroup, G1, 7, { groupId: G1, personId: P2 }),
      );
      await apply(projection.groupArchived, envelope(T.GroupArchived, G1, 8, { groupId: G1 }));

      expect(await h.readModel.getGroup(G1)).toMatchObject({
        memberCount: 0,
        status: 'ARCHIVED',
        members: [],
      });
      expect((await h.readModel.getPerson(P1))?.group).toBeNull();
      expect(
        (await h.readModel.listGroups({ status: 'ACTIVE' }, null, 10)).map((g) => g.id),
      ).toEqual([G2]);
      expect((await h.readModel.listGroups({}, null, 10)).map((g) => g.id)).toEqual([G2, G1]);
      expect(await h.readModel.getGroup('00000000-0000-7000-8000-00000000ffff')).toBeNull();
    });

    it('keeps the new group when events of two groups arrive out of order', async () => {
      await seedPeople();
      await apply(
        projection.groupCreated,
        envelope(T.GroupCreated, G1, 1, { groupId: G1, name: 'Alpha', maxMembers: 3 }),
      );
      await apply(
        projection.groupCreated,
        envelope(T.GroupCreated, G2, 1, { groupId: G2, name: 'Beta', maxMembers: 3 }),
      );
      await apply(
        projection.personJoinedGroup,
        envelope(T.PersonJoinedGroup, G1, 2, {
          groupId: G1,
          personId: P1,
          joinedAt: '2026-01-02T00:00:00.000Z',
        }),
      );
      // P1 quitte Alpha puis rejoint Beta, mais Beta est livré en premier
      await apply(
        projection.personJoinedGroup,
        envelope(T.PersonJoinedGroup, G2, 2, {
          groupId: G2,
          personId: P1,
          joinedAt: '2026-01-03T00:00:00.000Z',
        }),
      );
      await apply(
        projection.personLeftGroup,
        envelope(T.PersonLeftGroup, G1, 3, { groupId: G1, personId: P1 }),
      );

      expect((await h.readModel.getPerson(P1))?.group).toEqual({ id: G2, name: 'Beta' });
    });

    it('fails (and will be retried) when a member is not projected yet', async () => {
      await apply(
        projection.groupCreated,
        envelope(T.GroupCreated, G1, 1, { groupId: G1, name: 'Alpha', maxMembers: 3 }),
      );
      await expect(
        apply(
          projection.personJoinedGroup,
          envelope(T.PersonJoinedGroup, G1, 2, {
            groupId: G1,
            personId: P1,
            joinedAt: '2026-01-02T00:00:00.000Z',
          }),
        ),
      ).rejects.toBeInstanceOf(ProjectionNotReadyError);
    });
  });
}
