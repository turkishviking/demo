# Context Cards

Gère l'émission des cartes et **décide** si une carte peut payer un montant donné.

## Projection locale `Cardholder`

Cards ne lit pas Cardholders. Il garde une table `cards.cardholders(person_id, status)`, alimentée par `PersonRegistered` et `PersonDeactivated`. Elle est exposée au domaine via le port `CardholderDirectory.isActive(personId)`.

## Agrégat `Card`

| Attribut | Type | Notes |
|---|---|---|
| `id` | `CardId` | |
| `cardholderId` | `PersonId` | référence par id seulement |
| `maskedPan` | `MaskedPan` (VO) | généré par le port `PanGenerator`, 4 derniers chiffres visibles |
| `brand` | `VISA \| MASTERCARD` | |
| `status` | `ACTIVE \| BLOCKED \| EXPIRED \| CANCELLED` | |
| `blockReason` | `MANUAL \| FRAUD_SUSPECTED \| CARDHOLDER_DEACTIVATED \| null` | |
| `creditLimit` | `Money` | de 100 € à 20 000 € |
| `holds` | `Hold[]` (entité) | réservations ouvertes `{ transactionId, amount, heldAt }` |
| `settledOutstanding` | `Money` | encours des transactions réglées, net des remboursements |
| `outstanding` | `Money` | dérivé : `settledOutstanding + Σ holds.amount` |
| `expiresAt` | `YearMonth` | |
| `version` | `number` | |

> `holds` fait partie de l'agrégat, car l'invariant de plafond en dépend. Il ne contient que les réservations **ouvertes**. `capture()` retire le hold et ajoute son montant à `settledOutstanding`. L'agrégat reste ainsi petit, quel que soit l'historique.

**Invariants**
- C1 : `outstanding ≤ creditLimit` en permanence.
- C2 : une autorisation n'est accordée que si `status = ACTIVE`, que la carte n'est pas expirée à la date du `Clock` et que `amount ≤ available`.
- C3 : un hold est unique par `transactionId` (idempotence de la saga).
- C4 : `CANCELLED` est terminal. `EXPIRED` est calculé à la lecture de la date et peut être persisté par un job.
- C5 : on ne peut pas baisser `creditLimit` sous l'`outstanding` actuel.
- C6 : un `Repayment` ne peut pas rendre l'`outstanding` négatif. Montant > 0.
- C7 : une carte bloquée pour `CARDHOLDER_DEACTIVATED` ne peut pas être débloquée manuellement.

**Comportements**

```ts
class Card extends AggregateRoot<CardId> {
  static issue(props: IssueCardProps, deps: { panGenerator: PanGenerator; clock: Clock }): Card;
  requestAuthorization(transactionId: TransactionId, amount: Money, now: Date): AuthorizationDecision; // émet Granted | Refused
  capture(transactionId: TransactionId): void;     // règlement
  release(transactionId: TransactionId, amount: Money): void; // supprime le hold s'il existe, sinon déduit de settledOutstanding (remboursement)
  repay(amount: Money): void;
  block(reason: BlockReason): void;
  unblock(): void;
  changeCreditLimit(limit: Money): void;
  cancel(): void;
}
```

`requestAuthorization` ne lève **pas** d'erreur quand la règle métier refuse : un refus est un résultat métier normal. Il renvoie `Refused(reason)` et émet `CardAuthorizationRefused`.

**Motifs de refus** (`DeclineReason`) : `CARD_NOT_FOUND`, `CARD_BLOCKED`, `CARD_EXPIRED`, `CARD_CANCELLED`, `INSUFFICIENT_AVAILABLE`, `SUSPECTED_FRAUD`.

**Détection de fraude (simple)** : le domain service `VelocityCheck` refuse avec `SUSPECTED_FRAUD` et bloque la carte (`FRAUD_SUSPECTED`) au-delà de **5 autorisations en 60 secondes** sur une même carte. L'historique récent vient du port `RecentAuthorizationsReader`. On le garde hors de l'agrégat pour ne pas le gonfler.

## Events émis

`CardIssued`, `CardBlocked`, `CardUnblocked`, `CardCancelled`, `CardCreditLimitChanged`, `CardAuthorizationGranted`, `CardAuthorizationRefused`, `CardHoldCaptured`, `CardHoldReleased`, `CardRepaid`.

## Réactions aux events

| Event reçu | Handler | Effet |
|---|---|---|
| `PersonRegistered` | `UpsertCardholderProjection` | ajoute le titulaire en `ACTIVE` |
| `PersonDeactivated` | `UpsertCardholderProjection` puis `BlockCardsOfDeactivatedCardholder` | une commande `BlockCard(CARDHOLDER_DEACTIVATED)` **par carte**, chacune dans sa propre transaction |
| `TransactionRequested` | `AuthorizeOnCard` | `card.requestAuthorization()` (si la carte est introuvable : publie `CardAuthorizationRefused(CARD_NOT_FOUND)`) |
| `TransactionSettled` | `CaptureHold` | `card.capture()` |
| `TransactionRefunded` | `ReleaseHold` | `card.release()` |

## Commandes

`IssueCard` (le titulaire doit être actif d'après la projection), `BlockCard`, `UnblockCard`, `CancelCard`, `ChangeCreditLimit`, `RepayCard`.
