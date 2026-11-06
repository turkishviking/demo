/**
 * Délimite une transaction. Les repositories utilisés dans `work` partagent la même
 * transaction. Réentrant : un `run` imbriqué rejoint la transaction courante.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
