import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import {
  CORRELATION_CONTEXT,
  type CorrelationContext,
} from './shared/application/correlation.port';
import type { RequestWithCorrelation } from './shared/presentation/http/correlation.middleware';
import { SharedModule } from './shared/presentation/shared.module';

@Module({
  imports: [
    SharedModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG, CORRELATION_CONTEXT],
      useFactory: (config: AppConfig, correlation: CorrelationContext) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (req) => (req as RequestWithCorrelation).correlationId ?? 'unknown',
          customAttributeKeys: { reqId: 'correlationId' },
          mixin: () => {
            const current = correlation.current();
            return current ? { correlationId: current.correlationId } : {};
          },
          ...(config.env === 'development'
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        },
      }),
    }),
    // Les bounded contexts (CardholdersModule, CardsModule, …) s'ajoutent ici à partir de M1.
  ],
})
export class AppModule {}
