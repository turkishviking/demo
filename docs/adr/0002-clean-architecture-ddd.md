# ADR-0002 — Clean Architecture + DDD

- **Statut** : accepté
- **Date** : 2026-11-06

## Contexte
Le but de l'application est de démontrer une architecture maintenable, avec un domaine testable sans infrastructure et un couplage minimal entre sous-domaines.

## Décision
- Découpage en **bounded contexts** (Cardholders, Cards, Transactions, Simulation, Reporting), chacun avec ses 4 couches : `domain`, `application`, `infrastructure`, `presentation`.
- **Domaine en TypeScript pur**, sans aucune dépendance de framework.
- **Agrégats dessinés autour des invariants** : par exemple, `Card` porte les holds parce que la règle de plafond en dépend. La structure des tables ne guide pas ce découpage.
- Une transaction DB ne modifie qu'un seul agrégat. La coordination passe par des domain events et des policies.
- Communication entre contexts **asynchrone uniquement**, via des contrats d'events versionnés. Les données externes nécessaires sont gardées en projections locales.

## Alternatives considérées
- Architecture « Nest classique » (services + entités TypeORM) : plus rapide à écrire, mais le domaine serait couplé à l'ORM, ce qui va contre l'objectif de la démo.
- Appels synchrones entre contexts : plus simples, mais ils créent un couplage temporel et de modèle.

## Conséquences
- Plus de code d'infrastructure (mappers, outbox, projections).
- Cohérence éventuelle entre contexts, à gérer dans l'UI (état `PENDING`, SSE).
- Le domaine se teste en millisecondes, et les frontières sont vérifiables automatiquement.
