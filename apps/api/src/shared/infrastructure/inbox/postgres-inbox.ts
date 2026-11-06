import type { Inbox } from '../../application/inbox.port';
import type { UnitOfWork } from '../../application/unit-of-work.port';
import { sql } from '../database/sql';
import type { TransactionContext } from '../database/transaction-context';

/**
 * L'insertion dans l'inbox et l'effet de l'abonné partagent la même transaction :
 * si l'abonné échoue, la ligne d'inbox disparaît avec le rollback et l'event sera retraité.
 * Deux traitements concurrents du même event se sérialisent sur la clé primaire.
 */
export class PostgresInbox implements Inbox {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly transactions: TransactionContext,
  ) {}

  runOnce(subscriber: string, eventId: string, work: () => Promise<void>): Promise<boolean> {
    return this.unitOfWork.run(async () => {
      const { rowCount } = await sql(
        this.transactions.requireTransactional(),
        `INSERT INTO shared.inbox (subscriber, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [subscriber, eventId],
      );
      if (rowCount === 0) return false;
      await work();
      return true;
    });
  }
}
