import { aGroup, somePersonId } from '../../../../test/cardholders/builders';
import { GroupCapacity } from './group-capacity.vo';
import { Group } from './group.aggregate';
import { GroupId } from './group-id';
import { GroupName } from './group-name.vo';

const ID = GroupId.from('00000000-0000-7000-8000-0000000000aa');
const AT = new Date('2026-03-01T08:30:00.000Z');

describe('GroupName', () => {
  it('trims and collapses spaces', () => {
    expect(GroupName.create('  Famille   Martin ').value).toBe('Famille Martin');
    expect(GroupName.create('AB').toString()).toBe('AB');
  });

  it.each(['', 'A', '  A  ', 'x'.repeat(61)])('rejects %p (2 to 60 characters)', (raw) => {
    expect(() => GroupName.create(raw)).toThrow(
      expect.objectContaining({ code: 'INVALID_GROUP_NAME' }),
    );
  });
});

describe('GroupCapacity (US-CH-3 CA1)', () => {
  it('defaults to 10', () => {
    expect(GroupCapacity.create().value).toBe(10);
  });

  it.each([1, 50])('accepts %p', (value) => {
    expect(GroupCapacity.create(value).value).toBe(value);
  });

  it.each([0, 51, 2.5, -1, Number.NaN])('rejects %p (integer between 1 and 50)', (value) => {
    expect(() => GroupCapacity.create(value)).toThrow(
      expect.objectContaining({ code: 'INVALID_GROUP_CAPACITY' }),
    );
  });
});

describe('Group', () => {
  it('is created ACTIVE and empty, recording GroupCreated (US-CH-3 CA1)', () => {
    const group = Group.create({
      id: ID,
      name: GroupName.create('Famille Martin'),
      capacity: GroupCapacity.create(4),
    });

    expect(group.status).toBe('ACTIVE');
    expect(group.memberCount).toBe(0);
    expect(group.isNew).toBe(true);
    expect(group.pullEvents()).toEqual([
      {
        type: 'cardholders.GroupCreated',
        version: 1,
        payload: { groupId: ID, name: 'Famille Martin', maxMembers: 4 },
      },
    ]);
  });

  it('restores members without recording events', () => {
    const p1 = somePersonId();
    const group = aGroup().withMembers(p1).build();
    expect(group.hasMember(p1)).toBe(true);
    expect(group.members).toEqual([{ personId: p1, joinedAt: expect.any(Date) }]);
    expect(group.pullEvents()).toEqual([]);
    expect(Group.restore(group.snapshot(), 3).snapshot()).toEqual(group.snapshot());
  });

  describe('addMember', () => {
    it('adds the person and records PersonJoinedGroup', () => {
      const group = aGroup().build();
      const personId = somePersonId();
      group.addMember(personId, AT);

      expect(group.hasMember(personId)).toBe(true);
      expect(group.memberCount).toBe(1);
      expect(group.pullEvents()).toEqual([
        {
          type: 'cardholders.PersonJoinedGroup',
          version: 1,
          payload: { groupId: group.id, personId, joinedAt: AT.toISOString() },
        },
      ]);
    });

    it('refuses a duplicate member (G2)', () => {
      const personId = somePersonId();
      const group = aGroup().withMembers(personId).build();
      expect(() => group.addMember(personId, AT)).toThrow(
        expect.objectContaining({ code: 'PERSON_ALREADY_IN_A_GROUP' }),
      );
    });

    it('refuses a member when the group is full (G1, US-CH-3 CA3)', () => {
      const group = aGroup().withCapacity(2).withMembers(somePersonId(), somePersonId()).build();
      expect(() => group.addMember(somePersonId(), AT)).toThrow(
        expect.objectContaining({
          code: 'GROUP_FULL',
          context: { groupId: group.id, maxMembers: 2 },
        }),
      );
      expect(group.memberCount).toBe(2);
    });

    it('refuses any change on an archived group (G3)', () => {
      const group = aGroup().archived().build();
      expect(() => group.addMember(somePersonId(), AT)).toThrow(
        expect.objectContaining({ code: 'GROUP_ARCHIVED' }),
      );
    });
  });

  describe('removeMember', () => {
    it('removes the person and records PersonLeftGroup', () => {
      const personId = somePersonId();
      const group = aGroup().withMembers(personId).build();
      group.removeMember(personId);

      expect(group.hasMember(personId)).toBe(false);
      expect(group.pullEvents()).toEqual([
        {
          type: 'cardholders.PersonLeftGroup',
          version: 1,
          payload: { groupId: group.id, personId },
        },
      ]);
    });

    it('refuses to remove a person who is not a member', () => {
      expect(() => aGroup().build().removeMember(somePersonId())).toThrow(
        expect.objectContaining({ code: 'PERSON_NOT_MEMBER' }),
      );
    });
  });

  describe('rename', () => {
    it('records GroupRenamed', () => {
      const group = aGroup().named('Old name').build();
      group.rename(GroupName.create('New name'));
      expect(group.name.value).toBe('New name');
      expect(group.pullEvents()).toEqual([
        {
          type: 'cardholders.GroupRenamed',
          version: 1,
          payload: { groupId: group.id, name: 'New name' },
        },
      ]);
    });

    it('is a no-op for the same name', () => {
      const group = aGroup().named('Same').build();
      group.rename(GroupName.create(' Same '));
      expect(group.pullEvents()).toEqual([]);
    });

    it('refuses to rename an archived group (G3)', () => {
      expect(() => aGroup().archived().build().rename(GroupName.create('Other'))).toThrow(
        expect.objectContaining({ code: 'GROUP_ARCHIVED' }),
      );
    });
  });

  describe('changeCapacity', () => {
    it('records GroupCapacityChanged', () => {
      const group = aGroup().withCapacity(10).build();
      group.changeCapacity(GroupCapacity.create(3));
      expect(group.capacity.value).toBe(3);
      expect(group.pullEvents()).toEqual([
        {
          type: 'cardholders.GroupCapacityChanged',
          version: 1,
          payload: { groupId: group.id, maxMembers: 3 },
        },
      ]);
    });

    it('accepts a capacity equal to the member count', () => {
      const group = aGroup().withCapacity(5).withMembers(somePersonId(), somePersonId()).build();
      group.changeCapacity(GroupCapacity.create(2));
      expect(group.capacity.value).toBe(2);
    });

    it('is a no-op for the same capacity', () => {
      const group = aGroup().withCapacity(4).build();
      group.changeCapacity(GroupCapacity.create(4));
      expect(group.pullEvents()).toEqual([]);
    });

    it('refuses a capacity below the member count (G5, US-CH-3 CA5)', () => {
      const group = aGroup()
        .withCapacity(5)
        .withMembers(somePersonId(), somePersonId(), somePersonId())
        .build();
      expect(() => group.changeCapacity(GroupCapacity.create(2))).toThrow(
        expect.objectContaining({ code: 'CAPACITY_BELOW_MEMBER_COUNT' }),
      );
    });

    it('refuses to change an archived group (G3)', () => {
      expect(() => aGroup().archived().build().changeCapacity(GroupCapacity.create(3))).toThrow(
        expect.objectContaining({ code: 'GROUP_ARCHIVED' }),
      );
    });
  });

  describe('archive', () => {
    it('archives an empty group and records GroupArchived', () => {
      const group = aGroup().build();
      group.archive();
      expect(group.isArchived).toBe(true);
      expect(group.pullEvents()).toEqual([
        { type: 'cardholders.GroupArchived', version: 1, payload: { groupId: group.id } },
      ]);
    });

    it('refuses to archive a group with members (G4, US-CH-3 CA4)', () => {
      const group = aGroup().withMembers(somePersonId()).build();
      expect(() => group.archive()).toThrow(
        expect.objectContaining({
          code: 'GROUP_NOT_EMPTY',
          context: { groupId: group.id, memberCount: 1 },
        }),
      );
    });

    it('refuses to archive twice (G3)', () => {
      expect(() => aGroup().archived().build().archive()).toThrow(
        expect.objectContaining({ code: 'GROUP_ARCHIVED' }),
      );
    });
  });
});
