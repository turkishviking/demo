import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../shared/application/event-bus';
import { QUERY_BUS, type SimpleQueryBus } from '../../shared/application/query-bus';
import { TransactionContext } from '../../shared/infrastructure/database/transaction-context';
import { registerDomainErrorStatuses } from '../../shared/presentation/http/domain-error-status';
import {
  CARDHOLDERS_PROJECTION_STORE,
  type CardholdersProjectionStore,
} from '../application/ports/cardholders-projection-store.port';
import {
  CARDHOLDERS_READ_MODEL,
  type CardholdersReadModel,
} from '../application/ports/cardholders-read-model.port';
import { CardholdersProjection } from '../application/projections/cardholders.projection';
import {
  GetGroupDetailsQuery,
  GetPersonDetailsQuery,
  ListGroupsQuery,
  ListPersonsQuery,
} from '../application/queries/cardholders.queries';
import {
  GetGroupDetailsHandler,
  GetPersonDetailsHandler,
  ListGroupsHandler,
  ListPersonsHandler,
} from '../application/queries/cardholders.query-handlers';
import { SqlCardholdersProjectionStore } from '../infrastructure/sql-cardholders-projection-store';
import { SqlCardholdersReadModel } from '../infrastructure/sql-cardholders-read-model';
import { GroupsReadController, PersonsReadController } from './http/cardholders-read.controllers';
import { reportingSubscriptions } from './messaging/reporting.subscriptions';

/** Composition root de Reporting : projections (write des read models) et queries (lecture). */
@Module({
  controllers: [PersonsReadController, GroupsReadController],
  providers: [
    {
      provide: CARDHOLDERS_PROJECTION_STORE,
      inject: [TransactionContext],
      useFactory: (tx: TransactionContext) => new SqlCardholdersProjectionStore(tx),
    },
    {
      provide: CARDHOLDERS_READ_MODEL,
      inject: [TransactionContext],
      useFactory: (tx: TransactionContext) => new SqlCardholdersReadModel(tx),
    },
  ],
})
export class ReportingModule implements OnModuleInit {
  constructor(
    @Inject(QUERY_BUS) private readonly queries: SimpleQueryBus,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(CARDHOLDERS_PROJECTION_STORE) private readonly store: CardholdersProjectionStore,
    @Inject(CARDHOLDERS_READ_MODEL) private readonly readModel: CardholdersReadModel,
  ) {}

  onModuleInit(): void {
    registerDomainErrorStatuses({ INVALID_CURSOR: 400 });

    this.queries.register(ListPersonsQuery, new ListPersonsHandler(this.readModel));
    this.queries.register(GetPersonDetailsQuery, new GetPersonDetailsHandler(this.readModel));
    this.queries.register(ListGroupsQuery, new ListGroupsHandler(this.readModel));
    this.queries.register(GetGroupDetailsQuery, new GetGroupDetailsHandler(this.readModel));

    const subscriptions = reportingSubscriptions({
      cardholders: new CardholdersProjection(this.store),
    });
    for (const subscription of subscriptions) this.events.subscribe(subscription);
  }
}
