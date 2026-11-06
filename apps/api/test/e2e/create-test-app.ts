import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { testDatabaseUrl } from '../postgres/test-database';

/** Application complète (tous les modules, relais d'events actif) sur le Postgres de test. */
export async function createTestApp(): Promise<INestApplication> {
  process.env.DATABASE_URL = testDatabaseUrl();
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.OUTBOX_RELAY_ENABLED = 'true';
  process.env.OUTBOX_POLL_INTERVAL_MS = '100';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
