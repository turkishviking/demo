import { ParseUUIDPipe } from '@nestjs/common';
import { RequestValidationException } from './request-validation';

/** Valide un paramètre de route UUID ; une valeur invalide donne un 400 `VALIDATION_ERROR`. */
export const uuidParam = (field = 'id'): ParseUUIDPipe =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new RequestValidationException([{ field, messages: [`${field} must be a UUID`] }]),
  });
