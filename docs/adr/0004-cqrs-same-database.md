# ADR-0004 — CQRS sur une base unique

- **Statut** : accepté
- **Date** : 2026-11-06

## Contexte
Les écrans de consultation (listes filtrées, dashboard) mélangent des données de plusieurs contexts. Ils seraient coûteux et couplants à construire à partir des agrégats.

## Décision
- Séparation **write side** (commandes → agrégats) et **read side** (queries → read models dénormalisés du context Reporting).
- Les read models sont mis à jour par des **projections** qui consomment les domain events. Les projections sont idempotentes et peuvent être reconstruites.
- **Même instance Postgres** pour tout, avec un schéma `reporting` dédié.
- Un port `ReadModelCache` est prévu (implémentation `Noop` en v1).

## Alternatives considérées
- Queries directes sur les tables write avec des jointures entre contexts : elles cassent l'isolation des contexts.
- Base de lecture séparée dès maintenant : de la complexité opérationnelle sans besoin réel.

## Conséquences
- Cohérence éventuelle de la lecture (de l'ordre de 100 ms en local).
- On peut plus tard déplacer `reporting` sur une autre base ou ajouter un cache sans toucher au write side.
