import type { Response } from 'express';
import { SequentialIdGenerator } from '../../../../test/fakes/sequential-id-generator';
import { AsyncLocalCorrelationContext } from '../../infrastructure/context/async-local-correlation-context';
import { correlationMiddleware, type RequestWithCorrelation } from './correlation.middleware';

function run(header: string | undefined) {
  const context = new AsyncLocalCorrelationContext();
  const middleware = correlationMiddleware(context, new SequentialIdGenerator());
  const req = { header: () => header } as unknown as RequestWithCorrelation;
  const res = { setHeader: jest.fn() } as unknown as Response;
  let inside: unknown;
  middleware(req, res, () => {
    inside = context.current();
  });
  return { req, res, inside };
}

describe('correlationMiddleware', () => {
  it('reuses a valid incoming correlation id', () => {
    const { req, res, inside } = run('abc-123');
    expect(req.correlationId).toBe('abc-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'abc-123');
    expect(inside).toEqual({ correlationId: 'abc-123', causationId: null });
  });

  it.each([undefined, '', 'has spaces', 'x'.repeat(101)])('generates an id for %p', (header) => {
    const { req } = run(header);
    expect(req.correlationId).toBe('00000000-0000-7000-8000-000000000001');
  });
});
