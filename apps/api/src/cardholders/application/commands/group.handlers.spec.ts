import { cardholdersFixture, NOW } from '../../../../test/cardholders/cardholders-fixture';
import { GroupId } from '../../domain/group/group-id';
import { PersonId } from '../../domain/person/person-id';
import {
  AddMemberCommand,
  ArchiveGroupCommand,
  ChangeGroupCapacityCommand,
  CreateGroupCommand,
  RemoveMemberCommand,
  RenameGroupCommand,
} from './group.commands';
import {
  AddMemberHandler,
  ArchiveGroupHandler,
  ChangeGroupCapacityHandler,
  CreateGroupHandler,
  RemoveMemberHandler,
  RenameGroupHandler,
} from './group.handlers';
import { DeactivatePersonCommand, RegisterPersonCommand } from './person.commands';
import { DeactivatePersonHandler, RegisterPersonHandler } from './person.handlers';

const UNKNOWN = '00000000-0000-7000-8000-00000000ffff';

describe('Group command handlers', () => {
  let f: ReturnType<typeof cardholdersFixture>;
  let create: CreateGroupHandler;
  let rename: RenameGroupHandler;
  let addMember: AddMemberHandler;
  let removeMember: RemoveMemberHandler;
  let changeCapacity: ChangeGroupCapacityHandler;
  let archive: ArchiveGroupHandler;
  let registerPerson: (email: string) => Promise<string>;

  beforeEach(() => {
    f = cardholdersFixture();
    create = new CreateGroupHandler(f.groups, f.groups, f.uow, f.ids);
    rename = new RenameGroupHandler(f.groups, f.groups, f.uow);
    addMember = new AddMemberHandler(f.groups, f.persons, f.groups, f.uow, f.clock);
    removeMember = new RemoveMemberHandler(f.groups, f.uow);
    changeCapacity = new ChangeGroupCapacityHandler(f.groups, f.uow);
    archive = new ArchiveGroupHandler(f.groups, f.uow);
    const register = new RegisterPersonHandler(f.persons, f.persons, f.uow, f.ids, f.clock);
    registerPerson = async (email) =>
      (await register.execute(new RegisterPersonCommand('Ada', 'Lovelace', email))).id;
  });

  const group = async (id: string) => (await f.groups.findById(GroupId.from(id)))!;

  describe('CreateGroup (US-CH-3 CA1)', () => {
    it('creates a group with the default capacity of 10', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Famille Martin'));
      expect((await group(id)).capacity.value).toBe(10);
      expect(f.publisher.ofType('cardholders.GroupCreated')).toEqual([
        expect.objectContaining({
          payload: { groupId: id, name: 'Famille Martin', maxMembers: 10 },
        }),
      ]);
    });

    it('refuses a name already used, case-insensitively', async () => {
      await create.execute(new CreateGroupCommand('Famille Martin', 4));
      await expect(create.execute(new CreateGroupCommand('famille martin'))).rejects.toMatchObject({
        code: 'GROUP_NAME_ALREADY_USED',
      });
    });

    it('refuses a capacity outside 1..50', async () => {
      await expect(create.execute(new CreateGroupCommand('Team', 51))).rejects.toMatchObject({
        code: 'INVALID_GROUP_CAPACITY',
      });
      expect(f.uow.runs).toBe(0);
    });
  });

  describe('RenameGroup', () => {
    it('renames the group, keeping its own name available', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team'));
      await rename.execute(new RenameGroupCommand(id, 'TEAM'));
      expect((await group(id)).name.value).toBe('TEAM');
    });

    it('refuses the name of another group', async () => {
      await create.execute(new CreateGroupCommand('Alpha'));
      const { id } = await create.execute(new CreateGroupCommand('Beta'));
      await expect(rename.execute(new RenameGroupCommand(id, 'alpha'))).rejects.toMatchObject({
        code: 'GROUP_NAME_ALREADY_USED',
      });
    });

    it('fails with GROUP_NOT_FOUND for an unknown group', async () => {
      await expect(rename.execute(new RenameGroupCommand(UNKNOWN, 'Team'))).rejects.toMatchObject({
        code: 'GROUP_NOT_FOUND',
      });
    });
  });

  describe('AddMember', () => {
    it('adds an active person to the group', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team'));
      const personId = await registerPerson('ada@example.com');

      await addMember.execute(new AddMemberCommand(id, personId));

      expect((await group(id)).members).toEqual([{ personId, joinedAt: NOW }]);
      expect(f.publisher.ofType('cardholders.PersonJoinedGroup')).toHaveLength(1);
    });

    it('refuses a person who already belongs to another group (US-CH-3 CA2)', async () => {
      const alpha = await create.execute(new CreateGroupCommand('Alpha'));
      const beta = await create.execute(new CreateGroupCommand('Beta'));
      const personId = await registerPerson('ada@example.com');
      await addMember.execute(new AddMemberCommand(alpha.id, personId));

      await expect(
        addMember.execute(new AddMemberCommand(beta.id, personId)),
      ).rejects.toMatchObject({
        code: 'PERSON_ALREADY_IN_A_GROUP',
        context: { personId, groupId: alpha.id },
      });
      expect((await group(beta.id)).memberCount).toBe(0);
    });

    it('refuses a member when the group is full (US-CH-3 CA3)', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Duo', 1));
      await addMember.execute(new AddMemberCommand(id, await registerPerson('a@example.com')));
      await expect(
        addMember.execute(new AddMemberCommand(id, await registerPerson('b@example.com'))),
      ).rejects.toMatchObject({ code: 'GROUP_FULL' });
    });

    it('refuses an unknown person', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team'));
      await expect(addMember.execute(new AddMemberCommand(id, UNKNOWN))).rejects.toMatchObject({
        code: 'PERSON_NOT_FOUND',
      });
    });

    it('refuses a deactivated person', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team'));
      const personId = await registerPerson('ada@example.com');
      await new DeactivatePersonHandler(f.persons, f.uow).execute(
        new DeactivatePersonCommand(personId),
      );
      await expect(addMember.execute(new AddMemberCommand(id, personId))).rejects.toMatchObject({
        code: 'PERSON_DEACTIVATED',
      });
    });

    it('fails with GROUP_NOT_FOUND for an unknown group', async () => {
      const personId = await registerPerson('ada@example.com');
      await expect(
        addMember.execute(new AddMemberCommand(UNKNOWN, personId)),
      ).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' });
    });
  });

  describe('RemoveMember', () => {
    it('removes the member, who can then join another group', async () => {
      const alpha = await create.execute(new CreateGroupCommand('Alpha'));
      const beta = await create.execute(new CreateGroupCommand('Beta'));
      const personId = await registerPerson('ada@example.com');
      await addMember.execute(new AddMemberCommand(alpha.id, personId));

      await removeMember.execute(new RemoveMemberCommand(alpha.id, personId));
      await addMember.execute(new AddMemberCommand(beta.id, personId));

      expect((await group(alpha.id)).memberCount).toBe(0);
      expect((await group(beta.id)).hasMember(PersonId.from(personId))).toBe(true);
    });

    it('refuses to remove a non-member', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team'));
      await expect(
        removeMember.execute(new RemoveMemberCommand(id, UNKNOWN)),
      ).rejects.toMatchObject({
        code: 'PERSON_NOT_MEMBER',
      });
    });
  });

  describe('ChangeGroupCapacity', () => {
    it('changes the capacity', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team'));
      await changeCapacity.execute(new ChangeGroupCapacityCommand(id, 3));
      expect((await group(id)).capacity.value).toBe(3);
    });

    it('refuses a capacity below the member count (US-CH-3 CA5)', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team', 5));
      await addMember.execute(new AddMemberCommand(id, await registerPerson('a@example.com')));
      await addMember.execute(new AddMemberCommand(id, await registerPerson('b@example.com')));
      await expect(
        changeCapacity.execute(new ChangeGroupCapacityCommand(id, 1)),
      ).rejects.toMatchObject({
        code: 'CAPACITY_BELOW_MEMBER_COUNT',
      });
    });

    it('does not save when the capacity is unchanged', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team', 4));
      const published = f.publisher.published.length;
      await changeCapacity.execute(new ChangeGroupCapacityCommand(id, 4));
      expect(f.publisher.published).toHaveLength(published);
    });
  });

  describe('ArchiveGroup', () => {
    it('archives an empty group', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team'));
      await archive.execute(new ArchiveGroupCommand(id));
      expect((await group(id)).status).toBe('ARCHIVED');
    });

    it('refuses to archive a group that still has members (US-CH-3 CA4)', async () => {
      const { id } = await create.execute(new CreateGroupCommand('Team'));
      await addMember.execute(new AddMemberCommand(id, await registerPerson('a@example.com')));
      await expect(archive.execute(new ArchiveGroupCommand(id))).rejects.toMatchObject({
        code: 'GROUP_NOT_EMPTY',
      });
    });
  });
});
