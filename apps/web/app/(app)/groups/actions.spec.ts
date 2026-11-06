/** @jest-environment node */
import type { GroupDetails } from '@cardsim/shared';
import { ApiError } from '@/lib/api/server';
import * as api from '@/lib/api/cardholders';
import {
  addMemberAction,
  archiveGroupAction,
  changeCapacityAction,
  createGroupAction,
  removeMemberAction,
  renameGroupAction,
} from './actions';

jest.mock('@/lib/api/cardholders');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const mocked = jest.mocked(api);
const group = (overrides: Partial<GroupDetails> = {}): GroupDetails => ({
  id: 'g-1',
  name: 'Team',
  maxMembers: 10,
  memberCount: 0,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  members: [],
  ...overrides,
});
const member = {
  id: 'p-1',
  firstName: 'Ada',
  lastName: 'L',
  email: 'a@x.io',
  status: 'ACTIVE' as const,
};
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const idle = { status: 'idle' } as const;

describe('groups server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const command of [
      mocked.renameGroup,
      mocked.addMember,
      mocked.removeMember,
      mocked.changeGroupCapacity,
      mocked.archiveGroup,
    ]) {
      command.mockResolvedValue(undefined);
    }
  });

  it('creates a group with the given capacity and redirects to it', async () => {
    mocked.createGroup.mockResolvedValue({ id: 'g-1' });
    mocked.getGroup.mockResolvedValue(group());
    await expect(createGroupAction(idle, form({ name: 'Team', maxMembers: '4' }))).rejects.toThrow(
      'REDIRECT /groups/g-1',
    );
    expect(mocked.createGroup).toHaveBeenCalledWith({ name: 'Team', maxMembers: 4 });
  });

  it('lets the API apply the default capacity when none is given', async () => {
    mocked.createGroup.mockResolvedValue({ id: 'g-1' });
    mocked.getGroup.mockResolvedValue(group());
    await expect(createGroupAction(idle, form({ name: 'Team' }))).rejects.toThrow('REDIRECT');
    expect(mocked.createGroup).toHaveBeenCalledWith({ name: 'Team' });
  });

  it('reports the one-group rule (US-CH-3 CA2)', async () => {
    const problem = {
      type: 't',
      title: 'In a group',
      status: 409,
      code: 'PERSON_ALREADY_IN_A_GROUP',
    };
    mocked.addMember.mockRejectedValue(new ApiError(problem));
    await expect(addMemberAction('g-1', idle, form({ personId: 'p-1' }))).resolves.toEqual({
      status: 'error',
      problem,
    });
    expect(mocked.getGroup).not.toHaveBeenCalled();
  });

  it('adds a member and waits until it is projected', async () => {
    mocked.getGroup
      .mockResolvedValueOnce(group())
      .mockResolvedValue(group({ members: [member], memberCount: 1 }));
    await expect(addMemberAction('g-1', idle, form({ personId: 'p-1' }))).resolves.toEqual({
      status: 'success',
      message: 'Membre ajouté.',
    });
    expect(mocked.getGroup).toHaveBeenCalledTimes(2);
  });

  it('runs the other group commands', async () => {
    mocked.getGroup.mockResolvedValue(
      group({ name: 'New name', maxMembers: 3, status: 'ARCHIVED' }),
    );
    await expect(
      renameGroupAction('g-1', idle, form({ name: ' New   name ' })),
    ).resolves.toMatchObject({
      status: 'success',
    });
    expect(mocked.renameGroup).toHaveBeenCalledWith('g-1', { name: 'New   name' });
    await expect(
      changeCapacityAction('g-1', idle, form({ maxMembers: '3' })),
    ).resolves.toMatchObject({
      status: 'success',
    });
    expect(mocked.changeGroupCapacity).toHaveBeenCalledWith('g-1', 3);
    await expect(removeMemberAction('g-1', 'p-1')).resolves.toMatchObject({ status: 'success' });
    await expect(archiveGroupAction('g-1')).resolves.toMatchObject({ status: 'success' });
  });
});
