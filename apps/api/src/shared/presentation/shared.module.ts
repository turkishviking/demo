import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { APP_CONFIG, type AppConfig, loadConfig } from '../../config/app-config';
import { CLOCK, type Clock } from '../application/clock.port';
import { COMMAND_BUS, SimpleCommandBus } from '../application/command-bus';
import { CORRELATION_CONTEXT, type CorrelationContext } from '../application/correlation.port';
import { EVENT_BUS, InProcessEventBus } from '../application/event-bus';
import { EVENT_ENVELOPE_FACTORY, EventEnvelopeFactory } from '../application/event-envelope';
import { EVENT_PUBLISHER } from '../application/event-publisher.port';
import { DATABASE_HEALTH_PROBE, OUTBOX_STATS_READER } from '../application/health.port';
import { ID_GENERATOR, type IdGenerator } from '../application/id-generator.port';
import { INBOX, type Inbox } from '../application/inbox.port';
import { QUERY_BUS, SimpleQueryBus } from '../application/query-bus';
import { UNIT_OF_WORK, type UnitOfWork } from '../application/unit-of-work.port';
import { AsyncLocalCorrelationContext } from '../infrastructure/context/async-local-correlation-context';
import { createDataSource } from '../infrastructure/database/data-source';
import { PostgresHealthProbe } from '../infrastructure/database/postgres-health-probe';
import { TransactionContext } from '../infrastructure/database/transaction-context';
import { TypeormUnitOfWork } from '../infrastructure/database/typeorm-unit-of-work';
import { Uuidv7Generator } from '../infrastructure/id/uuidv7-generator';
import { PostgresInbox } from '../infrastructure/inbox/postgres-inbox';
import { OutboxEventPublisher } from '../infrastructure/outbox/outbox-event-publisher';
import { OutboxRelay } from '../infrastructure/outbox/outbox-relay';
import { OutboxRelayRunner } from '../infrastructure/outbox/outbox-relay-runner';
import { PostgresOutboxStatsReader } from '../infrastructure/outbox/postgres-outbox-stats-reader';
import { SystemClock } from '../infrastructure/time/system-clock';
import { HealthController } from './health/health.controller';

const relayLogger = (logger: Logger) => ({
  warn: (message: string, context?: Record<string, unknown>) =>
    logger.warn({ ...context, msg: message }),
  error: (message: string, context?: Record<string, unknown>) =>
    logger.error({ ...context, msg: message }),
});

/**
 * Composition root du shared kernel : DataSource, UnitOfWork, bus, outbox/inbox, horloge, ids.
 * Global : chaque bounded context injecte ces ports par leur token.
 */
@Global()
@Module({
  controllers: [HealthController],
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useFactory: () => new Uuidv7Generator() },
    { provide: CORRELATION_CONTEXT, useClass: AsyncLocalCorrelationContext },
    {
      provide: DataSource,
      inject: [APP_CONFIG],
      useFactory: async (config: AppConfig) => {
        const dataSource = createDataSource(config.databaseUrl);
        await dataSource.initialize();
        if (config.runMigrationsOnStartup) await dataSource.runMigrations();
        return dataSource;
      },
    },
    {
      provide: TransactionContext,
      inject: [DataSource],
      useFactory: (ds: DataSource) => new TransactionContext(ds),
    },
    {
      provide: UNIT_OF_WORK,
      inject: [DataSource, TransactionContext],
      useFactory: (ds: DataSource, tx: TransactionContext) => new TypeormUnitOfWork(ds, tx),
    },
    {
      provide: EVENT_ENVELOPE_FACTORY,
      inject: [CLOCK, ID_GENERATOR, CORRELATION_CONTEXT],
      useFactory: (clock: Clock, ids: IdGenerator, ctx: CorrelationContext) =>
        new EventEnvelopeFactory(clock, ids, ctx),
    },
    {
      provide: EVENT_PUBLISHER,
      inject: [TransactionContext],
      useFactory: (tx: TransactionContext) => new OutboxEventPublisher(tx),
    },
    {
      provide: INBOX,
      inject: [UNIT_OF_WORK, TransactionContext],
      useFactory: (uow: UnitOfWork, tx: TransactionContext) => new PostgresInbox(uow, tx),
    },
    {
      provide: EVENT_BUS,
      inject: [INBOX, CORRELATION_CONTEXT],
      useFactory: (inbox: Inbox, ctx: CorrelationContext) => new InProcessEventBus(inbox, ctx),
    },
    { provide: COMMAND_BUS, useFactory: () => new SimpleCommandBus(3) },
    { provide: QUERY_BUS, useFactory: () => new SimpleQueryBus() },
    {
      provide: OutboxRelay,
      inject: [DataSource, EVENT_BUS, CLOCK, APP_CONFIG],
      useFactory: (ds: DataSource, bus: InProcessEventBus, clock: Clock, config: AppConfig) =>
        new OutboxRelay(
          ds,
          bus,
          clock,
          { batchSize: config.outbox.batchSize, maxAttempts: config.outbox.maxAttempts },
          relayLogger(new Logger(OutboxRelay.name)),
        ),
    },
    {
      provide: OutboxRelayRunner,
      inject: [OutboxRelay, APP_CONFIG],
      useFactory: (relay: OutboxRelay, config: AppConfig) =>
        new OutboxRelayRunner(
          relay,
          config.databaseUrl,
          config.outbox.pollIntervalMs,
          relayLogger(new Logger(OutboxRelayRunner.name)),
        ),
    },
    {
      provide: DATABASE_HEALTH_PROBE,
      inject: [DataSource],
      useFactory: (ds: DataSource) => new PostgresHealthProbe(ds),
    },
    {
      provide: OUTBOX_STATS_READER,
      inject: [DataSource, APP_CONFIG],
      useFactory: (ds: DataSource, config: AppConfig) =>
        new PostgresOutboxStatsReader(ds, config.outbox.maxAttempts),
    },
  ],
  exports: [
    APP_CONFIG,
    CLOCK,
    ID_GENERATOR,
    CORRELATION_CONTEXT,
    DataSource,
    TransactionContext,
    UNIT_OF_WORK,
    EVENT_ENVELOPE_FACTORY,
    EVENT_PUBLISHER,
    EVENT_BUS,
    COMMAND_BUS,
    QUERY_BUS,
    OutboxRelay,
  ],
})
export class SharedModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly dataSource: DataSource,
    private readonly relayRunner: OutboxRelayRunner,
  ) {}

  /** Le relais démarre après l'init de tous les modules, donc après tous les `subscribe`. */
  async onApplicationBootstrap(): Promise<void> {
    if (this.config.outbox.relayEnabled) await this.relayRunner.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.relayRunner.stop();
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }
}
