import { readYourWrite } from './consistency';

describe('readYourWrite', () => {
  it('reads again until the read model is up to date', async () => {
    const values = [null, null, { name: 'Team' }];
    const read = jest.fn(async () => values.shift() ?? null);

    const result = await readYourWrite(read, (v) => v !== null, { intervalMs: 1 });

    expect(result).toEqual({ name: 'Team' });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('returns the last value read when the delay expires, without throwing', async () => {
    const read = jest.fn(async () => 'stale');
    const result = await readYourWrite(read, (v) => v === 'fresh', {
      timeoutMs: 20,
      intervalMs: 5,
    });
    expect(result).toBe('stale');
    expect(read.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not wait when the first read is already up to date', async () => {
    const read = jest.fn(async () => 1);
    await readYourWrite(read, () => true);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
