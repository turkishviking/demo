# Ports & adapters

Un **port** est une interface définie par le domaine ou l'application. Un **adapter** l'implémente dans l'infrastructure. Chaque port a **au moins deux** implémentations : la vraie et un fake pour les tests.

## Ports transverses (`shared/application`)

| Port | Signature | Adapter prod | Adapter test |
|---|---|---|---|
| `Clock` | `now(): Date` | `SystemClock` | `FixedClock`, `ControllableClock.advance(ms)` |
| `IdGenerator` | `next(): string` | `Uuidv7Generator` | `SequentialIdGenerator` |
| `UnitOfWork` | `run<T>(work: () => Promise<T>): Promise<T>` | `TypeormUnitOfWork` (transaction + `EntityManager` en `AsyncLocalStorage`) | `InMemoryUnitOfWork` |
| `EventPublisher` | `publish(events: DomainEvent[]): Promise<void>` | `OutboxEventPublisher` (écrit dans l'outbox via le manager courant) | `RecordingEventPublisher` |
| `EventSubscriber` | `subscribe(type, handler)` | `InProcessEventBus` | `InProcessEventBus` (synchrone) |
| `CommandBus` / `QueryBus` | `execute(cmd)` | `SimpleCommandBus` (map type → handler) | même implémentation |

## Ports par context

| Context | Port | Rôle | Adapters |
|---|---|---|---|
| Cardholders | `PersonRepository`, `GroupRepository` | persistance des agrégats | `Typeorm*`, `InMemory*` |
| Cardholders | `GroupLookup` | `findGroupOf(personId)`, `isNameTaken(name, except?)` | SQL / in-memory |
| Cardholders | `PersonLookup` | `statusOf(personId)`, `isEmailTaken(email)` | SQL / in-memory |
| Cards | `CardRepository` | persistance | `TypeormCardRepository`, `InMemoryCardRepository` |
| Cards | `CardholderDirectory` | statut du titulaire (projection locale) | SQL / in-memory |
| Cards | `PanGenerator` | PAN fictif + masque | `RandomLuhnPanGenerator`, `FixedPanGenerator` |
| Cards | `RecentAuthorizationsReader` | nombre d'autorisations d'une carte sur une fenêtre | SQL / in-memory |
| Transactions | `TransactionRepository` | persistance | `Typeorm*`, `InMemory*` |
| Transactions | `PendingTransactionsReader` | ids `PENDING` plus vieux que X | SQL / in-memory |
| Simulation | `SimulationRunRepository` | persistance | `Typeorm*`, `InMemory*` |
| Simulation | `TransactionGateway` | « réseau de paiement » sortant | `InProcessTransactionGateway`, `HttpTransactionGateway` (optionnel), `RecordingTransactionGateway` |
| Simulation | `RandomGenerator` | aléatoire déterministe | `SeededRandomGenerator` |
| Simulation | `Scheduler` | ticks | `IntervalScheduler`, `ManualScheduler` |
| Simulation | `MerchantCatalog` | marchands fictifs | `StaticMerchantCatalog` |
| Reporting | `CardholdersProjectionStore` | écriture de `rm_people` / `rm_groups` (versionnée) | SQL / in-memory |
| Reporting | `CardholdersReadModel` | lectures paginées des personnes et des groupes | SQL / in-memory |
| Reporting | `ReadModelCache` | cache de lecture (plus tard) | `NoopCache`, `InMemoryLruCache` |

## Exemple

```ts
// cards/domain/card.repository.ts — port côté domaine
export interface CardRepository {
  findById(id: CardId): Promise<Card | null>;
  findByCardholder(id: PersonId): Promise<Card[]>;
  save(card: Card): Promise<void>; // lève ConcurrencyError si la version est obsolète
}
export const CARD_REPOSITORY = Symbol('CardRepository');

// cards/application/commands/block-card/block-card.handler.ts
export class BlockCardHandler implements CommandHandler<BlockCardCommand, void> {
  constructor(private readonly cards: CardRepository, private readonly uow: UnitOfWork) {}
  async execute({ cardId, reason }: BlockCardCommand): Promise<void> {
    await this.uow.run(async () => {
      const card = await this.cards.findById(CardId.from(cardId));
      if (!card) throw new CardNotFoundError(cardId);
      card.block(reason);
      await this.cards.save(card);
    });
  }
}
```

## Tests de contrat

Pour chaque repository, `describeCardRepositoryContract(factory)` définit les comportements attendus : round-trip complet, verrou optimiste, `null` si absent, events écrits dans l'outbox. Cette suite tourne sur `InMemoryCardRepository` (unit) et sur `TypeormCardRepository` (intégration, avec Testcontainers). Les fakes ne peuvent donc pas diverger des implémentations réelles.

Exemples en place : `test/cardholders/repositories.contract.ts` (repositories + lookups) et `test/reporting/cardholders-read-models.contract.ts` (projection + read model : on rejoue des events, on vérifie les lectures).
