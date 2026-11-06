import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { APP_CONFIG, type AppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // pas de fichier .env : on utilise l'environnement tel quel
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port, config.host);
  app.get(Logger).log(`API listening on http://${config.host}:${config.port}`);
}

void bootstrap();
