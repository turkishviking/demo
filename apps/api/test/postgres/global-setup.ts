import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDataSource } from '../../src/shared/infrastructure/database/data-source';

declare global {
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

/** Démarre un Postgres jetable, applique les migrations et expose son URL aux tests. */
export default async function globalSetup(): Promise<void> {
  // Sur les hôtes SELinux (Fedora, Bazzite…), Ryuk doit être privilégié pour lire le socket Docker.
  process.env.TESTCONTAINERS_RYUK_PRIVILEGED ??= 'true';

  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('cardsim_test')
    .withUsername('cardsim')
    .withPassword('cardsim')
    // Base jetable : pas de durabilité, données en mémoire (les fsync coûtent ~1 s par TRUNCATE).
    .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
    .withCommand([
      'postgres',
      '-c',
      'fsync=off',
      '-c',
      'synchronous_commit=off',
      '-c',
      'full_page_writes=off',
    ])
    .start();
  globalThis.__POSTGRES_CONTAINER__ = container;

  const url = container.getConnectionUri();
  process.env.TEST_DATABASE_URL = url;

  const dataSource = createDataSource(url);
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
