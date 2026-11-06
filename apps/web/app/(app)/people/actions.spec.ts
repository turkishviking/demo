/** @jest-environment node */
import { ApiError } from '@/lib/api/server';
import * as api from '@/lib/api/cardholders';
import { deactivatePersonAction, registerPersonAction, renamePersonAction } from './actions';

jest.mock('@/lib/api/cardholders');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const mocked = jest.mocked(api);
const person = {
  id: 'p-1',
  firstName: 'Ada',
  lastName: 'King',
  email: 'ada@example.com',
  status: 'ACTIVE' as const,
  registeredAt: '2026-01-01T00:00:00.000Z',
  group: null,
};
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe('people server actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers a person and redirects to their page once projected', async () => {
    mocked.registerPerson.mockResolvedValue({ id: 'p-1' });
    mocked.getPerson.mockResolvedValue(person);

    await expect(
      registerPersonAction(
        { status: 'idle' },
        form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }),
      ),
    ).rejects.toThrow('REDIRECT /people/p-1');
    expect(mocked.registerPerson).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
  });

  it('returns the API error instead of redirecting (US-CH-1 CA2)', async () => {
    const problem = { type: 't', title: 'Used', status: 409, code: 'EMAIL_ALREADY_USED' };
    mocked.registerPerson.mockRejectedValue(new ApiError(problem));
    await expect(
      registerPersonAction({ status: 'idle' }, form({ email: 'ada@example.com' })),
    ).resolves.toEqual({ status: 'error', problem });
  });

  it('renames and waits for the read model', async () => {
    mocked.renamePerson.mockResolvedValue(undefined);
    mocked.getPerson.mockResolvedValue(person);
    await expect(
      renamePersonAction('p-1', { status: 'idle' }, form({ firstName: ' Ada ', lastName: 'King' })),
    ).resolves.toEqual({ status: 'success', message: 'Nom mis à jour.' });
    expect(mocked.renamePerson).toHaveBeenCalledWith('p-1', { firstName: 'Ada', lastName: 'King' });
  });

  it('deactivates a person', async () => {
    mocked.deactivatePerson.mockResolvedValue(undefined);
    mocked.getPerson.mockResolvedValue({ ...person, status: 'DEACTIVATED' });
    await expect(deactivatePersonAction('p-1')).resolves.toMatchObject({ status: 'success' });
  });
});
