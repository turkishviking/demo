# Events & messaging

## Cycle de vie d'un domain event

1. L'agrégat **enregistre** l'event (`this.record(new CardBlocked(...))`). Il ne le publie pas lui-même.
2. Dans `repository.save(aggregate)`, l'implémentation persiste l'état **et** insère `aggregate.pullEvents()` dans `shared.outbox`, avec le même `EntityManager` (donc dans la même transaction).
3. Le **relais** (`OutboxRelay`) lit l'outbox et publie les events sur le bus in-process (`InProcessEventBus`). Il est réveillé par `LISTEN/NOTIFY` Postgres, avec un polling de secours toutes les 1 s.
4. Chaque **abonné** (policy ou projection) traite l'event dans sa propre transaction et enregistre `(subscriber, eventId)` dans `shared.inbox`. C'est ce qui garantit l'**exactly-once effectif** (at-least-once + déduplication).

```mermaid
sequenceDiagram
  participant H as Handler
  participant DB as Postgres
  participant R as OutboxRelay
  participant S as Abonné
  H->>DB: BEGIN; UPDATE card; INSERT outbox; COMMIT
  DB-->>R: NOTIFY outbox
  R->>DB: SELECT … FOR UPDATE SKIP LOCKED
  R->>S: dispatch(event)
  S->>DB: BEGIN; check inbox; effet; INSERT inbox; COMMIT
  R->>DB: UPDATE outbox SET dispatched_at
```

## Tables

```sql
shared.outbox (
  position bigserial unique,                 -- ordre d'insertion
  event_id uuid primary key, type text, version int,
  aggregate_id uuid, aggregate_version int,  -- unique (aggregate_id, aggregate_version)
  payload jsonb, correlation_id text, causation_id text null,
  occurred_at timestamptz, dispatched_at timestamptz null,
  attempts int default 0, next_attempt_at timestamptz, last_error text null
)
shared.inbox (subscriber text, event_id uuid, processed_at timestamptz, primary key (subscriber, event_id))
```

## Garanties et règles

- **Ordre** : garanti par agrégat. Un event n'est sélectionné que si tous les events précédents du même agrégat ont été livrés : un lot contient donc au plus un event par agrégat, et `drain()` enchaîne les lots. Un event en échec (ou en dead letter) bloque la suite de son agrégat. Il n'y a pas d'ordre global entre agrégats : les abonnés ne doivent pas en dépendre.
- **Temps** : `occurred_at`, `next_attempt_at` et `dispatched_at` viennent du port `Clock` (jamais de `now()` SQL), ce qui rend le relais testable avec `ControllableClock`.
- **Retry** : backoff exponentiel. Après 10 échecs, l'event part en `dead letter` (`attempts >= OUTBOX_MAX_ATTEMPTS`, 10 par défaut) et un log `error` est émis. Il est rejouable par CLI.
- **Corrélation** : le `correlationId` de la commande initiale est propagé (via `AsyncLocalStorage`) à tous les events et commandes en aval. Il apparaît dans les logs et sert à suivre une saga.
- **Pas de logique dans le relais** : il ne fait que transporter.
- **Abonnements déclarés** dans `presentation/messaging/*.subscriptions.ts` : `on('transactions.TransactionRequested', AuthorizeOnCardPolicy)`. La policy (application) reçoit le payload du contrat, jamais une classe d'un autre context.
- En **tests unitaires**, on vérifie les events enregistrés par l'agrégat (`card.pullEvents()`). En **intégration**, on vérifie le contenu de l'outbox. En **E2E**, on vérifie l'effet final (polling avec timeout).

## Évolution

Pour passer à un broker (RabbitMQ, NATS), il suffit d'implémenter un `BrokerEventBus` et de faire publier le relais vers lui. Le domaine, l'application et l'outbox ne changent pas.
