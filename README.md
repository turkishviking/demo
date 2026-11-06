# CardSim — simulateur de transactions par carte

Application **de démonstration** d'une stack et d'une architecture : NestJS / Next.js, Clean Architecture, DDD, CQRS, tests en pyramide.
Elle simule des transactions bancaires par carte de crédit et propose un espace pour les visualiser. Ce n'est **pas** une application destinée à la production.

## En bref

- Un **utilisateur unique** (l'opérateur) arrive directement sur le dashboard des transactions, **sans connexion** (démo, pas d'authentification).
- Une **carte** appartient à une **personne**, et chaque personne fait partie d'un **groupe**.
- Un **moteur de simulation** génère des demandes de transaction (scénarios nominal, fraude, plafond atteint…). Chaque demande est autorisée ou refusée selon les règles métier de la carte.

## Stack

| Couche | Technologies |
|---|---|
| Back | NestJS 10, TypeORM (DataSource uniquement), PostgreSQL, Jest |
| Front | Next.js 16 (App Router), React 19 (server components en priorité), Tailwind CSS, shadcn/ui |
| Architecture | Clean Architecture, DDD, CQRS, ports & adapters, transactional outbox |
| Tests | Jest (unit + intégration avec Testcontainers), supertest, Playwright (E2E) |
| Outillage | pnpm workspaces, Docker Compose |

## Structure du monorepo (cible)

```
apps/
  api/            # NestJS — un dossier par bounded context
  web/            # Next.js 16
packages/
  shared/         # contrats d'API (types des DTO), aucune logique métier
docs/             # spécifications (ce dossier)
docker-compose.yml
```

## Documentation

| Doc | Sujet |
|---|---|
| [00 — Vision](docs/00-vision.md) | Objectifs, périmètre, points ouverts |
| [01 — Langage ubiquitaire](docs/01-ubiquitous-language.md) | Glossaire métier |
| [02 — Domaine](docs/02-domain/bounded-contexts.md) | Bounded contexts, agrégats, events |
| [03 — User stories](docs/03-features/user-stories.md) | Fonctionnalités et critères d'acceptation |
| [04 — Architecture](docs/04-architecture/overview.md) | Clean Archi, ports/adapters, CQRS, events, persistance |
| [05 — API](docs/05-api.md) | Contrat REST |
| [06 — Frontend](docs/06-frontend.md) | Pages, RSC, server actions |
| [07 — Tests](docs/07-testing-strategy.md) | Pyramide de tests |
| [08 — Conventions](docs/08-conventions.md) | Nommage, erreurs, style |
| [09 — Roadmap](docs/09-roadmap.md) | Jalons |
| [ADR](docs/adr/) | Décisions d'architecture |

## Démarrage (cible)

```bash
pnpm install
docker compose up -d postgres
pnpm --filter api migration:run
pnpm --filter api seed
pnpm dev            # api :3001, web :3000
pnpm test           # unit + intégration
pnpm test:e2e
```
