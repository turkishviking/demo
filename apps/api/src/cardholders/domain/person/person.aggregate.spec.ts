import { aPerson } from '../../../../test/cardholders/builders';
import { Email } from './email.vo';
import { FullName } from './full-name.vo';
import { Person } from './person.aggregate';
import { PersonId } from './person-id';

const ID = PersonId.from('00000000-0000-7000-8000-000000000001');
const AT = new Date('2026-03-01T08:30:00.000Z');

describe('Person', () => {
  describe('register (US-CH-1)', () => {
    it('creates an ACTIVE person and records PersonRegistered (US-CH-1 CA1)', () => {
      const person = Person.register({
        id: ID,
        fullName: FullName.create('Ada', 'Lovelace'),
        email: Email.create('Ada@Example.com'),
        registeredAt: AT,
      });

      expect(person.status).toBe('ACTIVE');
      expect(person.isActive).toBe(true);
      expect(person.isNew).toBe(true);
      expect(person.registeredAt).toEqual(AT);
      expect(person.pullEvents()).toEqual([
        {
          type: 'cardholders.PersonRegistered',
          version: 1,
          payload: {
            personId: ID,
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
            registeredAt: AT.toISOString(),
          },
        },
      ]);
    });

    it('does not share its registration date with the caller', () => {
      const at = new Date(AT);
      const person = Person.register({
        id: ID,
        fullName: FullName.create('Ada', 'Lovelace'),
        email: Email.create('ada@example.com'),
        registeredAt: at,
      });
      at.setFullYear(2000);
      person.registeredAt.setFullYear(1990);
      expect(person.registeredAt).toEqual(AT);
    });
  });

  describe('restore', () => {
    it('rebuilds the aggregate without recording events', () => {
      const person = aPerson().deactivated().build();
      expect(person.status).toBe('DEACTIVATED');
      expect(person.version).toBe(1);
      expect(person.pullEvents()).toEqual([]);
      expect(Person.restore(person.snapshot(), 4).snapshot()).toEqual(person.snapshot());
    });
  });

  describe('rename', () => {
    it('changes the name and records PersonRenamed', () => {
      const person = aPerson().named('Ada', 'Lovelace').build();
      person.rename(FullName.create('Ada', 'King'));

      expect(person.fullName.lastName).toBe('King');
      expect(person.pullEvents()).toEqual([
        {
          type: 'cardholders.PersonRenamed',
          version: 1,
          payload: { personId: person.id, firstName: 'Ada', lastName: 'King' },
        },
      ]);
    });

    it('is a no-op when the name does not change', () => {
      const person = aPerson().named('Ada', 'Lovelace').build();
      person.rename(FullName.create('Ada', 'Lovelace'));
      expect(person.pullEvents()).toEqual([]);
    });

    it('refuses to rename a deactivated person (P1)', () => {
      const person = aPerson().deactivated().build();
      expect(() => person.rename(FullName.create('Grace', 'Hopper'))).toThrow(
        expect.objectContaining({ code: 'PERSON_DEACTIVATED' }),
      );
    });
  });

  describe('deactivate (US-CH-2)', () => {
    it('switches to DEACTIVATED and records PersonDeactivated (US-CH-2 CA1)', () => {
      const person = aPerson().build();
      person.deactivate();

      expect(person.status).toBe('DEACTIVATED');
      expect(person.isActive).toBe(false);
      expect(person.pullEvents()).toEqual([
        { type: 'cardholders.PersonDeactivated', version: 1, payload: { personId: person.id } },
      ]);
    });

    it('cannot be deactivated twice nor reactivated (P1)', () => {
      const person = aPerson().deactivated().build();
      expect(() => person.deactivate()).toThrow(
        expect.objectContaining({ code: 'PERSON_DEACTIVATED' }),
      );
    });
  });
});
