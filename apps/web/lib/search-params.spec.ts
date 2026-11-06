import { oneOf, param } from './search-params';

describe('search params', () => {
  it('reads the first non-empty value', () => {
    expect(param({ q: 'ada' }, 'q')).toBe('ada');
    expect(param({ q: ['a', 'b'] }, 'q')).toBe('a');
    expect(param({ q: '' }, 'q')).toBeUndefined();
    expect(param({}, 'q')).toBeUndefined();
  });

  it('keeps only allowed values', () => {
    const statuses = ['ACTIVE', 'ARCHIVED'] as const;
    expect(oneOf({ status: 'ARCHIVED' }, 'status', statuses)).toBe('ARCHIVED');
    expect(oneOf({ status: 'DROP TABLE' }, 'status', statuses)).toBeUndefined();
  });
});
