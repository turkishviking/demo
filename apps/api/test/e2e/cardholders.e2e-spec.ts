import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { eventually } from '../helpers/eventually';
import { truncate } from '../postgres/test-database';
import { createTestApp } from './create-test-app';

const UNKNOWN = '00000000-0000-7000-8000-00000000ffff';

describe('Cardholders (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await truncate(app.get(DataSource), [
      'cardholders.group_members',
      'cardholders.groups',
      'cardholders.persons',
      'reporting.rm_people',
      'reporting.rm_groups',
    ]);
  });

  const api = (path: string) => `/api/v1${path}`;

  const registerPerson = async (email: string, firstName = 'Ada', lastName = 'Lovelace') => {
    const res = await request(app.getHttpServer())
      .post(api('/persons'))
      .send({ firstName, lastName, email })
      .expect(201);
    return res.body.id as string;
  };

  const createGroup = async (name: string, maxMembers?: number) => {
    const res = await request(app.getHttpServer())
      .post(api('/groups'))
      .send(maxMembers === undefined ? { name } : { name, maxMembers })
      .expect(201);
    return res.body.id as string;
  };

  /** Lecture côté Reporting : cohérence éventuelle, on attend la projection. */
  const readEventually = (path: string, check: (body: Record<string, unknown>) => void) =>
    eventually(async () => {
      const res = await request(app.getHttpServer()).get(api(path)).expect(200);
      check(res.body);
      return res.body;
    });

  describe('US-CH-1 — register a person', () => {
    it('creates an ACTIVE person, readable through the read model (US-CH-1 CA1)', async () => {
      const id = await registerPerson('ada@example.com');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);

      await readEventually(`/persons/${id}`, (person) =>
        expect(person).toMatchObject({
          id,
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          status: 'ACTIVE',
          group: null,
        }),
      );
    });

    it('refuses an email already used with 409 EMAIL_ALREADY_USED (US-CH-1 CA2)', async () => {
      await registerPerson('ada@example.com');
      const res = await http
        .post(api('/persons'))
        .send({ firstName: 'Ada', lastName: 'King', email: 'ADA@example.com' })
        .expect(409);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ code: 'EMAIL_ALREADY_USED', status: 409 });
    });

    it('answers 400 for a malformed body and 422 for an invalid email', async () => {
      const malformed = await http.post(api('/persons')).send({ firstName: 'Ada' }).expect(400);
      expect(malformed.body.code).toBe('VALIDATION_ERROR');
      expect(malformed.body.errors.map((e: { field: string }) => e.field)).toEqual(
        expect.arrayContaining(['lastName', 'email']),
      );

      const invalid = await http
        .post(api('/persons'))
        .send({ firstName: 'Ada', lastName: 'Lovelace', email: 'nope' })
        .expect(422);
      expect(invalid.body.code).toBe('INVALID_EMAIL');
    });

    it('answers 404 PERSON_NOT_FOUND and 400 for a non-UUID id', async () => {
      expect((await http.get(api(`/persons/${UNKNOWN}`)).expect(404)).body.code).toBe(
        'PERSON_NOT_FOUND',
      );
      expect((await http.post(api('/persons/not-a-uuid/deactivate')).expect(400)).body.code).toBe(
        'VALIDATION_ERROR',
      );
    });

    it('renames a person', async () => {
      const id = await registerPerson('ada@example.com');
      await http
        .post(api(`/persons/${id}/rename`))
        .send({ firstName: 'Ada', lastName: 'King' })
        .expect(204);
      await readEventually(`/persons/${id}`, (p) => expect(p.lastName).toBe('King'));
    });
  });

  describe('US-CH-3 — create and manage a group', () => {
    it('creates a group and adds members (US-CH-3 CA1)', async () => {
      const groupId = await createGroup('Famille Martin', 3);
      const personId = await registerPerson('ada@example.com');
      await http
        .post(api(`/groups/${groupId}/members`))
        .send({ personId })
        .expect(204);

      await readEventually(`/groups/${groupId}`, (group) =>
        expect(group).toMatchObject({
          name: 'Famille Martin',
          maxMembers: 3,
          memberCount: 1,
          status: 'ACTIVE',
          members: [expect.objectContaining({ id: personId, lastName: 'Lovelace' })],
        }),
      );
      await readEventually(`/persons/${personId}`, (p) =>
        expect(p.group).toEqual({ id: groupId, name: 'Famille Martin' }),
      );
    });

    it('validates the name and capacity (US-CH-3 CA1)', async () => {
      await createGroup('Alpha');
      expect((await http.post(api('/groups')).send({ name: 'alpha' }).expect(409)).body.code).toBe(
        'GROUP_NAME_ALREADY_USED',
      );
      expect(
        (await http.post(api('/groups')).send({ name: 'Beta', maxMembers: 51 }).expect(422)).body
          .code,
      ).toBe('INVALID_GROUP_CAPACITY');
    });

    it('refuses a person who is already in a group (US-CH-3 CA2)', async () => {
      const alpha = await createGroup('Alpha');
      const beta = await createGroup('Beta');
      const personId = await registerPerson('ada@example.com');
      await http
        .post(api(`/groups/${alpha}/members`))
        .send({ personId })
        .expect(204);

      const res = await http
        .post(api(`/groups/${beta}/members`))
        .send({ personId })
        .expect(409);
      expect(res.body.code).toBe('PERSON_ALREADY_IN_A_GROUP');
    });

    it('refuses a member when the group is full (US-CH-3 CA3)', async () => {
      const groupId = await createGroup('Duo', 1);
      const [first, second] = [
        await registerPerson('a@example.com'),
        await registerPerson('b@example.com'),
      ];
      await http
        .post(api(`/groups/${groupId}/members`))
        .send({ personId: first })
        .expect(204);
      const res = await http
        .post(api(`/groups/${groupId}/members`))
        .send({ personId: second })
        .expect(409);
      expect(res.body.code).toBe('GROUP_FULL');
    });

    it('archives only an empty group (US-CH-3 CA4)', async () => {
      const groupId = await createGroup('Team');
      const personId = await registerPerson('ada@example.com');
      await http
        .post(api(`/groups/${groupId}/members`))
        .send({ personId })
        .expect(204);

      expect((await http.post(api(`/groups/${groupId}/archive`)).expect(409)).body.code).toBe(
        'GROUP_NOT_EMPTY',
      );

      await http.delete(api(`/groups/${groupId}/members/${personId}`)).expect(204);
      await http.post(api(`/groups/${groupId}/archive`)).expect(204);
      await readEventually(`/groups/${groupId}`, (g) =>
        expect(g).toMatchObject({ status: 'ARCHIVED', memberCount: 0 }),
      );
      expect(
        (
          await http
            .post(api(`/groups/${groupId}/rename`))
            .send({ name: 'Other' })
            .expect(409)
        ).body.code,
      ).toBe('GROUP_ARCHIVED');
    });

    it('refuses a capacity below the member count (US-CH-3 CA5)', async () => {
      const groupId = await createGroup('Team', 5);
      for (const email of ['a@example.com', 'b@example.com']) {
        const personId = await registerPerson(email);
        await http
          .post(api(`/groups/${groupId}/members`))
          .send({ personId })
          .expect(204);
      }
      const res = await http
        .post(api(`/groups/${groupId}/capacity`))
        .send({ maxMembers: 1 })
        .expect(409);
      expect(res.body.code).toBe('CAPACITY_BELOW_MEMBER_COUNT');

      await http
        .post(api(`/groups/${groupId}/capacity`))
        .send({ maxMembers: 2 })
        .expect(204);
      await readEventually(`/groups/${groupId}`, (g) => expect(g.maxMembers).toBe(2));
    });
  });

  describe('US-CH-2 — deactivate a person', () => {
    it('deactivates the person and removes them from their group, asynchronously (US-CH-2 CA1, CA3)', async () => {
      const groupId = await createGroup('Team');
      const personId = await registerPerson('ada@example.com');
      await http
        .post(api(`/groups/${groupId}/members`))
        .send({ personId })
        .expect(204);

      await http.post(api(`/persons/${personId}/deactivate`)).expect(204);

      await readEventually(`/persons/${personId}`, (p) =>
        expect(p).toMatchObject({ status: 'DEACTIVATED', group: null }),
      );
      await readEventually(`/groups/${groupId}`, (g) =>
        expect(g).toMatchObject({ memberCount: 0, members: [] }),
      );
      expect(
        (
          await http
            .post(api(`/groups/${groupId}/members`))
            .send({ personId })
            .expect(409)
        ).body.code,
      ).toBe('PERSON_DEACTIVATED');
    });
  });

  describe('lists', () => {
    it('paginates persons with a cursor and filters them', async () => {
      for (const n of [1, 2, 3]) await registerPerson(`p${n}@example.com`, `P${n}`, 'Doe');
      await readEventually('/persons', (page) => expect(page.items).toHaveLength(3));

      const first = (await http.get(api('/persons?limit=2')).expect(200)).body;
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).toEqual(expect.any(String));
      const second = (
        await http.get(api(`/persons?limit=2&cursor=${first.nextCursor}`)).expect(200)
      ).body;
      expect(second).toEqual({ items: [expect.any(Object)], nextCursor: null });

      const searched = (await http.get(api('/persons?q=p2%40')).expect(200)).body;
      expect(searched.items.map((p: { email: string }) => p.email)).toEqual(['p2@example.com']);

      expect((await http.get(api('/persons?limit=500')).expect(400)).body.code).toBe(
        'VALIDATION_ERROR',
      );
      expect((await http.get(api('/persons?cursor=garbage')).expect(400)).body.code).toBe(
        'INVALID_CURSOR',
      );
    });

    it('lists groups by status', async () => {
      const archived = await createGroup('Old');
      await createGroup('Current');
      await http.post(api(`/groups/${archived}/archive`)).expect(204);

      await readEventually('/groups?status=ACTIVE', (page) =>
        expect((page.items as Array<{ name: string }>).map((g) => g.name)).toEqual(['Current']),
      );
    });
  });
});
