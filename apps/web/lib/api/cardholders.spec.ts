/** @jest-environment node */
import * as api from './cardholders';

const BASE = 'http://127.0.0.1:3001/api/v1';

describe('cardholders API client', () => {
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const calls = () =>
    fetchMock.mock.calls.map(([url, init]) => [
      init?.method,
      String(url).replace(BASE, ''),
      init?.body,
    ]);

  it('reads persons and groups with their filters', async () => {
    fetchMock.mockImplementation(async () => Response.json({ items: [], nextCursor: null }));
    await api.listPersons({ q: 'ada', status: 'ACTIVE', cursor: undefined });
    await api.listPersons();
    await api.getPerson('p-1');
    await api.listGroups({ status: 'ARCHIVED', limit: 10 });
    await api.getGroup('g-1');

    expect(calls()).toEqual([
      ['GET', '/persons?q=ada&status=ACTIVE', undefined],
      ['GET', '/persons', undefined],
      ['GET', '/persons/p-1', undefined],
      ['GET', '/groups?status=ARCHIVED&limit=10', undefined],
      ['GET', '/groups/g-1', undefined],
    ]);
  });

  it('sends the commands to the matching routes', async () => {
    await api.registerPerson({ firstName: 'Ada', lastName: 'L', email: 'a@x.io' });
    await api.renamePerson('p-1', { firstName: 'Ada', lastName: 'K' });
    await api.deactivatePerson('p-1');
    await api.createGroup({ name: 'Team' });
    await api.renameGroup('g-1', { name: 'New' });
    await api.addMember('g-1', 'p-1');
    await api.removeMember('g-1', 'p-1');
    await api.changeGroupCapacity('g-1', 3);
    await api.archiveGroup('g-1');

    expect(calls()).toEqual([
      ['POST', '/persons', '{"firstName":"Ada","lastName":"L","email":"a@x.io"}'],
      ['POST', '/persons/p-1/rename', '{"firstName":"Ada","lastName":"K"}'],
      ['POST', '/persons/p-1/deactivate', undefined],
      ['POST', '/groups', '{"name":"Team"}'],
      ['POST', '/groups/g-1/rename', '{"name":"New"}'],
      ['POST', '/groups/g-1/members', '{"personId":"p-1"}'],
      ['DELETE', '/groups/g-1/members/p-1', undefined],
      ['POST', '/groups/g-1/capacity', '{"maxMembers":3}'],
      ['POST', '/groups/g-1/archive', undefined],
    ]);
  });
});
