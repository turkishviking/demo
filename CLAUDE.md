# CLAUDE.md

Application de démo (pas de prod) : simulateur de transactions par carte. Les specs sont dans `docs/` et **font foi** : à lire avant d'implémenter une fonctionnalité.

## Règles d'architecture non négociables

- **Clean Architecture** : `domain` ← `application` ← `infrastructure` / `presentation`. Les dépendances pointent vers l'intérieur.
- `domain/` n'importe **jamais** `@nestjs/*`, `typeorm`, ni aucune lib d'infra. TypeScript pur.
- **Agrégats** définis par les invariants métier, pas par les tables. On ne référence un autre agrégat que **par son id**.
- **Une transaction DB = un agrégat modifié.** La coordination entre agrégats ou entre bounded contexts passe par des **domain events** (outbox).
- **Repositories maison** : interface dans `domain`, implémentation dans `infrastructure` avec `DataSource` / `EntityManager`. Jamais de `Repository<T>` TypeORM ni de `@InjectRepository`. Chargement et sauvegarde de l'agrégat **complet**.
- **CQRS** : les commandes passent par des agrégats et des repositories, les requêtes lisent des read models (SQL direct) sans passer par le domaine.
- Pas d'import croisé entre bounded contexts, sauf les contrats d'events publiés (`<context>/contracts`).
- **Pas d'authentification** : l'app est ouverte et `/` affiche directement le dashboard. Ne pas ajouter de login, de guard, de session ni de `proxy.ts` ([ADR-0006](docs/adr/0006-no-authentication.md)).

Détails : [docs/04-architecture/overview.md](docs/04-architecture/overview.md).

## Conventions

- Specs en français, code et identifiants en anglais.
- Erreurs métier : `DomainError` typées ([docs/08-conventions.md](docs/08-conventions.md)).
- Tests : `*.spec.ts` (unit), `*.int-spec.ts` (intégration), `*.e2e-spec.ts` (E2E). Toute règle métier doit avoir son test unitaire.
- Argent toujours en `Money` (centimes entiers + devise), jamais en `number` flottant.
- Temps via le port `Clock`, aléatoire via le port `RandomGenerator` : pas de `new Date()` ni de `Math.random()` dans `domain` ou `application`.

## Commandes (cible)

```bash
pnpm dev | pnpm test | pnpm test:int | pnpm test:e2e | pnpm lint | pnpm typecheck
pnpm --filter api migration:generate -- <Name>
```
