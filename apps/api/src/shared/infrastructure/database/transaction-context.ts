import { AsyncLocalStorage } from 'node:async_hooks';
import type { DataSource, EntityManager } from 'typeorm';

/**
 * Porte l'`EntityManager` de la transaction courante. Les repositories l'obtiennent via
 * `current()` : ils participent à la transaction ouverte par le `UnitOfWork` sans la recevoir
 * en paramètre.
 */
export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<EntityManager>();

  constructor(private readonly dataSource: DataSource) {}

  /** Manager transactionnel courant, ou le manager par défaut (hors transaction). */
  current(): EntityManager {
    return this.storage.getStore() ?? this.dataSource.manager;
  }

  /** Manager transactionnel courant ; lève une erreur hors transaction. */
  requireTransactional(): EntityManager {
    const manager = this.storage.getStore();
    if (!manager) throw new Error('This operation must run inside UnitOfWork.run()');
    return manager;
  }

  isInTransaction(): boolean {
    return this.storage.getStore() !== undefined;
  }

  run<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    return this.storage.run(manager, work);
  }
}
