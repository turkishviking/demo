const base = require('./jest.base.config');

/** Tests E2E de l'API : application Nest complète + Postgres réel. */
/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: 'e2e',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  globalSetup: '<rootDir>/test/postgres/global-setup.ts',
  globalTeardown: '<rootDir>/test/postgres/global-teardown.ts',
  maxWorkers: 1,
  testTimeout: 30000,
};
