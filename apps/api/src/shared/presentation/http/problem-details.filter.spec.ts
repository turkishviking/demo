import { type ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConcurrencyError } from '../../application/concurrency-error';
import { DomainError, NotFoundError } from '../../domain/domain-error';
import { AsyncLocalCorrelationContext } from '../../infrastructure/context/async-local-correlation-context';
import { registerDomainErrorStatuses, resetDomainErrorStatuses } from './domain-error-status';
import { ProblemDetailsFilter } from './problem-details.filter';
import { RequestValidationException } from './request-validation';

class GroupFullError extends DomainError {
  readonly code = 'GROUP_FULL';
  constructor() {
    super('Group g-1 already has 10 members', { groupId: 'g-1' });
  }
}

class CardNotFoundError extends NotFoundError {
  readonly code = 'CARD_NOT_FOUND';
  constructor() {
    super('Card c-1 not found');
  }
}

class SomeRuleError extends DomainError {
  readonly code = 'SOME_RULE';
  constructor() {
    super('Some rule broken');
  }
}

function fakeHost() {
  const response = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('ProblemDetailsFilter', () => {
  const correlation = new AsyncLocalCorrelationContext();
  const filter = new ProblemDetailsFilter(correlation);

  beforeEach(() => resetDomainErrorStatuses());

  it('maps a domain error to its registered status with a stable code', () => {
    registerDomainErrorStatuses({ GROUP_FULL: 409 });
    expect(filter.toProblem(new GroupFullError())).toEqual({
      type: 'https://cardsim.local/errors/group-full',
      title: 'Group full',
      status: 409,
      code: 'GROUP_FULL',
      detail: 'Group g-1 already has 10 members',
    });
  });

  it('defaults to 404 for NotFoundError and 422 for other domain errors', () => {
    expect(filter.toProblem(new CardNotFoundError()).status).toBe(404);
    expect(filter.toProblem(new SomeRuleError()).status).toBe(422);
  });

  it('maps ConcurrencyError to 409 CONCURRENT_MODIFICATION', () => {
    expect(filter.toProblem(new ConcurrencyError('Card', 'c-1', 2))).toMatchObject({
      status: 409,
      code: 'CONCURRENT_MODIFICATION',
    });
  });

  it('maps validation errors to 400 with the field issues', () => {
    const issues = [{ field: 'name', messages: ['name should not be empty'] }];
    expect(filter.toProblem(new RequestValidationException(issues))).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: issues,
    });
  });

  it('maps other HTTP exceptions', () => {
    expect(filter.toProblem(new NotFoundException())).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(filter.toProblem(new BadRequestException())).toMatchObject({
      status: 400,
      code: 'HTTP_400',
    });
  });

  it('hides unexpected errors behind a 500 and logs them', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, response } = fakeHost();

    correlation.run({ correlationId: 'corr-1', causationId: null }, () =>
      filter.catch(new Error('database exploded'), host),
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        detail: 'An unexpected error occurred',
        correlationId: 'corr-1',
      }),
    );
    expect(log).toHaveBeenCalled();
  });

  it('also handles thrown non-Error values', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, response } = fakeHost();
    filter.catch('just a string', host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.not.objectContaining({ correlationId: expect.anything() }),
    );
  });
});

describe('registerDomainErrorStatuses', () => {
  beforeEach(() => resetDomainErrorStatuses());

  it('refuses conflicting mappings for the same code', () => {
    registerDomainErrorStatuses({ GROUP_FULL: 409 });
    expect(() => registerDomainErrorStatuses({ GROUP_FULL: 409 })).not.toThrow();
    expect(() => registerDomainErrorStatuses({ GROUP_FULL: 422 })).toThrow(/already mapped/);
  });
});
