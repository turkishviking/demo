import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/**/*.spec.{ts,tsx}'],
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^server-only$': '<rootDir>/test/server-only-stub.ts',
  },
  // Les fichiers de route (app/) sont couverts par les parcours Playwright ; components/ui est généré.
  collectCoverageFrom: [
    '{components,lib}/**/*.{ts,tsx}',
    '!components/ui/**',
    '!**/*.spec.{ts,tsx}',
  ],
  coverageThreshold: { global: { lines: 70, branches: 70 } },
};

export default createJestConfig(config);
