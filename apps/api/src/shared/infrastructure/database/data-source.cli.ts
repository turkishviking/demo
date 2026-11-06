/** Point d'entrée de la CLI TypeORM (`pnpm --filter api migration:run`). */
import { loadConfig } from '../../../config/app-config';
import { createDataSource } from './data-source';

try {
  process.loadEnvFile();
} catch {
  // pas de fichier .env : on utilise l'environnement tel quel
}

export default createDataSource(loadConfig().databaseUrl);
