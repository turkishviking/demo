import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url(),
  DATABASE_RUN_MIGRATIONS: booleanFromString.default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  OUTBOX_RELAY_ENABLED: booleanFromString.default(true),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(50).default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(10),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  runMigrationsOnStartup: boolean;
  logLevel: string;
  outbox: {
    relayEnabled: boolean;
    pollIntervalMs: number;
    batchSize: number;
    maxAttempts: number;
  };
}

export const APP_CONFIG = Symbol('AppConfig');

export class InvalidConfigError extends Error {
  constructor(issues: string[]) {
    super(`Invalid configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'InvalidConfigError';
  }
}

/** Valide l'environnement au démarrage : une configuration invalide arrête l'application. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new InvalidConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    runMigrationsOnStartup: e.DATABASE_RUN_MIGRATIONS,
    logLevel: e.LOG_LEVEL,
    outbox: {
      relayEnabled: e.OUTBOX_RELAY_ENABLED,
      pollIntervalMs: e.OUTBOX_POLL_INTERVAL_MS,
      batchSize: e.OUTBOX_BATCH_SIZE,
      maxAttempts: e.OUTBOX_MAX_ATTEMPTS,
    },
  };
}
