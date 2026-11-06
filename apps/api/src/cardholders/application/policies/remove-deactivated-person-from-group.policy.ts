import type { CommandBus } from '../../../shared/application/command-bus';
import type { PersonDeactivatedV1 } from '../../contracts/cardholders.events';
import { PersonId } from '../../domain/person/person-id';
import { RemoveMemberCommand } from '../commands/group.commands';
import type { GroupLookup } from '../ports/group-lookup.port';

/**
 * US-CH-2 CA3 : une personne désactivée est retirée de son groupe.
 * Réagit à `PersonDeactivated` ; idempotente (sans groupe, il n'y a rien à faire).
 */
export class RemoveDeactivatedPersonFromGroupPolicy {
  static readonly subscriber = 'cardholders.remove-deactivated-person-from-group';

  constructor(
    private readonly memberships: GroupLookup,
    private readonly commands: CommandBus,
  ) {}

  async handle(event: PersonDeactivatedV1): Promise<void> {
    const groupId = await this.memberships.findGroupOf(PersonId.from(event.personId));
    if (groupId === null) return;
    await this.commands.execute(new RemoveMemberCommand(groupId, event.personId));
  }
}
