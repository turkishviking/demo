import { cardholdersFixture, NOW } from '../../../../test/cardholders/cardholders-fixture';
import { PersonId } from '../../domain/person/person-id';
import {
  DeactivatePersonCommand,
  RegisterPersonCommand,
  RenamePersonCommand,
} from './person.commands';
import {
  DeactivatePersonHandler,
  RegisterPersonHandler,
  RenamePersonHandler,
} from './person.handlers';

const UNKNOWN = '00000000-0000-7000-8000-00000000ffff';

describe('Person command handlers', () => {
  let f: ReturnType<typeof cardholdersFixture>;
  let register: RegisterPersonHandler;
  let rename: RenamePersonHandler;
  let deactivate: DeactivatePersonHandler;

  beforeEach(() => {
    f = cardholdersFixture();
    register = new RegisterPersonHandler(f.persons, f.persons, f.uow, f.ids, f.clock);
    rename = new RenamePersonHandler(f.persons, f.uow);
    deactivate = new DeactivatePersonHandler(f.persons, f.uow);
  });

  describe('RegisterPerson (US-CH-1)', () => {
    it('registers an ACTIVE person and publishes PersonRegistered (US-CH-1 CA1)', async () => {
      // When
      const { id } = await register.execute(
        new RegisterPersonCommand(' Ada ', 'Lovelace', 'ADA@example.com'),
      );

      // Then
      const person = await f.persons.findById(PersonId.from(id));
      expect(person?.status).toBe('ACTIVE');
      expect(person?.email.value).toBe('ada@example.com');
      expect(person?.registeredAt).toEqual(NOW);
      expect(f.uow.runs).toBe(1);
      expect(f.publisher.ofType('cardholders.PersonRegistered')).toEqual([
        expect.objectContaining({
          aggregateId: id,
          aggregateVersion: 1,
          payload: expect.objectContaining({
            personId: id,
            firstName: 'Ada',
            email: 'ada@example.com',
          }),
        }),
      ]);
    });

    it('refuses an email already used, whatever its case (US-CH-1 CA2)', async () => {
      // Given
      await register.execute(new RegisterPersonCommand('Ada', 'Lovelace', 'ada@example.com'));
      // When / Then
      await expect(
        register.execute(new RegisterPersonCommand('Ada', 'King', 'Ada@Example.com')),
      ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_USED' });
      expect(f.publisher.ofType('cardholders.PersonRegistered')).toHaveLength(1);
    });

    it('validates the name and email before opening a transaction', async () => {
      await expect(
        register.execute(new RegisterPersonCommand('', 'Lovelace', 'ada@example.com')),
      ).rejects.toMatchObject({ code: 'INVALID_FULL_NAME' });
      await expect(
        register.execute(new RegisterPersonCommand('Ada', 'Lovelace', 'not-an-email')),
      ).rejects.toMatchObject({ code: 'INVALID_EMAIL' });
      expect(f.uow.runs).toBe(0);
    });
  });

  describe('RenamePerson', () => {
    it('renames the person', async () => {
      const { id } = await register.execute(
        new RegisterPersonCommand('Ada', 'Lovelace', 'ada@example.com'),
      );
      await rename.execute(new RenamePersonCommand(id, 'Ada', 'King'));

      expect((await f.persons.findById(PersonId.from(id)))?.fullName.lastName).toBe('King');
      expect(f.publisher.ofType('cardholders.PersonRenamed')).toHaveLength(1);
    });

    it('does not save when the name is unchanged', async () => {
      const { id } = await register.execute(
        new RegisterPersonCommand('Ada', 'Lovelace', 'ada@example.com'),
      );
      await rename.execute(new RenamePersonCommand(id, 'Ada', 'Lovelace'));
      expect(f.publisher.published).toHaveLength(1);
    });

    it('fails with PERSON_NOT_FOUND for an unknown person', async () => {
      await expect(
        rename.execute(new RenamePersonCommand(UNKNOWN, 'A', 'B')),
      ).rejects.toMatchObject({ code: 'PERSON_NOT_FOUND' });
    });

    it('refuses to rename a deactivated person (P1)', async () => {
      const { id } = await register.execute(
        new RegisterPersonCommand('Ada', 'Lovelace', 'ada@example.com'),
      );
      await deactivate.execute(new DeactivatePersonCommand(id));
      await expect(
        rename.execute(new RenamePersonCommand(id, 'Grace', 'Hopper')),
      ).rejects.toMatchObject({ code: 'PERSON_DEACTIVATED' });
    });
  });

  describe('DeactivatePerson (US-CH-2)', () => {
    it('deactivates the person and publishes PersonDeactivated (US-CH-2 CA1)', async () => {
      const { id } = await register.execute(
        new RegisterPersonCommand('Ada', 'Lovelace', 'ada@example.com'),
      );
      await deactivate.execute(new DeactivatePersonCommand(id));

      expect(await f.persons.statusOf(PersonId.from(id))).toBe('DEACTIVATED');
      expect(f.publisher.ofType('cardholders.PersonDeactivated')).toEqual([
        expect.objectContaining({ aggregateVersion: 2, payload: { personId: id } }),
      ]);
    });

    it('fails with PERSON_NOT_FOUND for an unknown person', async () => {
      await expect(deactivate.execute(new DeactivatePersonCommand(UNKNOWN))).rejects.toMatchObject({
        code: 'PERSON_NOT_FOUND',
      });
    });
  });
});
