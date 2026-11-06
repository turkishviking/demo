# Catalogue des domain events

Tous les events partagent cette enveloppe (voir [events-and-messaging.md](../04-architecture/events-and-messaging.md)) :

```ts
interface EventEnvelope<T> {
  eventId: string;          // UUID v7
  type: string;             // ex. "cards.CardAuthorizationGranted"
  version: number;          // version du schéma de payload
  aggregateId: string;
  aggregateVersion: number;
  occurredAt: string;       // ISO 8601
  correlationId: string;    // suit une saga de bout en bout
  causationId: string | null;
  payload: T;
}
```

Le nom d'un event est un **fait passé**, préfixé par son context. Montants : `{ amountMinor: number, currency: "EUR" }`.

## Cardholders

| Event | Payload | Consommateurs |
|---|---|---|
| `PersonRegistered` | `personId, firstName, lastName, email, registeredAt` | Cards, Reporting |
| `PersonRenamed` | `personId, firstName, lastName` | Reporting |
| `PersonDeactivated` | `personId` | Cards, Cardholders (policy), Reporting |
| `GroupCreated` | `groupId, name, maxMembers` | Reporting |
| `GroupRenamed` | `groupId, name` | Reporting |
| `GroupCapacityChanged` | `groupId, maxMembers` | Reporting |
| `PersonJoinedGroup` | `groupId, personId, joinedAt` | Reporting |
| `PersonLeftGroup` | `groupId, personId` | Reporting |
| `GroupArchived` | `groupId` | Reporting |

## Cards

| Event | Payload | Consommateurs |
|---|---|---|
| `CardIssued` | `cardId, cardholderId, maskedPan, brand, creditLimit, expiresAt` | Simulation, Reporting |
| `CardBlocked` | `cardId, reason` | Simulation, Reporting |
| `CardUnblocked` | `cardId` | Simulation, Reporting |
| `CardCancelled` | `cardId` | Simulation, Reporting |
| `CardCreditLimitChanged` | `cardId, creditLimit` | Reporting |
| `CardAuthorizationGranted` | `cardId, transactionId, amount, available` | Transactions, Reporting |
| `CardAuthorizationRefused` | `cardId, transactionId, reason` | Transactions |
| `CardHoldCaptured` | `cardId, transactionId` | Reporting |
| `CardHoldReleased` | `cardId, transactionId, available` | Reporting |
| `CardRepaid` | `cardId, amount, outstanding` | Reporting |

## Transactions

| Event | Payload | Consommateurs |
|---|---|---|
| `TransactionRequested` | `transactionId, cardId, amount, merchant, source, simulationRunId?` | Cards, Reporting |
| `TransactionAuthorized` | `transactionId, cardId, authorizedAt` | Reporting |
| `TransactionDeclined` | `transactionId, cardId, reason` | Reporting |
| `TransactionSettled` | `transactionId, cardId, settledAt` | Cards, Reporting |
| `TransactionRefunded` | `transactionId, cardId, amount, refundedAt` | Cards, Reporting |
| `TransactionAuthorizationCompensationRequired` | `transactionId, cardId, amount` | Cards (→ `release`) |

## Simulation

| Event | Payload | Consommateurs |
|---|---|---|
| `SimulationStarted` | `runId, scenario, ratePerMinute, seed` | Reporting (flux SSE) |
| `SimulationStopped` | `runId, generatedCount` | Reporting |
| `SimulationCompleted` | `runId, generatedCount` | Reporting |

## Règles

- On n'introduit pas de changement cassant dans un payload. On crée une `version + 1` et on garde un *upcaster* dans le consommateur.
- Les payloads ne contiennent que des types primitifs sérialisables, jamais d'objets du domaine.
- Les contrats vivent dans `apps/api/src/<context>/contracts/` et sont les **seuls** fichiers importables par un autre context.
