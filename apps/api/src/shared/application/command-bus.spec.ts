import { Command, CommandHandlerNotFoundError, SimpleCommandBus } from './command-bus';
import { ConcurrencyError } from './concurrency-error';
import { Query, QueryHandlerNotFoundError, SimpleQueryBus } from './query-bus';

class Rename extends Command<string> {
  constructor(readonly name: string) {
    super();
  }
}

class Unregistered extends Command {}

describe('SimpleCommandBus', () => {
  it('routes a command to its handler and returns its result', async () => {
    const bus = new SimpleCommandBus();
    bus.register(Rename, { execute: async (cmd: Rename) => `renamed:${cmd.name}` });

    await expect(bus.execute(new Rename('x'))).resolves.toBe('renamed:x');
  });

  it('fails when no handler is registered', async () => {
    await expect(new SimpleCommandBus().execute(new Unregistered())).rejects.toThrow(
      CommandHandlerNotFoundError,
    );
  });

  it('refuses two handlers for the same command', () => {
    const bus = new SimpleCommandBus();
    const handler = { execute: async () => 'ok' };
    bus.register(Rename, handler);
    expect(() => bus.register(Rename, handler)).toThrow(/already registered/);
  });

  it('retries on ConcurrencyError, then succeeds', async () => {
    const bus = new SimpleCommandBus(3);
    const execute = jest
      .fn<Promise<string>, [Rename]>()
      .mockRejectedValueOnce(new ConcurrencyError('Card', 'c-1', 1))
      .mockRejectedValueOnce(new ConcurrencyError('Card', 'c-1', 2))
      .mockResolvedValueOnce('ok');
    bus.register(Rename, { execute });

    await expect(bus.execute(new Rename('x'))).resolves.toBe('ok');
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('gives up after maxAttempts concurrency errors', async () => {
    const bus = new SimpleCommandBus(2);
    const execute = jest.fn(async () => {
      throw new ConcurrencyError('Card', 'c-1', 1);
    });
    bus.register(Rename, { execute });

    await expect(bus.execute(new Rename('x'))).rejects.toThrow(ConcurrencyError);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const bus = new SimpleCommandBus(3);
    const execute = jest.fn(async () => {
      throw new Error('business failure');
    });
    bus.register(Rename, { execute });

    await expect(bus.execute(new Rename('x'))).rejects.toThrow('business failure');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('requires at least one attempt', () => {
    expect(() => new SimpleCommandBus(0)).toThrow(RangeError);
  });
});

class CountThings extends Query<number> {}
class UnknownQuery extends Query<number> {}

describe('SimpleQueryBus', () => {
  it('routes a query to its handler', async () => {
    const bus = new SimpleQueryBus();
    bus.register(CountThings, { execute: async () => 42 });
    await expect(bus.execute(new CountThings())).resolves.toBe(42);
  });

  it('fails when no handler is registered', async () => {
    await expect(new SimpleQueryBus().execute(new UnknownQuery())).rejects.toThrow(
      QueryHandlerNotFoundError,
    );
  });

  it('refuses two handlers for the same query', () => {
    const bus = new SimpleQueryBus();
    bus.register(CountThings, { execute: async () => 1 });
    expect(() => bus.register(CountThings, { execute: async () => 2 })).toThrow(
      /already registered/,
    );
  });
});
