import {
  CardholdersEventTypes,
  type GroupArchivedV1,
  type GroupCapacityChangedV1,
  type GroupCreatedV1,
  type GroupRenamedV1,
  type PersonDeactivatedV1,
  type PersonJoinedGroupV1,
  type PersonLeftGroupV1,
  type PersonRegisteredV1,
  type PersonRenamedV1,
} from '../../../cardholders/contracts/cardholders.events';
import type { EventSubscription } from '../../../shared/application/event-bus';
import type { EventEnvelope } from '../../../shared/application/event-envelope';
import { CardholdersProjection } from '../../application/projections/cardholders.projection';

/** Abonnements des projections de Reporting aux events publiés des autres contexts. */
export function reportingSubscriptions(projections: {
  cardholders: CardholdersProjection;
}): EventSubscription[] {
  const p = projections.cardholders;
  const on = <T>(eventType: string, handle: (event: EventEnvelope<T>) => Promise<void>) => ({
    eventType,
    subscriber: CardholdersProjection.subscriber,
    handle: (event: EventEnvelope) => handle(event as EventEnvelope<T>),
  });

  return [
    on<PersonRegisteredV1>(CardholdersEventTypes.PersonRegistered, (e) => p.personRegistered(e)),
    on<PersonRenamedV1>(CardholdersEventTypes.PersonRenamed, (e) => p.personRenamed(e)),
    on<PersonDeactivatedV1>(CardholdersEventTypes.PersonDeactivated, (e) => p.personDeactivated(e)),
    on<GroupCreatedV1>(CardholdersEventTypes.GroupCreated, (e) => p.groupCreated(e)),
    on<GroupRenamedV1>(CardholdersEventTypes.GroupRenamed, (e) => p.groupRenamed(e)),
    on<GroupCapacityChangedV1>(CardholdersEventTypes.GroupCapacityChanged, (e) =>
      p.groupCapacityChanged(e),
    ),
    on<GroupArchivedV1>(CardholdersEventTypes.GroupArchived, (e) => p.groupArchived(e)),
    on<PersonJoinedGroupV1>(CardholdersEventTypes.PersonJoinedGroup, (e) => p.personJoinedGroup(e)),
    on<PersonLeftGroupV1>(CardholdersEventTypes.PersonLeftGroup, (e) => p.personLeftGroup(e)),
  ];
}
