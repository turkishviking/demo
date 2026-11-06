import { cardholdersFixture } from '../../../../test/cardholders/cardholders-fixture';
import { GroupId } from '../../domain/group/group-id';
import {
  AddMemberCommand,
  CreateGroupCommand,
  RemoveMemberCommand,
} from '../commands/group.commands';
import {
  AddMemberHandler,
  CreateGroupHandler,
  RemoveMemberHandler,
} from '../commands/group.handlers';
import { RegisterPersonCommand } from '../commands/person.commands';
import { RegisterPersonHandler } from '../commands/person.handlers';
import { RemoveDeactivatedPersonFromGroupPolicy } from './remove-deactivated-person-from-group.policy';

describe('RemoveDeactivatedPersonFromGroupPolicy (US-CH-2 CA3)', () => {
  it('removes a deactivated person from their group', async () => {
    // Given
    const f = cardholdersFixture();
    f.commands.register(RemoveMemberCommand, new RemoveMemberHandler(f.groups, f.uow));
    const { id: groupId } = await new CreateGroupHandler(f.groups, f.groups, f.uow, f.ids).execute(
      new CreateGroupCommand('Team'),
    );
    const { id: personId } = await new RegisterPersonHandler(
      f.persons,
      f.persons,
      f.uow,
      f.ids,
      f.clock,
    ).execute(new RegisterPersonCommand('Ada', 'Lovelace', 'ada@example.com'));
    await new AddMemberHandler(f.groups, f.persons, f.groups, f.uow, f.clock).execute(
      new AddMemberCommand(groupId, personId),
    );
    const policy = new RemoveDeactivatedPersonFromGroupPolicy(f.groups, f.commands);

    // When
    await policy.handle({ personId });

    // Then
    expect((await f.groups.findById(GroupId.from(groupId)))?.memberCount).toBe(0);
    expect(f.publisher.ofType('cardholders.PersonLeftGroup')).toEqual([
      expect.objectContaining({ payload: { groupId, personId } }),
    ]);

    // Rejouer l'event ne fait rien (idempotence)
    await policy.handle({ personId });
    expect(f.publisher.ofType('cardholders.PersonLeftGroup')).toHaveLength(1);
  });

  it('does nothing for a person without a group', async () => {
    const f = cardholdersFixture();
    const execute = jest.spyOn(f.commands, 'execute');
    await new RemoveDeactivatedPersonFromGroupPolicy(f.groups, f.commands).handle({
      personId: '00000000-0000-7000-8000-00000000ffff',
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
