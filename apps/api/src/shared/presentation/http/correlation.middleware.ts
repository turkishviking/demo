import type { NextFunction, Request, Response } from 'express';
import type { CorrelationContext } from '../../application/correlation.port';
import type { IdGenerator } from '../../application/id-generator.port';

export const CORRELATION_HEADER = 'x-correlation-id';
const ACCEPTED_ID = /^[A-Za-z0-9._-]{1,100}$/;

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

/**
 * Reprend l'en-tête `x-correlation-id` s'il est valide (sinon en génère un), le renvoie
 * dans la réponse et exécute la suite de la requête dans ce contexte de corrélation.
 */
export function correlationMiddleware(context: CorrelationContext, ids: IdGenerator) {
  return (req: RequestWithCorrelation, res: Response, next: NextFunction): void => {
    const header = req.header(CORRELATION_HEADER);
    const correlationId = header && ACCEPTED_ID.test(header) ? header : ids.next();
    req.correlationId = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);
    context.run({ correlationId, causationId: null }, () => next());
  };
}
