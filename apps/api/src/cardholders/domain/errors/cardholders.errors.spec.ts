import { PersonAlreadyInAGroupError } from './cardholders.errors';

describe('PersonAlreadyInAGroupError', () => {
  it('names the current group when it is known', () => {
    const error = new PersonAlreadyInAGroupError('p-1', 'g-1');
    expect(error.message).toBe('Person p-1 is already in a group (g-1)');
    expect(error.context).toEqual({ personId: 'p-1', groupId: 'g-1' });
  });

  it('works without the group (unique constraint detected by the database)', () => {
    const error = new PersonAlreadyInAGroupError('p-1');
    expect(error.message).toBe('Person p-1 is already in a group');
    expect(error.context).toEqual({ personId: 'p-1' });
    expect(error.code).toBe('PERSON_ALREADY_IN_A_GROUP');
  });
});
