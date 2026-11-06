import { InMemoryCardholdersReadModels } from '../../../../test/reporting/in-memory-cardholders-read-models';
import { decodeCursor } from '../pagination';
import {
  GetGroupDetailsQuery,
  GetPersonDetailsQuery,
  ListGroupsQuery,
  ListPersonsQuery,
} from './cardholders.queries';
import {
  GetGroupDetailsHandler,
  GetPersonDetailsHandler,
  ListGroupsHandler,
  ListPersonsHandler,
} from './cardholders.query-handlers';

const id = (n: number) => `00000000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

describe('Cardholders query handlers', () => {
  let models: InMemoryCardholdersReadModels;

  beforeEach(async () => {
    models = new InMemoryCardholdersReadModels();
    for (let n = 1; n <= 3; n++) {
      await models.insertPerson({
        id: id(n),
        firstName: `P${n}`,
        lastName: 'Doe',
        email: `p${n}@example.com`,
        registeredAt: new Date(Date.UTC(2026, 0, n)).toISOString(),
        version: 1,
      });
      await models.insertGroup({
        id: id(100 + n),
        name: `G${n}`,
        maxMembers: 10,
        createdAt: new Date(Date.UTC(2026, 0, n)).toISOString(),
        version: 1,
      });
    }
  });

  it('lists persons page by page (US-RE-2 style cursor pagination)', async () => {
    const handler = new ListPersonsHandler(models);
    const first = await handler.execute(new ListPersonsQuery({}, undefined, 2));
    expect(first.items.map((p) => p.id)).toEqual([id(3), id(2)]);
    expect(decodeCursor(first.nextCursor!)).toEqual({
      sortKey: first.items[1]!.registeredAt,
      id: id(2),
    });

    const second = await handler.execute(new ListPersonsQuery({}, first.nextCursor!, 2));
    expect(second).toEqual({ items: [expect.objectContaining({ id: id(1) })], nextCursor: null });
  });

  it('ignores empty filters and trims the search text', async () => {
    const handler = new ListPersonsHandler(models);
    const all = await handler.execute(new ListPersonsQuery({ q: '  ', groupId: '' }));
    expect(all.items).toHaveLength(3);
    const found = await handler.execute(new ListPersonsQuery({ q: ' p2@ ' }));
    expect(found.items.map((p) => p.id)).toEqual([id(2)]);
  });

  it('rejects an invalid cursor', async () => {
    await expect(
      new ListPersonsHandler(models).execute(new ListPersonsQuery({}, 'not-a-cursor')),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('gets person details or fails with PERSON_NOT_FOUND', async () => {
    const handler = new GetPersonDetailsHandler(models);
    await expect(handler.execute(new GetPersonDetailsQuery(id(1)))).resolves.toMatchObject({
      firstName: 'P1',
    });
    await expect(handler.execute(new GetPersonDetailsQuery(id(9)))).rejects.toMatchObject({
      code: 'PERSON_NOT_FOUND',
    });
  });

  it('lists groups and gets group details', async () => {
    const list = await new ListGroupsHandler(models).execute(
      new ListGroupsQuery({ status: 'ACTIVE' }, undefined, 2),
    );
    expect(list.items.map((g) => g.name)).toEqual(['G3', 'G2']);
    expect(list.nextCursor).not.toBeNull();

    const handler = new GetGroupDetailsHandler(models);
    await expect(handler.execute(new GetGroupDetailsQuery(id(101)))).resolves.toMatchObject({
      name: 'G1',
      members: [],
    });
    await expect(handler.execute(new GetGroupDetailsQuery(id(9)))).rejects.toMatchObject({
      code: 'GROUP_NOT_FOUND',
    });
  });
});

describe('Cardholders queries', () => {
  it('default to no filter, first page and default size', () => {
    expect(new ListPersonsQuery()).toMatchObject({
      filter: {},
      cursor: undefined,
      limit: undefined,
    });
    expect(new ListGroupsQuery()).toMatchObject({
      filter: {},
      cursor: undefined,
      limit: undefined,
    });
  });
});
