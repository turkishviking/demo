/** Réponse d'erreur de l'API (RFC 9457, `application/problem+json`). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  /** Code stable, utilisé par le front pour afficher un message. */
  code: string;
  detail?: string;
  correlationId?: string;
  errors?: ValidationIssue[];
}

export interface ValidationIssue {
  field: string;
  messages: string[];
}

/** Codes d'erreur techniques transverses. Les codes métier sont ajoutés par context. */
export type TechnicalErrorCode =
  'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONCURRENT_MODIFICATION' | 'INTERNAL_ERROR';
