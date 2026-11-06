import type {
  GroupArchivedV1,
  GroupCapacityChangedV1,
  GroupCreatedV1,
  GroupRenamedV1,
  PersonDeactivatedV1,
  PersonJoinedGroupV1,
  PersonLeftGroupV1,
  PersonRegisteredV1,
  PersonRenamedV1,
} from '../../../cardholders/contracts/cardholders.events';
import type { EventEnvelope } from '../../../shared/application/event-envelope';
import { ProjectionNotReadyError } from '../errors';
import type { CardholdersProjectionStore } from '../ports/cardholders-projection-store.port';

/**
 * Projette les events de Cardholders dans `rm_people` et `rm_groups`.
 * Chaque méthode est appelée dans la transaction de l'inbox (exactly-once effectif).
 */
export class CardholdersProjection {
  static readonly subscriber = 'reporting.cardholders-projection';

  constructor(private readonly store: CardholdersProjectionStore) {}

  async personRegistered({ payload, aggregateVersion }: EventEnvelope<PersonRegisteredV1>) {
    await this.store.insertPerson({
      id: payload.personId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      registeredAt: payload.registeredAt,
      version: aggregateVersion,
    });
  }

  async personRenamed({ payload, aggregateVersion }: EventEnvelope<PersonRenamedV1>) {
    await this.store.updatePerson(
      payload.personId,
      { firstName: payload.firstName, lastName: payload.lastName },
      aggregateVersion,
    );
  }

  async personDeactivated({ payload, aggregateVersion }: EventEnvelope<PersonDeactivatedV1>) {
    await this.store.updatePerson(payload.personId, { status: 'DEACTIVATED' }, aggregateVersion);
  }

  async groupCreated({ payload, aggregateVersion, occurredAt }: EventEnvelope<GroupCreatedV1>) {
    await this.store.insertGroup({
      id: payload.groupId,
      name: payload.name,
      maxMembers: payload.maxMembers,
      createdAt: occurredAt,
      version: aggregateVersion,
    });
  }

  async groupRenamed({ payload, aggregateVersion }: EventEnvelope<GroupRenamedV1>) {
    if (await this.store.updateGroup(payload.groupId, { name: payload.name }, aggregateVersion)) {
      await this.store.renameGroupOfPeople(payload.groupId, payload.name);
    }
  }

  async groupCapacityChanged({ payload, aggregateVersion }: EventEnvelope<GroupCapacityChangedV1>) {
    await this.store.updateGroup(
      payload.groupId,
      { maxMembers: payload.maxMembers },
      aggregateVersion,
    );
  }

  async groupArchived({ payload, aggregateVersion }: EventEnvelope<GroupArchivedV1>) {
    await this.store.updateGroup(payload.groupId, { status: 'ARCHIVED' }, aggregateVersion);
  }

  async personJoinedGroup({ payload, aggregateVersion }: EventEnvelope<PersonJoinedGroupV1>) {
    if (
      !(await this.store.updateGroup(payload.groupId, { memberCountDelta: 1 }, aggregateVersion))
    ) {
      return;
    }
    // La personne vient d'un autre agrégat : son event peut ne pas être encore projeté.
    if (!(await this.store.setPersonGroup(payload.personId, payload.groupId))) {
      throw new ProjectionNotReadyError(`Person ${payload.personId} is not projected yet`);
    }
  }

  async personLeftGroup({ payload, aggregateVersion }: EventEnvelope<PersonLeftGroupV1>) {
    if (await this.store.updateGroup(payload.groupId, { memberCountDelta: -1 }, aggregateVersion)) {
      await this.store.clearPersonGroup(payload.personId, payload.groupId);
    }
  }
}
