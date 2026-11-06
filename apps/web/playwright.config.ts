import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours UI, sur l'app complète (web + api + Postgres).
 * - Par défaut : l'API compilée et le front sont démarrés ici, sur une base dédiée `cardsim_e2e`
 *   du Postgres de `docker compose` (créée au besoin ; `E2E_DATABASE_URL` pour en viser une autre).
 *   Les tests créent des données uniques : la base peut être réutilisée d'un run à l'autre.
 * - `E2E_BASE_URL=http://127.0.0.1:3000` : vise une stack déjà lancée (ex. `docker compose up`).
 */
const external = process.env.E2E_BASE_URL;
const WEB_PORT = 3100;
const API_PORT = 3101;
const API_URL = `http://127.0.0.1:${API_PORT}/api/v1`;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://cardsim:cardsim@127.0.0.1:5432/cardsim_e2e';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: external ?? `http://127.0.0.1:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(external
    ? {}
    : {
        webServer: [
          {
            command:
              'pnpm --filter api build && node ../api/scripts/ensure-database.cjs && node ../api/dist/main.js',
            url: `${API_URL}/health`,
            env: {
              NODE_ENV: 'production',
              HOST: '127.0.0.1',
              PORT: String(API_PORT),
              DATABASE_URL,
              DATABASE_RUN_MIGRATIONS: 'true',
              LOG_LEVEL: 'warn',
            },
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
          },
          {
            command: `pnpm build && pnpm exec next start --port ${WEB_PORT} --hostname 127.0.0.1`,
            url: `http://127.0.0.1:${WEB_PORT}`,
            env: { API_URL },
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
          },
        ],
      }),
});
