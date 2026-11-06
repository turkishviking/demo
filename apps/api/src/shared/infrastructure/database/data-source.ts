import { DataSource, type DataSourceOptions } from 'typeorm';
import { MIGRATIONS } from '../../../migrations';

/**
 * TypeORM n'est utilisé que pour la connexion, les transactions et les migrations :
 * aucune entité ORM, les repositories écrivent leur SQL (ADR-0003).
 */
export function dataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [],
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
    migrationsTransactionMode: 'each',
    synchronize: false,
    logging: false,
  };
}

export function createDataSource(databaseUrl: string): DataSource {
  return new DataSource(dataSourceOptions(databaseUrl));
}
