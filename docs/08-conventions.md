# 08 — Conventions

## Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Fichiers | kebab-case + suffixe de rôle | `card.aggregate.ts`, `masked-pan.vo.ts`, `issue-card.handler.ts`, `typeorm-card.repository.ts` |
| Commande | verbe à l'impératif | `IssueCardCommand` |
| Query | `Get…` / `List…` | `ListTransactionsQuery` |
| Event | fait au passé | `CardBlocked` (type : `cards.CardBlocked`) |
| Policy | ce qu'elle fait | `BlockCardsOfDeactivatedCardholderPolicy` |
| Port | nom métier, sans préfixe `I` | `CardholderDirectory` + token `CARDHOLDER_DIRECTORY` |
| Adapter | technologie + port | `TypeormCardRepository`, `InMemoryCardRepository` |
| Ids | types nominaux | `type CardId = Brand<string, 'CardId'>` |

## Domaine

- Les agrégats exposent des **méthodes métier**, jamais de setters publics. Leurs propriétés sont `readonly` vers l'extérieur.
- La création passe par une factory statique (`Card.issue`), qui valide les invariants. La reconstruction passe par `Card.restore` (aucun event, aucune validation de création).
- Les value objects sont immuables et comparés par valeur. Leur constructeur est privé, et `X.create()` lève une erreur si la valeur est invalide.
- `Money` : arithmétique en entiers, refus de combiner des devises différentes, aucun flottant.
- Aucune primitive « nue » pour un concept métier dans les signatures du domaine (`Money` plutôt que `number`).

## Gestion des erreurs

- `DomainError` (classe abstraite) avec un `code: string` stable (`GROUP_FULL`) et un `context`. Chaque context définit ses sous-classes dans `domain/errors`.
- Le domaine **lève** des `DomainError` pour les violations d'invariant. Les **refus métier attendus** (refus d'autorisation) sont des résultats, pas des exceptions.
- L'application ne fait pas de `catch` des `DomainError`. Le filtre global `ProblemDetailsFilter` (`shared/presentation/http`) les traduit en `problem+json`, à partir d'une table `code → status` alimentée par `registerDomainErrorStatuses()` (par défaut : 404 pour un `NotFoundError`, 422 sinon).
- Les erreurs techniques (DB, réseau) ne sont jamais converties en `DomainError`. Elles produisent un 500 avec un `correlationId` et un log `error`.

## Code

- TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. `any` est interdit (règle ESLint).
- ESLint (typescript-eslint `strict`, règles Next et React Hooks pour le web) et Prettier. `dependency-cruiser` pour les règles de couches. Dans `domain` et `application`, ESLint interdit `new Date()`, `Date.now()` et `Math.random()`.
- Imports **relatifs** (pas d'alias de chemins : le build `tsc` de Nest ne les réécrit pas). Les seuls imports qui sortent d'un context visent `shared/`, `config/` ou les `contracts/` d'un autre context. C'est vérifié par dependency-cruiser.
- Logs structurés (`pino` via `nestjs-pino`), avec `correlationId` sur chaque ligne. Pas de `console.log`.
- Configuration validée au démarrage (`zod`), lue depuis `.env`, avec un `.env.example` versionné.

## Git

- Conventional Commits : `feat(cards): issue card command`, `test(transactions): saga timeout`, `docs(adr): 0005 outbox`.
- Une PR = un cas d'usage, avec ses tests. La CI doit être verte avant le merge.
- Toute décision structurante donne lieu à un nouvel ADR dans `docs/adr/`.
