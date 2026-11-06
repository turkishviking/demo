import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  CORRELATION_CONTEXT,
  type CorrelationContext,
} from './shared/application/correlation.port';
import { ID_GENERATOR, type IdGenerator } from './shared/application/id-generator.port';
import { correlationMiddleware } from './shared/presentation/http/correlation.middleware';
import { ProblemDetailsFilter } from './shared/presentation/http/problem-details.filter';
import { createValidationPipe } from './shared/presentation/http/request-validation';

export const API_PREFIX = 'api/v1';

/** Configuration HTTP commune à `main.ts` et aux tests E2E. */
export function configureApp(app: INestApplication): void {
  const correlation = app.get<CorrelationContext>(CORRELATION_CONTEXT);
  const ids = app.get<IdGenerator>(ID_GENERATOR);

  app.use(correlationMiddleware(correlation, ids));
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter(correlation));
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('CardSim API').setVersion('v1').build(),
  );
  SwaggerModule.setup('api/docs', app, document);
}
