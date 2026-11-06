import type { EventSubscription } from '../../../shared/application/event-bus';
import {
  CardholdersEventTypes,
  type PersonDeactivatedV1,
} from '../../contracts/cardholders.events';
import { RemoveDeactivatedPersonFromGroupPolicy } from '../../application/policies/remove-deactivated-person-from-group.policy';

/** Abonnements du context Cardholders : event → policy (le payload du contrat, jamais une classe). */
export function cardholdersSubscriptions(policies: {
  removeDeactivatedPersonFromGroup: RemoveDeactivatedPersonFromGroupPolicy;
}): EventSubscription[] {
  return [
    {
      eventType: CardholdersEventTypes.PersonDeactivated,
      subscriber: RemoveDeactivatedPersonFromGroupPolicy.subscriber,
      handle: (event) =>
        policies.removeDeactivatedPersonFromGroup.handle(event.payload as PersonDeactivatedV1),
    },
  ];
}
