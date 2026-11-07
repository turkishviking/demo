# Visite guidée de l'implémentation (état M1)

Ce document décrit **le code tel qu'il est** à la fin de M1 (Cardholders + Reporting), en suivant le trajet d'une requête. Il ne remplace pas les specs : en cas d'écart, [overview.md](overview.md), [cqrs.md](cqrs.md), [events-and-messaging.md](events-and-messaging.md) et [persistence.md](persistence.md) font foi.

Chemins de code relatifs à `apps/api/src/` sauf mention contraire.

**Légende des couleurs** (identique dans tous les schémas) :

| Couleur | Signification |
|---|---|
| Rose | front (`apps/web`) |
| Bleu | presentation (controllers, modules Nest) |
| Violet | application (handlers, bus, policies, ports) |
| Vert | domain (agrégats, VO, erreurs) |
| Orange | infrastructure (SQL, outbox, inbox, transactions) |
| Turquoise | lecture (reporting, read models) |
| Jaune | events |
| Gris | base de données |
| Rouge | erreurs, conflits |

---

## 1. Le monorepo

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "primaryColor": "#f1f5f9", "primaryTextColor": "#0f172a", "primaryBorderColor": "#64748b", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "titleColor": "#0f172a", "clusterBkg": "#f8fafc", "clusterBorder": "#64748b", "edgeLabelBackground": "#e2e8f0"}}}%%
flowchart LR
  subgraph browser["Navigateur"]
    UI["Formulaires et pages"]
  end
  subgraph web["apps/web — Next.js"]
    RSC["Server components<br/>(pages async)"]
    SA["Server actions<br/>'use server'"]
    CLI["lib/api/*.ts<br/>client HTTP 'server-only'"]
  end
  subgraph api["apps/api — NestJS"]
    CH["cardholders<br/>(écriture)"]
    RP["reporting<br/>(lecture)"]
    SH["shared<br/>(kernel, bus, outbox)"]
  end
  SHARED["packages/shared<br/>types DTO, ProblemDetails, Page"]
  PG[("PostgreSQL<br/>schémas shared, cardholders, reporting")]

  UI --> RSC
  UI --> SA
  RSC --> CLI
  SA --> CLI
  CLI -- "HTTP /api/v1" --> api
  CH --> PG
  RP --> PG
  SH --> PG
  web -. "import type" .-> SHARED
  api -. "import type" .-> SHARED

  classDef web fill:#fce7f3,stroke:#db2777,color:#0f172a
  classDef app fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  classDef read fill:#ccfbf1,stroke:#0d9488,color:#0f172a
  classDef infra fill:#ffedd5,stroke:#ea580c,color:#0f172a
  classDef db fill:#e2e8f0,stroke:#475569,color:#0f172a
  class UI,RSC,SA,CLI web
  class CH app
  class RP read
  class SH infra
  class PG db
```

- **pnpm workspaces** : un dépôt, trois paquets. `packages/shared` ne contient que des types, effacés à la compilation.
- **`pnpm arch`** (dependency-cruiser, `apps/api/.dependency-cruiser.cjs`) fait échouer le build si une règle d'architecture est violée.

---

## 2. Couches et composition root

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "primaryColor": "#f1f5f9", "primaryTextColor": "#0f172a", "primaryBorderColor": "#64748b", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "titleColor": "#0f172a", "clusterBkg": "#f8fafc", "clusterBorder": "#64748b", "edgeLabelBackground": "#e2e8f0"}}}%%
flowchart TB
  subgraph pres["presentation (Nest)"]
    CTRL["Controllers + DTO<br/>class-validator"]
    MOD["CardholdersModule.onModuleInit<br/>new Handler(...)<br/>bus.register / events.subscribe"]
    SUBS["messaging/*.subscriptions.ts"]
  end
  subgraph infra["infrastructure"]
    REPO["TypeormGroupRepository<br/>SqlGroupLookup"]
    OUT["OutboxEventPublisher<br/>OutboxRelay, PostgresInbox"]
    TX["TransactionContext<br/>TypeormUnitOfWork"]
  end
  subgraph app["application (TS pur)"]
    H["Command handlers"]
    POL["Policies"]
    PORTS["Ports : UnitOfWork, Clock,<br/>IdGenerator, Lookups, EventPublisher"]
  end
  subgraph dom["domain (TS pur)"]
    AGG["Agrégats Person, Group"]
    VO["Value objects, Money"]
    ERR["DomainError typées"]
    RI["Interfaces de repository"]
  end

  pres --> app
  infra --> app
  infra --> dom
  app --> dom
  REPO -. "implémente" .-> RI
  OUT -. "implémente" .-> PORTS
  TX -. "implémente" .-> PORTS

  classDef pres fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef app fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  classDef dom fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef infra fill:#ffedd5,stroke:#ea580c,color:#0f172a
  class CTRL,MOD,SUBS pres
  class H,POL,PORTS app
  class AGG,VO,ERR,RI dom
  class REPO,OUT,TX infra
  style pres fill:#eff6ff,stroke:#2563eb
  style app fill:#f5f3ff,stroke:#7c3aed
  style dom fill:#f0fdf4,stroke:#16a34a
  style infra fill:#fff7ed,stroke:#ea580c
```

**Pourquoi des `Symbol` ?** Une `interface` TypeScript n'existe plus à l'exécution : Nest ne peut pas s'en servir comme clé d'injection. Chaque port exporte donc l'interface **et** un jeton du même nom :

```ts
export interface PersonRepository { findById(...); save(...); }
export const PERSON_REPOSITORY = Symbol('PersonRepository');
```

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "primaryColor": "#f1f5f9", "primaryTextColor": "#0f172a", "primaryBorderColor": "#64748b", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "titleColor": "#0f172a", "clusterBkg": "#f8fafc", "clusterBorder": "#64748b", "edgeLabelBackground": "#e2e8f0"}}}%%
flowchart LR
  SM["SharedModule @Global<br/>DataSource, UoW, Clock, Ids,<br/>CommandBus, EventBus, Outbox, Inbox"]
  CM["CardholdersModule"]
  RM["ReportingModule"]
  BOOT["onApplicationBootstrap<br/>démarre OutboxRelayRunner"]

  SM -- "injecte par jeton" --> CM
  SM -- "injecte par jeton" --> RM
  CM -- "onModuleInit :<br/>register handlers + subscribe" --> SM
  RM -- "onModuleInit :<br/>register queries + subscribe" --> SM
  SM --> BOOT

  classDef infra fill:#ffedd5,stroke:#ea580c,color:#0f172a
  classDef pres fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef read fill:#ccfbf1,stroke:#0d9488,color:#0f172a
  classDef evt fill:#fef9c3,stroke:#ca8a04,color:#0f172a
  class SM infra
  class CM pres
  class RM read
  class BOOT evt
```

Les handlers sont construits à la main dans `onModuleInit` ([cardholders.module.ts](../../apps/api/src/cardholders/presentation/cardholders.module.ts)) : ils ne portent aucun décorateur Nest. Le relais ne démarre qu'au bootstrap, une fois **tous** les abonnés inscrits ([shared.module.ts](../../apps/api/src/shared/presentation/shared.module.ts)).

---

## 3. Écriture : `POST /groups/:id/members`

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "actorBkg": "#f8fafc", "actorBorder": "#64748b", "actorTextColor": "#0f172a", "actorLineColor": "#7c8ba1", "signalColor": "#7c8ba1", "signalTextColor": "#7c8ba1", "labelBoxBkgColor": "#e2e8f0", "labelBoxBorderColor": "#64748b", "labelTextColor": "#0f172a", "loopTextColor": "#7c8ba1", "noteBkgColor": "#fef9c3", "noteBorderColor": "#ca8a04", "noteTextColor": "#0f172a", "sequenceNumberColor": "#ffffff"}}}%%
sequenceDiagram
  autonumber
  box rgba(37,99,235,0.18) presentation
    participant C as GroupsController
  end
  box rgba(124,58,237,0.18) application
    participant B as SimpleCommandBus
    participant H as AddMemberHandler
  end
  box rgba(22,163,74,0.18) domain
    participant G as Group (agrégat)
  end
  box rgba(234,88,12,0.18) infrastructure
    participant U as TypeormUnitOfWork
    participant L as Person/GroupLookup
    participant R as TypeormGroupRepository
  end
  box rgba(71,85,105,0.25) base
    participant DB as PostgreSQL
  end

  C->>B: execute(new AddMemberCommand(id, personId))
  B->>H: execute(command)
  H->>U: run(work)
  U->>DB: BEGIN (READ COMMITTED)
  H->>R: findById(groupId)
  R->>DB: SELECT groups + group_members
  R-->>H: Group.restore(snapshot, version)
  H->>L: statusOf(personId) puis findGroupOf(personId)
  L->>DB: SELECT (tables write de cardholders)
  Note over H,L: Règle inter-agrégats :<br/>une personne dans au plus un groupe
  H->>G: addMember(personId, clock.now())
  Note over G: Invariants G1 à G3<br/>puis record(PersonJoinedGroup)
  H->>R: save(group)
  R->>DB: UPDATE groups ... WHERE version = v
  R->>DB: DELETE puis INSERT group_members (diff)
  R->>DB: INSERT shared.outbox + pg_notify
  U->>DB: COMMIT
  B-->>C: void (HTTP 204)
  Note over B: ConcurrencyError ⇒ la commande<br/>est rejouée (3 essais max)
```

- Une **seule transaction** et un **seul agrégat** modifié. L'event est écrit dans l'outbox avec la même transaction : il n'existe que si l'écriture est commitée.
- La contrainte unique `group_members_person_unique` garantit en base la règle « un seul groupe » même en cas d'accès concurrent. Le repository la traduit en `PersonAlreadyInAGroupError` (`isUniqueViolation`).

Code : [group.handlers.ts](../../apps/api/src/cardholders/application/commands/group.handlers.ts), [group.aggregate.ts](../../apps/api/src/cardholders/domain/group/group.aggregate.ts), [typeorm-group.repository.ts](../../apps/api/src/cardholders/infrastructure/persistence/typeorm-group.repository.ts).

---

## 4. Cycle de vie d'un agrégat et versions

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "primaryColor": "#f1f5f9", "primaryTextColor": "#0f172a", "primaryBorderColor": "#64748b", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "transitionColor": "#7c8ba1", "transitionLabelColor": "#7c8ba1", "stateLabelColor": "#0f172a"}}}%%
stateDiagram-v2
  direction LR
  [*] --> Nouveau : Group.create(props)<br/>version 0, record(GroupCreated)
  [*] --> Chargé : Group.restore(snapshot, v)<br/>ni validation ni event
  Nouveau --> Modifié : addMember, rename...<br/>record(event)
  Chargé --> Modifié : addMember, rename...<br/>record(event)
  Chargé --> Chargé : pas d'event<br/>pas de save
  Modifié --> Persisté : save()<br/>pullFrom → enveloppes + nextVersion<br/>INSERT ou UPDATE ... WHERE version = v<br/>markPersisted(nextVersion)
  Modifié --> Conflit : UPDATE touche 0 ligne
  Conflit --> [*] : ConcurrencyError<br/>(CommandBus rejoue)
  Persisté --> [*]

  classDef dom fill:#dcfce7,stroke:#16a34a,color:#0f172a
  classDef app fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  classDef infra fill:#ffedd5,stroke:#ea580c,color:#0f172a
  classDef err fill:#fee2e2,stroke:#dc2626,color:#0f172a
  class Nouveau,Modifié dom
  class Chargé app
  class Persisté infra
  class Conflit err
```

- `version` = verrou optimiste. `nextVersion = version + nombre d'events` (au moins 1). Chaque enveloppe reçoit `aggregateVersion = version + rang`.
- Le domaine ne connaît ni horloge, ni ids, ni corrélation : c'est [`EventEnvelopeFactory`](../../apps/api/src/shared/application/event-envelope.ts) qui les ajoute.

---

## 5. La transaction implicite (AsyncLocalStorage)

Node n'a qu'un thread, donc pas de `ThreadLocal`. `AsyncLocalStorage` en est l'équivalent : une valeur qui suit toute la chaîne d'`await` lancée depuis `storage.run(valeur, fn)`.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "actorBkg": "#f8fafc", "actorBorder": "#64748b", "actorTextColor": "#0f172a", "actorLineColor": "#7c8ba1", "signalColor": "#7c8ba1", "signalTextColor": "#7c8ba1", "labelBoxBkgColor": "#e2e8f0", "labelBoxBorderColor": "#64748b", "labelTextColor": "#0f172a", "loopTextColor": "#7c8ba1", "noteBkgColor": "#fef9c3", "noteBorderColor": "#ca8a04", "noteTextColor": "#0f172a", "sequenceNumberColor": "#ffffff"}}}%%
sequenceDiagram
  box rgba(124,58,237,0.18) application
    participant H as Handler
  end
  box rgba(234,88,12,0.18) infrastructure
    participant U as TypeormUnitOfWork
    participant TC as TransactionContext<br/>(AsyncLocalStorage)
    participant R as Repository
  end
  box rgba(71,85,105,0.25) TypeORM
    participant DS as DataSource
  end

  H->>U: run(work)
  alt déjà dans une transaction
    U->>H: work() rejoint la transaction courante
  else
    U->>DS: transaction('READ COMMITTED', manager => ...)
    DS->>TC: run(manager, work)
    TC->>H: work()
    H->>R: save(aggregate)
    R->>TC: requireTransactional()
    TC-->>R: manager de la transaction en cours
    R->>DS: sql(manager, ...)
  end
```

Les repositories participent à la transaction **sans la recevoir en paramètre**. Le même mécanisme transporte le `correlationId` (`AsyncLocalCorrelationContext`).

> Node reste concurrent : deux requêtes s'entremêlent à chaque `await`. Le verrou optimiste et les contraintes uniques restent donc nécessaires.

Code : [transaction-context.ts](../../apps/api/src/shared/infrastructure/database/transaction-context.ts), [typeorm-unit-of-work.ts](../../apps/api/src/shared/infrastructure/database/typeorm-unit-of-work.ts).

---

## 6. Asynchrone : outbox → relais → bus → inbox

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "actorBkg": "#f8fafc", "actorBorder": "#64748b", "actorTextColor": "#0f172a", "actorLineColor": "#7c8ba1", "signalColor": "#7c8ba1", "signalTextColor": "#7c8ba1", "labelBoxBkgColor": "#e2e8f0", "labelBoxBorderColor": "#64748b", "labelTextColor": "#0f172a", "loopTextColor": "#7c8ba1", "noteBkgColor": "#fef9c3", "noteBorderColor": "#ca8a04", "noteTextColor": "#0f172a", "sequenceNumberColor": "#ffffff"}}}%%
sequenceDiagram
  autonumber
  box rgba(71,85,105,0.25) base
    participant DB as shared.outbox
  end
  box rgba(234,88,12,0.18) infrastructure
    participant RR as OutboxRelayRunner
    participant RL as OutboxRelay
  end
  box rgba(124,58,237,0.18) application
    participant BUS as InProcessEventBus
  end
  box rgba(234,88,12,0.18) infrastructure
    participant IN as PostgresInbox
  end
  box rgba(13,148,136,0.18) abonné
    participant S as Projection ou policy
  end

  DB-->>RR: NOTIFY outbox_events (au commit)
  Note over RR: + polling de secours
  RR->>RL: drain()
  RL->>DB: BEGIN puis SELECT ... FOR UPDATE SKIP LOCKED<br/>un event par agrégat, le plus ancien non livré
  loop chaque event du lot
    RL->>BUS: dispatch(envelope)
    loop chaque abonné du type d'event
      BUS->>IN: runOnce(subscriber, eventId, handle)
      Note over IN,S: Nouvelle transaction, propre à l'abonné
      IN->>IN: INSERT shared.inbox ON CONFLICT DO NOTHING
      alt déjà traité
        IN-->>BUS: false, on ignore
      else
        IN->>S: handle(event)
        S-->>IN: ok, COMMIT (inbox + effet)
      end
    end
    alt tous les abonnés OK
      RL->>DB: UPDATE dispatched_at
    else au moins un échec
      RL->>DB: attempts + 1, next_attempt_at (backoff)
      Note over RL,DB: Les events suivants du même agrégat attendent.<br/>Au-delà de maxAttempts : dead letter
    end
  end
  RL->>DB: COMMIT
```

| Garantie | Mécanisme |
|---|---|
| L'event existe ⇔ l'écriture est commitée | INSERT outbox dans la transaction métier |
| Livraison au moins une fois | relais + reprise avec backoff |
| Effet une seule fois par abonné | inbox `(subscriber, event_id)` dans la transaction de l'abonné |
| Ordre par agrégat | `NOT EXISTS` sur les events antérieurs non livrés |
| Plusieurs relais possibles | `FOR UPDATE SKIP LOCKED` |
| Traçabilité | `correlationId` conservé, `causationId` = id de l'event déclencheur |

Code : [outbox-event-publisher.ts](../../apps/api/src/shared/infrastructure/outbox/outbox-event-publisher.ts), [outbox-relay.ts](../../apps/api/src/shared/infrastructure/outbox/outbox-relay.ts), [event-bus.ts](../../apps/api/src/shared/application/event-bus.ts), [postgres-inbox.ts](../../apps/api/src/shared/infrastructure/inbox/postgres-inbox.ts).

---

## 7. Les abonnés

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "primaryColor": "#f1f5f9", "primaryTextColor": "#0f172a", "primaryBorderColor": "#64748b", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "titleColor": "#0f172a", "clusterBkg": "#f8fafc", "clusterBorder": "#64748b", "edgeLabelBackground": "#e2e8f0"}}}%%
flowchart LR
  subgraph events["Events publiés (cardholders/contracts)"]
    E1["PersonRegistered<br/>PersonRenamed"]
    E2["GroupCreated, GroupRenamed<br/>GroupCapacityChanged, GroupArchived"]
    E3["PersonJoinedGroup<br/>PersonLeftGroup"]
    E4["PersonDeactivated"]
  end

  subgraph reporting["reporting — projection"]
    PROJ["CardholdersProjection"]
    RMP[("rm_people")]
    RMG[("rm_groups")]
  end

  subgraph cardholders["cardholders — policy"]
    POL["RemoveDeactivatedPersonFromGroupPolicy"]
    CMD["RemoveMemberCommand<br/>→ CommandBus"]
    GRP["Group.removeMember<br/>nouvelle transaction"]
  end

  E1 --> PROJ
  E2 --> PROJ
  E3 --> PROJ
  E4 --> PROJ
  PROJ -- "INSERT ON CONFLICT DO NOTHING<br/>UPDATE ... WHERE version < v" --> RMP
  PROJ --> RMG
  E4 --> POL
  POL -- "si la personne a un groupe" --> CMD --> GRP
  GRP -. "PersonLeftGroup" .-> E3

  classDef evt fill:#fef9c3,stroke:#ca8a04,color:#0f172a
  classDef read fill:#ccfbf1,stroke:#0d9488,color:#0f172a
  classDef db fill:#e2e8f0,stroke:#475569,color:#0f172a
  classDef app fill:#ede9fe,stroke:#7c3aed,color:#0f172a
  classDef dom fill:#dcfce7,stroke:#16a34a,color:#0f172a
  class E1,E2,E3,E4 evt
  class PROJ read
  class RMP,RMG db
  class POL,CMD app
  class GRP dom
  style events fill:#fefce8,stroke:#ca8a04
  style reporting fill:#f0fdfa,stroke:#0d9488
  style cardholders fill:#f5f3ff,stroke:#7c3aed
```

- **Projection** : idempotente et versionnée. Un event rejoué ou en retard ne peut pas écraser un état plus récent.
- **Policy** : la désactivation d'une `Person` ne modifie pas le `Group` dans la même transaction. Elle publie un event, et la policy envoie une commande qui modifie le `Group` dans **sa propre** transaction (une transaction = un agrégat).
- Un context n'importe d'un autre que ses `contracts/` : les types de payload `*V1`.

---

## 8. Lecture et front (CQRS, cohérence éventuelle)

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "actorBkg": "#f8fafc", "actorBorder": "#64748b", "actorTextColor": "#0f172a", "actorLineColor": "#7c8ba1", "signalColor": "#7c8ba1", "signalTextColor": "#7c8ba1", "labelBoxBkgColor": "#e2e8f0", "labelBoxBorderColor": "#64748b", "labelTextColor": "#0f172a", "loopTextColor": "#7c8ba1", "noteBkgColor": "#fef9c3", "noteBorderColor": "#ca8a04", "noteTextColor": "#0f172a", "sequenceNumberColor": "#ffffff"}}}%%
sequenceDiagram
  autonumber
  box rgba(219,39,119,0.18) apps/web
    participant F as Formulaire (ActionForm)
    participant SA as Server action
    participant RW as readYourWrite
    participant N as Next (revalidatePath)
  end
  box rgba(37,99,235,0.18) API écriture
    participant API as cardholders
  end
  box rgba(13,148,136,0.18) API lecture
    participant RM as reporting (ReadModel)
  end

  F->>SA: submit(FormData)
  SA->>API: POST /groups/:id/members
  API-->>SA: 204 (event dans l'outbox)
  loop toutes les 100 ms, 2 s max
    SA->>RW: lire et tester isApplied
    RW->>RM: GET /groups/:id
    RM-->>RW: GroupDetails (rm_groups, SQL direct)
  end
  SA->>N: revalidatePath('/groups/:id')
  SA-->>F: { status: 'success', message }
```

- Les **lectures** ne passent jamais par le domaine : `SqlCardholdersReadModel` interroge `rm_*`, avec une pagination par curseur ([pagination.ts](../../apps/api/src/reporting/application/pagination.ts)).
- `readYourWrite` ([consistency.ts](../../apps/web/lib/api/consistency.ts)) ne lève pas d'erreur au timeout : la page affiche le dernier état connu.
- `import 'server-only'` dans `apps/web/lib/api/server.ts` : le build échoue si le client HTTP se retrouve dans le bundle du navigateur.

---

## 9. Les erreurs → `application/problem+json`

```mermaid
%%{init: {"theme": "base", "themeVariables": {"fontFamily": "sans-serif", "primaryColor": "#f1f5f9", "primaryTextColor": "#0f172a", "primaryBorderColor": "#64748b", "lineColor": "#7c8ba1", "textColor": "#7c8ba1", "titleColor": "#0f172a", "clusterBkg": "#f8fafc", "clusterBorder": "#64748b", "edgeLabelBackground": "#e2e8f0"}}}%%
flowchart LR
  EX["Exception levée"] --> F{"ProblemDetailsFilter"}
  F -- "DomainError" --> T{"code dans la table<br/>du context ?"}
  T -- "oui" --> S1["statut de la table<br/>(ex. GROUP_FULL → 409)"]
  T -- "non, NotFoundError" --> S2["404"]
  T -- "non, autre" --> S3["422"]
  F -- "ConcurrencyError" --> S4["409"]
  F -- "RequestValidationException" --> S5["400 + errors[]"]
  F -- "HttpException" --> S6["son statut"]
  F -- "autre" --> S7["500 INTERNAL_ERROR<br/>(loggé)"]
  S1 & S2 & S3 & S4 & S5 & S6 & S7 --> PD["problem+json<br/>type, title, status, code,<br/>detail, correlationId"]

  classDef err fill:#fee2e2,stroke:#dc2626,color:#0f172a
  classDef pres fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef warn fill:#fef9c3,stroke:#ca8a04,color:#0f172a
  classDef web fill:#fce7f3,stroke:#db2777,color:#0f172a
  class EX,S7 err
  class F,T pres
  class S1,S2,S3,S4,S5,S6 warn
  class PD web
```

Chaque context enregistre sa table dans `onModuleInit` via `registerDomainErrorStatuses()` ([cardholders-error-statuses.ts](../../apps/api/src/cardholders/presentation/http/cardholders-error-statuses.ts)). Le front lit le `code` stable pour afficher un message.

---

## 10. Ordre de lecture du code

1. `shared/domain/` : `AggregateRoot`, `ValueObject`, `Money`, `DomainError`, `Brand`.
2. `cardholders/domain/group/group.aggregate.ts` et son `.spec.ts`.
3. `cardholders/application/commands/group.handlers.ts`.
4. `cardholders/infrastructure/persistence/typeorm-group.repository.ts`, puis `transaction-context.ts` et `typeorm-unit-of-work.ts`.
5. `shared/application/event-envelope.ts`, puis l'outbox, le relais, `event-bus.ts` et l'inbox.
6. `cardholders/presentation/cardholders.module.ts` et `shared/presentation/shared.module.ts`.
7. `reporting/` : projection, projection store, read model, query handlers.
8. `apps/web/` : `lib/api/`, `app/(app)/groups/actions.ts`, `page.tsx`.
