import { InvalidConfigError, loadConfig } from './app-config';

describe('loadConfig', () => {
  const minimal = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

  it('applies defaults: localhost only, relay enabled', () => {
    expect(loadConfig(minimal)).toEqual({
      env: 'development',
      host: '127.0.0.1',
      port: 3001,
      databaseUrl: minimal.DATABASE_URL,
      runMigrationsOnStartup: false,
      logLevel: 'info',
      outbox: { relayEnabled: true, pollIntervalMs: 1000, batchSize: 100, maxAttempts: 10 },
    });
  });

  it('parses explicit values', () => {
    const config = loadConfig({
      ...minimal,
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_RUN_MIGRATIONS: 'true',
      OUTBOX_RELAY_ENABLED: '0',
      OUTBOX_MAX_ATTEMPTS: '3',
    });
    expect(config).toMatchObject({
      env: 'test',
      port: 4000,
      runMigrationsOnStartup: true,
      outbox: { relayEnabled: false, maxAttempts: 3 },
    });
  });

  it('fails fast with every invalid variable listed', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(InvalidConfigError);
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/- DATABASE_URL: /);
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/- PORT: /);
  });
});
