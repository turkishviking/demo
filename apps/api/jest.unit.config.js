const base = require('./jest.base.config');

/** Tests unitaires : aucune I/O, fakes in-memory. */
/** @type {import('jest').Config} */
module.exports = {
  ...base,
  displayName: 'unit',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.int-spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/main.ts',
    // déclarations pures (interfaces + token) et barrels : rien à exécuter
    '!src/**/*.port.ts',
    '!src/**/index.ts',
    '!src/migrations/**',
    '!src/**/*.module.ts',
    '!src/**/data-source.cli.ts',
  ],
  coverageThreshold: {
    './src/**/domain/**/*.ts': { lines: 95, branches: 90 },
    './src/**/application/**/*.ts': { lines: 90, branches: 85 },
  },
};
