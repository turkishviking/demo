# 05 — API REST

- Base : `/api/v1`. JSON, `camelCase`. Documentation OpenAPI générée (`@nestjs/swagger`) sur `/api/docs`.
- **Pas d'authentification** : toutes les routes sont publiques ([ADR-0006](adr/0006-no-authentication.md)). L'API n'écoute que sur `localhost` par défaut.
- **Commandes** : `POST` sur une ressource, ou `POST /<ressource>/:id/<verbe>` pour une action métier (pas de `PUT` générique). Réponse `201 { id }`, `204`, ou `202 { id }` quand le traitement est asynchrone.
- **Requêtes** : `GET`, servies par les read models de Reporting.
- **Idempotence** : l'en-tête `Idempotency-Key` sera accepté sur les commandes `POST` (prévu avec M3). Pour `POST /transactions`, c'est l'`id` fourni dans le body qui joue ce rôle.
- Montants : `{ "amountMinor": 4250, "currency": "EUR" }`.
- Les DTO sont validés avec `class-validator` dans `presentation`, et leurs types sont partagés avec le front via `packages/shared`.

## Erreurs (RFC 9457 `application/problem+json`)

```json
{ "type": "https://cardsim.local/errors/group-full", "title": "Group is full", "status": 409,
  "code": "GROUP_FULL", "detail": "Group g-123 already has 10 members", "correlationId": "…" }
```

| Origine | HTTP |
|---|---|
| Validation du DTO | 400 `VALIDATION_ERROR` (+ `errors[]`) |
| `*NotFound` | 404 |
| Violation d'invariant / transition invalide | 409 ou 422 (selon la table de mapping de chaque `DomainError`) |
| `ConcurrencyError` après retries | 409 `CONCURRENT_MODIFICATION` |

## Endpoints

### Cardholders
| Méthode | Route | Body / params | Réponse |
|---|---|---|---|
| POST | `/persons` | `{ firstName, lastName, email }` | 201 `{ id }` |
| POST | `/persons/:id/rename` | `{ firstName, lastName }` | 204 |
| POST | `/persons/:id/deactivate` | – | 204 |
| GET | `/persons` | `?q&groupId&status&cursor&limit` | page de `PersonListItem` (`q` cherche dans le nom et l'email) |
| GET | `/persons/:id` | – | `PersonDetails` (groupe ; cartes et total à partir de M2/M3) |
| POST | `/groups` | `{ name, maxMembers }` | 201 `{ id }` |
| POST | `/groups/:id/rename` | `{ name }` | 204 |
| POST | `/groups/:id/members` | `{ personId }` | 204 |
| DELETE | `/groups/:id/members/:personId` | – | 204 |
| POST | `/groups/:id/capacity` | `{ maxMembers }` | 204 |
| POST | `/groups/:id/archive` | – | 204 |
| GET | `/groups` | `?status&cursor&limit` | page de `GroupListItem` |
| GET | `/groups/:id` | – | `GroupDetails` (avec `members`) |

Les commandes de ce context répondent `409` pour une règle violée (`EMAIL_ALREADY_USED`, `GROUP_NAME_ALREADY_USED`, `GROUP_FULL`, `PERSON_ALREADY_IN_A_GROUP`, `GROUP_NOT_EMPTY`, `CAPACITY_BELOW_MEMBER_COUNT`, `GROUP_ARCHIVED`, `PERSON_DEACTIVATED`, `PERSON_NOT_MEMBER`) et `422` pour une valeur invalide (`INVALID_EMAIL`…). Les `GET` sont servis par les read models de Reporting : juste après une commande, ils peuvent encore renvoyer l'état précédent (ou `404`).

### Cards
| Méthode | Route | Body | Réponse |
|---|---|---|---|
| POST | `/cards` | `{ cardholderId, brand, creditLimit }` | 201 `{ id }` |
| POST | `/cards/:id/block` | `{ reason: "MANUAL" }` | 204 |
| POST | `/cards/:id/unblock` | – | 204 |
| POST | `/cards/:id/cancel` | – | 204 |
| POST | `/cards/:id/credit-limit` | `{ creditLimit }` | 204 |
| POST | `/cards/:id/repayments` | `{ amount }` | 204 |
| GET | `/cards` | `?cardholderId&groupId&status&cursor&limit` | page de `CardListItem` |
| GET | `/cards/:id` | – | `CardDetails` (plafond, encours, disponible) |

### Transactions
| Méthode | Route | Body | Réponse |
|---|---|---|---|
| POST | `/transactions` | `{ id, cardId, amount, merchant: { name, category, country } }` | 202 `{ id }` |
| POST | `/transactions/:id/settle` | – | 204 |
| POST | `/transactions/:id/refund` | – | 204 |
| GET | `/transactions` | `?status&cardId&personId&groupId&category&from&to&minAmount&maxAmount&cursor&limit` | page de `TransactionListItem` |
| GET | `/transactions/:id` | – | `TransactionDetails` (chronologie) |

### Reporting
| Méthode | Route | Params | Réponse |
|---|---|---|---|
| GET | `/stats/overview` | `?period=24h\|7d\|30d&groupId?` | `{ authorizedVolume, count, declineRate, topCategories[] }` |
| GET | `/stats/timeseries` | `?period&bucket=hour\|day&groupId?` | `[{ bucket, authorizedVolume, count, declined }]` |

### Simulation
| Méthode | Route | Body | Réponse |
|---|---|---|---|
| POST | `/simulations` | `{ scenario, ratePerMinute, maxTransactions?, seed?, targetCardIds? }` | 201 `{ id, seed }` |
| POST | `/simulations/:id/stop` | – | 204 |
| GET | `/simulations` | `?cursor&limit` | page de `SimulationRunItem` |
| GET | `/simulations/current` | – | `SimulationRunItem \| null` |
| GET | `/events/stream` | `?topics=transactions,simulation` | `text/event-stream` (SSE) |

### Technique
`GET /health` (liveness + DB), `GET /health/outbox` (nombre d'events en attente et en dead letter).

## Pagination

Par curseur : `{ items: T[], nextCursor: string | null }`. Le curseur est opaque (base64url de `clé de tri|id`, par exemple `requestedAt|id`). `limit` vaut 25 par défaut, 100 au maximum. Un curseur invalide donne `400 INVALID_CURSOR`.
