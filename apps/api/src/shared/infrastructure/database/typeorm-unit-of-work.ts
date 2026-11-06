import type { DataSource } from 'typeorm';
import type { UnitOfWork } from '../../application/unit-of-work.port';
import type { TransactionContext } from './transaction-context';

export class TypeormUnitOfWork implements UnitOfWork {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactions: TransactionContext,
  ) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.transactions.isInTransaction()) return work();
    return this.dataSource.transaction('READ COMMITTED', (manager) =>
      this.transactions.run(manager, work),
    );
  }
}
