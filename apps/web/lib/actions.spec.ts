/** @jest-environment node */
import { failure, field } from './actions';
import { ApiError } from './api/server';

describe('server action helpers', () => {
  it('turns an ApiError into an error state', () => {
    const problem = { type: 't', title: 'Full', status: 409, code: 'GROUP_FULL' };
    expect(failure(new ApiError(problem))).toEqual({ status: 'error', problem });
  });

  it('rethrows unexpected errors (handled by error.tsx)', () => {
    expect(() => failure(new Error('boom'))).toThrow('boom');
  });

  it('reads text fields from FormData', () => {
    const data = new FormData();
    data.set('name', 'Team');
    data.set('file', new Blob(['x']));
    expect(field(data, 'name')).toBe('Team');
    expect(field(data, 'file')).toBe('');
    expect(field(data, 'missing')).toBe('');
  });
});
