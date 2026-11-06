import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ProblemDetails } from '@cardsim/shared';
import type { Response } from 'express';
import { ConcurrencyError } from '../../application/concurrency-error';
import type { CorrelationContext } from '../../application/correlation.port';
import { DomainError, NotFoundError } from '../../domain/domain-error';
import { statusForDomainErrorCode } from './domain-error-status';
import { RequestValidationException } from './request-validation';

const ERROR_TYPE_BASE = 'https://cardsim.local/errors/';

/** Traduit toute exception en `application/problem+json` (RFC 9457). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly correlation: CorrelationContext) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const problem = this.toProblem(exception);
    const correlationId = this.correlation.current()?.correlationId;
    if (correlationId) problem.correlationId = correlationId;

    if (problem.status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }

    response.status(problem.status).type('application/problem+json').json(problem);
  }

  toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof DomainError) {
      const status =
        statusForDomainErrorCode(exception.code) ??
        (exception instanceof NotFoundError
          ? HttpStatus.NOT_FOUND
          : HttpStatus.UNPROCESSABLE_ENTITY);
      return problem(exception.code, status, exception.message);
    }

    if (exception instanceof ConcurrencyError) {
      return problem(exception.code, HttpStatus.CONFLICT, exception.message);
    }

    if (exception instanceof RequestValidationException) {
      return {
        ...problem('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, 'Request validation failed'),
        errors: exception.issues,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : `HTTP_${status}`;
      return problem(code, status, exception.message);
    }

    return problem(
      'INTERNAL_ERROR',
      HttpStatus.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred',
    );
  }
}

function problem(code: string, status: number, detail: string): ProblemDetails {
  return {
    type: ERROR_TYPE_BASE + code.toLowerCase().replaceAll('_', '-'),
    title: titleFromCode(code),
    status,
    code,
    detail,
  };
}

function titleFromCode(code: string): string {
  const words = code.toLowerCase().split('_');
  const sentence = words.join(' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
