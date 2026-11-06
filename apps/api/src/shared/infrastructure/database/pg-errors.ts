interface PgErrorFields {
  code?: string;
  constraint?: string;
  detail?: string;
  driverError?: PgErrorFields;
}

const UNIQUE_VIOLATION = '23505';

/**
 * Vrai si l'erreur est une violation de la contrainte unique (ou de l'index unique) `constraint`.
 * TypeORM recopie les champs du driver `pg` sur `QueryFailedError` ; on lit aussi `driverError`.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const fields = error as PgErrorFields;
  const source = fields.code ? fields : fields.driverError;
  return source?.code === UNIQUE_VIOLATION && source.constraint === constraint;
}

/** Valeur de la clé en conflit, extraite du `detail` Postgres : `Key (person_id)=(…) already exists.` */
export function conflictingKey(error: unknown): string | undefined {
  const fields = (error ?? {}) as PgErrorFields;
  const detail = fields.detail ?? fields.driverError?.detail;
  return detail?.match(/=\(([^)]*)\)/)?.[1];
}
