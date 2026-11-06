import type { DataSource } from 'typeorm';
import { createDataSource } from '../../src/shared/infrastructure/database/data-source';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set: run with the int/e2e Jest config');
  return url;
}

export async function openTestDataSource(): Promise<DataSource> {
  const dataSource = createDataSource(testDatabaseUrl());
  await dataSource.initialize();
  return dataSource;
}

/** Vide les tables du socle (et les tables additionnelles fournies) entre deux tests. */
export async function truncate(dataSource: DataSource, extraTables: string[] = []): Promise<void> {
  const tables = ['shared.outbox', 'shared.inbox', ...extraTables];
  await dataSource.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}
