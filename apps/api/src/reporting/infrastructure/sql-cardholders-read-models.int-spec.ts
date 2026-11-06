import type { DataSource } from 'typeorm';
import { describeCardholdersReadModelsContract } from '../../../test/reporting/cardholders-read-models.contract';
import { openTestDataSource, truncate } from '../../../test/postgres/test-database';
import { TransactionContext } from '../../shared/infrastructure/database/transaction-context';
import { TypeormUnitOfWork } from '../../shared/infrastructure/database/typeorm-unit-of-work';
import { SqlCardholdersProjectionStore } from './sql-cardholders-projection-store';
import { SqlCardholdersReadModel } from './sql-cardholders-read-model';

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = await openTestDataSource();
});
afterAll(() => dataSource.destroy());

describeCardholdersReadModelsContract('Postgres', async () => {
  await truncate(dataSource, ['reporting.rm_people', 'reporting.rm_groups']);
  const transactions = new TransactionContext(dataSource);
  const uow = new TypeormUnitOfWork(dataSource, transactions);
  return {
    store: new SqlCardholdersProjectionStore(transactions),
    readModel: new SqlCardholdersReadModel(transactions),
    run: (work) => uow.run(work),
  };
});

describe('SqlCardholdersReadModel', () => {
  it('rejects a forged cursor instead of failing in SQL', async () => {
    const readModel = new SqlCardholdersReadModel(new TransactionContext(dataSource));
    await expect(
      readModel.listPersons({}, { sortKey: 'not-a-date', id: 'x' }, 10),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });
});
