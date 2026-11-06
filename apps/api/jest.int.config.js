const base = require('./jest.base.config');

/** Tests d'intégration : Postgres réel via Testcontainers, exécutés en série. */
/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: 'int',
  testMatch: ['<rootDir>/src/**/*.int-spec.ts'],
  globalSetup: '<rootDir>/test/postgres/global-setup.ts',
  globalTeardown: '<rootDir>/test/postgres/global-teardown.ts',
  maxWorkers: 1,
  testTimeout: 30000,
};
