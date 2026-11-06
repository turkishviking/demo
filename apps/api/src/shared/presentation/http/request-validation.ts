import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';
import type { ValidationIssue } from '@cardsim/shared';

export class RequestValidationException extends BadRequestException {
  constructor(readonly issues: ValidationIssue[]) {
    super('Request validation failed');
  }
}

export function flattenValidationErrors(errors: ValidationError[], parent = ''): ValidationIssue[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: ValidationIssue[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new RequestValidationException(flattenValidationErrors(errors)),
  });
}
