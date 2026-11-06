# Context Transactions

Porte le **cycle de vie** d'une transaction. La décision d'autorisation est déléguée à Cards via une saga par events.

## Agrégat `Transaction`

| Attribut | Type | Notes |
|---|---|---|
| `id` | `TransactionId` | fourni par l'appelant (idempotence) ou généré |
| `cardId` | `CardId` | |
| `amount` | `Money` | > 0, ≤ 10 000 € par transaction |
| `merchant` | `Merchant` (VO) | `{ name, category: MerchantCategory, country: ISO-3166 alpha-2 }` |
| `status` | voir le diagramme | |
| `declineReason` | `DeclineReason \| null` | obligatoire si `DECLINED`. Reprend les motifs de Cards (via le contrat d'event) et ajoute `AUTHORIZATION_TIMEOUT`, propre à Transactions |
| `requestedAt`, `authorizedAt`, `settledAt`, `refundedAt` | `Date \| null` | |
| `source` | `MANUAL \| SIMULATION` | + `simulationRunId?` |
| `version` | `number` | |

## Cycle de vie

```mermaid
stateDiagram-v2
  [*] --> PENDING : RequestAuthorization
  PENDING --> AUTHORIZED : CardAuthorizationGranted
  PENDING --> DECLINED : CardAuthorizationRefused
  PENDING --> DECLINED : timeout 30s (AUTHORIZATION_TIMEOUT)
  AUTHORIZED --> SETTLED : SettleTransaction (job ou manuel)
  SETTLED --> REFUNDED : RefundTransaction
  DECLINED --> [*]
  REFUNDED --> [*]
```

**Invariants**
- T1 : les transitions respectent strictement le diagramme. Toute autre transition lève `InvalidTransactionTransition`.
- T2 : `DECLINED` a toujours un `declineReason`.
- T3 : un remboursement porte sur le **montant total** (pas de remboursement partiel dans la v1).
- T4 : les transitions déclenchées par des events sont idempotentes. Recevoir `CardAuthorizationGranted` sur une transaction déjà `AUTHORIZED` ne fait rien.
- T5 : les horodatages sont croissants (`requestedAt ≤ authorizedAt ≤ settledAt ≤ refundedAt`).

## Saga d'autorisation

```mermaid
sequenceDiagram
  participant SIM as Simulation / API
  participant TX as Transactions
  participant OB as Outbox + relais
  participant CA as Cards
  SIM->>TX: RequestAuthorization(txId, cardId, amount, merchant)
  TX->>TX: Transaction.request() → PENDING
  TX->>OB: TransactionRequested (même transaction DB)
  OB->>CA: TransactionRequested
  CA->>CA: card.requestAuthorization() → hold ou refus
  CA->>OB: CardAuthorizationGranted | Refused
  OB->>TX: event
  TX->>TX: authorize() | decline(reason)
```

- Chaque étape modifie **un seul agrégat** dans **une seule transaction DB**.
- **Timeout** : le job `ExpirePendingTransactions` (toutes les 10 s) passe en `DECLINED(AUTHORIZATION_TIMEOUT)` les transactions `PENDING` depuis plus de 30 s. Si un `Granted` arrive après un timeout, Transactions publie `TransactionAuthorizationCompensationRequired`. Cards réagit avec `release()` : c'est la compensation.
- **Règlement** : le job `SettleAuthorizedTransactions` règle les transactions `AUTHORIZED` depuis plus de N secondes (configurable, 60 s par défaut). L'opérateur peut aussi régler manuellement.

## Commandes

`RequestAuthorization`, `ApplyAuthorizationDecision` (interne, déclenchée par un event), `ExpirePendingTransactions`, `SettleTransaction`, `RefundTransaction`.

## Events émis

`TransactionRequested`, `TransactionAuthorized`, `TransactionDeclined`, `TransactionSettled`, `TransactionRefunded`, `TransactionAuthorizationCompensationRequired`.

## Erreurs métier

`TransactionNotFound`, `InvalidTransactionTransition`, `InvalidAmount`, `TransactionAlreadyExists` (même id, payload différent).
