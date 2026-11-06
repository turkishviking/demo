import type { Clock } from '../../../shared/application/clock.port';
import type { CommandHandler } from '../../../shared/application/command-bus';
import type { IdGenerator } from '../../../shared/application/id-generator.port';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.port';
import {
  GroupNameAlreadyUsedError,
  GroupNotFoundError,
  PersonAlreadyInAGroupError,
  PersonDeactivatedError,
  PersonNotFoundError,
} from '../../domain/errors/cardholders.errors';
import { GroupCapacity } from '../../domain/group/group-capacity.vo';
import { Group } from '../../domain/group/group.aggregate';
import { GroupId } from '../../domain/group/group-id';
import { GroupName } from '../../domain/group/group-name.vo';
import type { GroupRepository } from '../../domain/group/group.repository';
import { PersonId } from '../../domain/person/person-id';
import type { GroupLookup } from '../ports/group-lookup.port';
import type { PersonLookup } from '../ports/person-lookup.port';
import type {
  AddMemberCommand,
  ArchiveGroupCommand,
  ChangeGroupCapacityCommand,
  CreateGroupCommand,
  RemoveMemberCommand,
  RenameGroupCommand,
} from './group.commands';

/** Charge le groupe, applique `change` et sauvegarde s'il a produit des events. */
async function changeGroup(
  groups: GroupRepository,
  groupId: string,
  change: (group: Group) => void | Promise<void>,
): Promise<void> {
  const group = await groups.findById(GroupId.from(groupId));
  if (!group) throw new GroupNotFoundError(groupId);
  await change(group);
  if (group.pendingEvents.length > 0) await groups.save(group);
}

/** US-CH-3 CA1 : nom unique, capacité entre 1 et 50. */
export class CreateGroupHandler implements CommandHandler<CreateGroupCommand> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly lookup: GroupLookup,
    private readonly uow: UnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateGroupCommand): Promise<{ id: string }> {
    const name = GroupName.create(command.name);
    const capacity = GroupCapacity.create(command.maxMembers);

    return this.uow.run(async () => {
      if (await this.lookup.isNameTaken(name)) throw new GroupNameAlreadyUsedError(name.value);
      const group = Group.create({ id: GroupId.from(this.ids.next()), name, capacity });
      await this.groups.save(group);
      return { id: group.id };
    });
  }
}

export class RenameGroupHandler implements CommandHandler<RenameGroupCommand> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly lookup: GroupLookup,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(command: RenameGroupCommand): Promise<void> {
    const name = GroupName.create(command.name);
    await this.uow.run(() =>
      changeGroup(this.groups, command.groupId, async (group) => {
        if (await this.lookup.isNameTaken(name, group.id)) {
          throw new GroupNameAlreadyUsedError(name.value);
        }
        group.rename(name);
      }),
    );
  }
}

/**
 * Ajoute une personne active à un groupe. La règle « une personne dans au plus un groupe »
 * est vérifiée ici (lookup) et garantie en base (contrainte unique) contre les courses.
 */
export class AddMemberHandler implements CommandHandler<AddMemberCommand> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly persons: PersonLookup,
    private readonly memberships: GroupLookup,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(command: AddMemberCommand): Promise<void> {
    const personId = PersonId.from(command.personId);
    await this.uow.run(() =>
      changeGroup(this.groups, command.groupId, async (group) => {
        const status = await this.persons.statusOf(personId);
        if (status === null) throw new PersonNotFoundError(personId);
        if (status === 'DEACTIVATED') throw new PersonDeactivatedError(personId);

        const currentGroup = await this.memberships.findGroupOf(personId);
        if (currentGroup !== null) throw new PersonAlreadyInAGroupError(personId, currentGroup);

        group.addMember(personId, this.clock.now());
      }),
    );
  }
}

export class RemoveMemberHandler implements CommandHandler<RemoveMemberCommand> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(command: RemoveMemberCommand): Promise<void> {
    await this.uow.run(() =>
      changeGroup(this.groups, command.groupId, (group) =>
        group.removeMember(PersonId.from(command.personId)),
      ),
    );
  }
}

export class ChangeGroupCapacityHandler implements CommandHandler<ChangeGroupCapacityCommand> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(command: ChangeGroupCapacityCommand): Promise<void> {
    const capacity = GroupCapacity.create(command.maxMembers);
    await this.uow.run(() =>
      changeGroup(this.groups, command.groupId, (group) => group.changeCapacity(capacity)),
    );
  }
}

export class ArchiveGroupHandler implements CommandHandler<ArchiveGroupCommand> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(command: ArchiveGroupCommand): Promise<void> {
    await this.uow.run(() => changeGroup(this.groups, command.groupId, (group) => group.archive()));
  }
}
