# Persistance

## Principes

- On utilise TypeORM **uniquement** pour la `DataSource`, la gestion des transactions, les migrations et l'`EntityManager.query` / `QueryBuilder`. **Pas** de `Repository<T>` TypeORM, pas d'`@InjectRepository`, et pas d'entités TypeORM utilisées comme modèle de domaine.
- Nos repositories (`Typeorm<Aggregate>Repository`) implémentent l'interface du domaine. Ils **chargent l'agrégat complet** (racine + entités enfants) et le **sauvegardent complet**.
- Le mapping est explicite : `CardMapper.toDomain(rows)` et `CardMapper.toPersistence(card)`. L'agrégat se reconstruit via `Card.restore(props)`, qui ne revalide pas les invariants de création et n'émet pas d'events.
- Les classes de table (`CardRecord`, `HoldRecord`) sont de simples types ou `EntitySchema`. Elles vivent dans `infrastructure/persistence` et servent aux migrations.

## UnitOfWork

```ts
export class TypeormUnitOfWork implements UnitOfWork {
  constructor(private readonly ds: DataSource, private readonly als: AsyncLocalStorage<EntityManager>) {}
  run<T>(work: () => Promise<T>): Promise<T> {
    const current = this.als.getStore();
    if (current) return work();                 // réentrant
    return this.ds.transaction('READ COMMITTED', (em) => this.als.run(em, work));
  }
}
// Les repositories obtiennent le manager courant via ManagerProvider.current() (ALS ou ds.manager)
```

## Save d'un agrégat (exemple Card)

1. `UPDATE cards.cards SET …, version = version + 1 WHERE id = $1 AND version = $2`. Si 0 ligne est modifiée, on lève `ConcurrencyError`.
   Pour une nouvelle carte, on fait un `INSERT`. On distingue les deux cas avec `card.isNew`.
2. Diff des enfants `holds` : `DELETE` des holds absents et `INSERT … ON CONFLICT DO NOTHING` des nouveaux.
3. `INSERT` des events dans `shared.outbox`.

Tout se passe dans la transaction du UnitOfWork.

**Retry de concurrence** : le `CommandBus` rejoue jusqu'à 3 fois une commande qui échoue sur `ConcurrencyError`. C'est utile pour la saga d'autorisation, où plusieurs transactions visent la même carte en parallèle.

## Schémas Postgres

```
cardholders.persons           (id, first_name, last_name, email unique, status, registered_at, version)
cardholders.groups            (id, name, max_members, status, version)            -- unique index sur lower(name)
cardholders.group_members     (group_id, person_id unique, joined_at)            -- PK (group_id, person_id)
cards.cardholders             (person_id pk, status)                              -- projection locale
cards.cards                   (id, cardholder_id, masked_pan, brand, status, block_reason,
                               credit_limit_minor, settled_outstanding_minor, currency, expires_at, version)
cards.holds                   (card_id, transaction_id, amount_minor, held_at)   -- PK (card_id, transaction_id)
cards.authorization_log       (card_id, transaction_id, authorized_at)           -- pour VelocityCheck
transactions.transactions     (id, card_id, amount_minor, currency, merchant_name, merchant_category,
                               merchant_country, status, decline_reason, source, simulation_run_id,
                               requested_at, authorized_at, settled_at, refunded_at, version)
simulation.target_cards       (card_id pk, status)                                -- projection locale
simulation.runs               (id, scenario, target_card_ids uuid[], rate_per_minute, max_transactions,
                               seed, status, generated_count, started_at, ended_at, version)
                               -- unique partial index WHERE status = 'RUNNING'
shared.outbox, shared.inbox
reporting.rm_*                (voir cqrs.md)
```

- Index : `transactions(card_id, requested_at desc)`, `transactions(status, requested_at)`, `rm_transactions(requested_at desc, id)` pour la pagination par curseur, `outbox(dispatched_at) WHERE dispatched_at IS NULL`.
- Argent : `bigint` en unités mineures, plus une colonne `currency char(3)`.
- **Migrations** : générées et versionnées dans `apps/api/src/migrations`, avec `synchronize: false` partout, tests compris. Les tests d'intégration lancent les migrations sur le conteneur.

## Seed

`pnpm --filter api seed` crée 3 groupes, 12 personnes, 20 cartes et 500 transactions historiques. Il passe **par les commandes** (pas par du SQL direct), pour que les events et les read models soient cohérents.
