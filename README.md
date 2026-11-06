# CardSim — simulateur de transactions par carte

Application **de démonstration** d'une stack et d'une architecture : NestJS / Next.js, Clean Architecture, DDD, CQRS, tests en pyramide.
Elle simule des transactions bancaires par carte de crédit et propose un espace pour les visualiser. Ce n'est **pas** une application destinée à la production.

## En bref

- Un **utilisateur unique** (l'opérateur) arrive directement sur le dashboard des transactions, **sans connexion** (démo, pas d'authentification).
- Une **carte** appartient à une **personne**, et chaque personne fait partie d'un **groupe**.
- Un **moteur de simulation** génère des demandes de transaction (scénarios nominal, fraude, plafond atteint…). Chaque demande est autorisée ou refusée selon les règles métier de la carte.

## Stack

| Couche       | Technologies                                                                               |
| ------------ | ------------------------------------------------------------------------------------------ |
| Back         | NestJS 10, TypeORM (DataSource uniquement), PostgreSQL, Jest                               |
| Front        | Next.js 16 (App Router), React 19 (server components en priorité), Tailwind CSS, shadcn/ui |
| Architecture | Clean Architecture, DDD, CQRS, ports & adapters, transactional outbox                      |
| Tests        | Jest (unit + intégration avec Testcontainers), supertest, Playwright (E2E)                 |
| Outillage    | pnpm workspaces, Docker Compose                                                            |

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

| Doc                                                        | Sujet                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| [00 — Vision](docs/00-vision.md)                           | Objectifs, périmètre, points ouverts                   |
| [01 — Langage ubiquitaire](docs/01-ubiquitous-language.md) | Glossaire métier                                       |
| [02 — Domaine](docs/02-domain/bounded-contexts.md)         | Bounded contexts, agrégats, events                     |
| [03 — User stories](docs/03-features/user-stories.md)      | Fonctionnalités et critères d'acceptation              |
| [04 — Architecture](docs/04-architecture/overview.md)      | Clean Archi, ports/adapters, CQRS, events, persistance |
| [05 — API](docs/05-api.md)                                 | Contrat REST                                           |
| [06 — Frontend](docs/06-frontend.md)                       | Pages, RSC, server actions                             |
| [07 — Tests](docs/07-testing-strategy.md)                  | Pyramide de tests                                      |
| [08 — Conventions](docs/08-conventions.md)                 | Nommage, erreurs, style                                |
| [09 — Roadmap](docs/09-roadmap.md)                         | Jalons                                                 |
| [ADR](docs/adr/)                                           | Décisions d'architecture                               |

## Lancer la démo avec Docker

Prérequis : Docker (avec Compose). Rien d'autre à installer.

```bash
docker compose up --build -d     # Postgres + API + web, migrations appliquées au démarrage
```

| Service | Depuis la machine              | Depuis un autre poste du réseau           |
| ------- | ------------------------------ | ----------------------------------------- |
| Web     | http://localhost:3000          | `http://<ip-de-la-machine>:3000`          |
| API     | http://localhost:3001/api/docs | `http://<ip-de-la-machine>:3001/api/docs` |

Postgres reste limité à `127.0.0.1:5432`. Les ports publiés se changent avec `WEB_PORT` / `API_PORT` (`WEB_PORT=8080 docker compose up -d`). `docker compose down` arrête tout, `down -v` efface aussi les données.
Pas d'authentification (ADR-0006) : à n'utiliser que sur un réseau de confiance.

## Démarrage (développement)

Prérequis : Node ≥ 22, pnpm 11, Docker (avec Compose).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d --wait postgres   # la base seule
pnpm --filter api migration:run
pnpm dev            # api http://127.0.0.1:3001/api/v1 (docs : /api/docs), web http://127.0.0.1:3000
```

## Qualité

```bash
pnpm lint && pnpm format:check && pnpm typecheck
pnpm arch           # règles d'architecture (dependency-cruiser)
pnpm test           # tests unitaires (api + web)
pnpm --filter api test:cov
pnpm test:int       # intégration : Postgres jetable via Testcontainers (Docker requis)
pnpm test:e2e       # E2E API (Jest + supertest) puis UI (Playwright)
```

Playwright a besoin d'un navigateur : `pnpm --filter web exec playwright install chromium`.
