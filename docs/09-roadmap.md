# 09 — Roadmap

Chaque jalon est **livrable et démontrable**, avec ses tests aux trois niveaux.

| Jalon | Contenu | Démo de fin de jalon |
|---|---|---|
| **M0 — Socle** ✅ | Monorepo pnpm, apps `api` et `web` vides, Docker Compose Postgres, CI, ESLint + dependency-cruiser, `shared/domain` (`AggregateRoot`, `Money`, `DomainError`), `UnitOfWork`, outbox + relais + inbox, filtre d'erreurs, `/health` | Les tests d'archi et de l'outbox passent en CI |
| **M1 — Cardholders** | Shell de l'app (layout, navigation, `/` accessible directement). `Person`, `Group` (commandes, invariants, repositories). Projections `rm_people`, `rm_groups`. Pages people et groups | Créer un groupe, ajouter des personnes, voir la règle « un seul groupe » |
| **M2 — Cards** | Projection `cardholders`, `Card` (émission, blocage, plafond, remboursement de l'encours). Policy de désactivation en cascade. `rm_cards`. Pages cards | Désactiver une personne et voir ses cartes se bloquer |
| **M3 — Transactions** | `Transaction`, saga d'autorisation, `VelocityCheck`, timeout et compensation, jobs de règlement, refund. `rm_transactions`. Pages transactions (liste, filtres, détail) | Transaction manuelle autorisée, refusée pour plafond, puis remboursée |
| **M4 — Simulation** | `SimulationRun`, générateur avec seed, scénarios, `TransactionGateway`, SSE. Page simulation | Lancer `MIXED` à 120/min et observer le flux en direct |
| **M5 — Dashboard** | `rm_daily_stats`, endpoints de stats, dashboard en RSC (streaming), graphiques, seed complet | Démo complète de bout en bout |
| **M6 — Bonus** | `ReadModelCache` (LRU), rebuild des projections par CLI, `HttpTransactionGateway`, plafond par groupe (saga), broker externe | – |
