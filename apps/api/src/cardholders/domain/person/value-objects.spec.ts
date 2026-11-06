import { Email } from './email.vo';
import { FullName } from './full-name.vo';

describe('FullName', () => {
  it('trims first and last names', () => {
    const name = FullName.create('  Ada ', ' Lovelace  ');
    expect(name.firstName).toBe('Ada');
    expect(name.lastName).toBe('Lovelace');
    expect(name.toString()).toBe('Ada Lovelace');
  });

  it.each([
    ['', 'Lovelace', 'firstName'],
    ['Ada', '   ', 'lastName'],
    ['x'.repeat(101), 'Lovelace', 'firstName'],
    ['Ada', 'x'.repeat(101), 'lastName'],
  ])('rejects %p %p (1 to 100 characters each)', (first, last, field) => {
    expect(() => FullName.create(first, last)).toThrow(
      expect.objectContaining({ code: 'INVALID_FULL_NAME', context: { field } }),
    );
  });

  it('accepts exactly 100 characters', () => {
    expect(FullName.create('x'.repeat(100), 'y').firstName).toHaveLength(100);
  });

  it('compares by value', () => {
    expect(FullName.create('Ada', 'Lovelace').equals(FullName.create(' Ada', 'Lovelace'))).toBe(
      true,
    );
    expect(FullName.create('Ada', 'Lovelace').equals(FullName.create('Ada', 'Byron'))).toBe(false);
  });
});

describe('Email (P2)', () => {
  it('normalizes to trimmed lower case', () => {
    expect(Email.create('  Ada.Lovelace@Example.COM ').value).toBe('ada.lovelace@example.com');
    expect(Email.create('a@b.io').toString()).toBe('a@b.io');
  });

  it.each(['', 'ada', 'ada@', '@example.com', 'ada@example', 'ada lovelace@example.com', 'a@b..c'])(
    'rejects invalid email %p',
    (raw) => {
      expect(() => Email.create(raw)).toThrow(expect.objectContaining({ code: 'INVALID_EMAIL' }));
    },
  );

  it('rejects emails longer than 254 characters', () => {
    expect(() => Email.create(`${'a'.repeat(250)}@b.io`)).toThrow(
      expect.objectContaining({ code: 'INVALID_EMAIL' }),
    );
  });
});
