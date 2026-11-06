import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { CLOCK, type Clock } from '../../shared/application/clock.port';
import { COMMAND_BUS, type SimpleCommandBus } from '../../shared/application/command-bus';
import { EVENT_BUS, type EventBus } from '../../shared/application/event-bus';
import {
  EVENT_ENVELOPE_FACTORY,
  type EventEnvelopeFactory,
} from '../../shared/application/event-envelope';
import {
  EVENT_PUBLISHER,
  type EventPublisher,
} from '../../shared/application/event-publisher.port';
import { ID_GENERATOR, type IdGenerator } from '../../shared/application/id-generator.port';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work.port';
import { TransactionContext } from '../../shared/infrastructure/database/transaction-context';
import { registerDomainErrorStatuses } from '../../shared/presentation/http/domain-error-status';
import {
  AddMemberCommand,
  ArchiveGroupCommand,
  ChangeGroupCapacityCommand,
  CreateGroupCommand,
  RemoveMemberCommand,
  RenameGroupCommand,
} from '../application/commands/group.commands';
import {
  AddMemberHandler,
  ArchiveGroupHandler,
  ChangeGroupCapacityHandler,
  CreateGroupHandler,
  RemoveMemberHandler,
  RenameGroupHandler,
} from '../application/commands/group.handlers';
import {
  DeactivatePersonCommand,
  RegisterPersonCommand,
  RenamePersonCommand,
} from '../application/commands/person.commands';
import {
  DeactivatePersonHandler,
  RegisterPersonHandler,
  RenamePersonHandler,
} from '../application/commands/person.handlers';
import { RemoveDeactivatedPersonFromGroupPolicy } from '../application/policies/remove-deactivated-person-from-group.policy';
import { GROUP_LOOKUP, type GroupLookup } from '../application/ports/group-lookup.port';
import { PERSON_LOOKUP, type PersonLookup } from '../application/ports/person-lookup.port';
import { GROUP_REPOSITORY, type GroupRepository } from '../domain/group/group.repository';
import { PERSON_REPOSITORY, type PersonRepository } from '../domain/person/person.repository';
import {
  SqlGroupLookup,
  TypeormGroupRepository,
} from '../infrastructure/persistence/typeorm-group.repository';
import {
  SqlPersonLookup,
  TypeormPersonRepository,
} from '../infrastructure/persistence/typeorm-person.repository';
import { CARDHOLDERS_ERROR_STATUSES } from './http/cardholders-error-statuses';
import { GroupsController } from './http/groups.controller';
import { PersonsController } from './http/persons.controller';
import { cardholdersSubscriptions } from './messaging/cardholders.subscriptions';

const repositoryDeps = [TransactionContext, EVENT_ENVELOPE_FACTORY, EVENT_PUBLISHER];

/**
 * Composition root du context Cardholders : adapters → ports, handlers → CommandBus,
 * policies → EventBus. Les handlers sont des classes TS pures, construites ici.
 */
@Module({
  controllers: [PersonsController, GroupsController],
  providers: [
    {
      provide: PERSON_REPOSITORY,
      inject: repositoryDeps,
      useFactory: (tx: TransactionContext, env: EventEnvelopeFactory, pub: EventPublisher) =>
        new TypeormPersonRepository(tx, env, pub),
    },
    {
      provide: GROUP_REPOSITORY,
      inject: repositoryDeps,
      useFactory: (tx: TransactionContext, env: EventEnvelopeFactory, pub: EventPublisher) =>
        new TypeormGroupRepository(tx, env, pub),
    },
    {
      provide: PERSON_LOOKUP,
      inject: [TransactionContext],
      useFactory: (tx: TransactionContext) => new SqlPersonLookup(tx),
    },
    {
      provide: GROUP_LOOKUP,
      inject: [TransactionContext],
      useFactory: (tx: TransactionContext) => new SqlGroupLookup(tx),
    },
  ],
})
export class CardholdersModule implements OnModuleInit {
  constructor(
    @Inject(COMMAND_BUS) private readonly commands: SimpleCommandBus,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
    @Inject(GROUP_REPOSITORY) private readonly groups: GroupRepository,
    @Inject(PERSON_LOOKUP) private readonly personLookup: PersonLookup,
    @Inject(GROUP_LOOKUP) private readonly groupLookup: GroupLookup,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    registerDomainErrorStatuses(CARDHOLDERS_ERROR_STATUSES);

    const { commands: bus, persons, groups, personLookup, groupLookup, uow, ids, clock } = this;
    bus.register(
      RegisterPersonCommand,
      new RegisterPersonHandler(persons, personLookup, uow, ids, clock),
    );
    bus.register(RenamePersonCommand, new RenamePersonHandler(persons, uow));
    bus.register(DeactivatePersonCommand, new DeactivatePersonHandler(persons, uow));
    bus.register(CreateGroupCommand, new CreateGroupHandler(groups, groupLookup, uow, ids));
    bus.register(RenameGroupCommand, new RenameGroupHandler(groups, groupLookup, uow));
    bus.register(
      AddMemberCommand,
      new AddMemberHandler(groups, personLookup, groupLookup, uow, clock),
    );
    bus.register(RemoveMemberCommand, new RemoveMemberHandler(groups, uow));
    bus.register(ChangeGroupCapacityCommand, new ChangeGroupCapacityHandler(groups, uow));
    bus.register(ArchiveGroupCommand, new ArchiveGroupHandler(groups, uow));

    const subscriptions = cardholdersSubscriptions({
      removeDeactivatedPersonFromGroup: new RemoveDeactivatedPersonFromGroupPolicy(
        groupLookup,
        bus,
      ),
    });
    for (const subscription of subscriptions) this.events.subscribe(subscription);
  }
}
