# ADR-0001 — Monorepo pnpm workspaces

- **Statut** : accepté
- **Date** : 2026-11-06

## Contexte
Le front (Next.js) et le back (NestJS) évoluent ensemble, et les contrats d'API doivent rester synchronisés. Il n'y a qu'une seule équipe et l'application est une démo.

## Décision
Un monorepo **pnpm workspaces** :
- `apps/api` (NestJS 10), `apps/web` (Next.js 16) ;
- `packages/shared` : uniquement les **types des DTO** et les codes d'erreur. Aucune logique, et aucune dépendance au domaine ;
- des scripts racine qui orchestrent l'ensemble (`pnpm -r`). Turborepo n'est pas utilisé pour l'instant.

## Alternatives considérées
- Deux dépôts : la synchronisation des contrats serait pénible pour une démo.
- Nx ou Turborepo : surdimensionnés à ce stade. On pourra les ajouter si les temps de build le justifient.
- Partager le domaine avec le front : refusé, car cela couplerait le front au modèle d'écriture.

## Conséquences
- Une seule CI et des PR atomiques front + back.
- Il faut veiller à ce que `packages/shared` ne devienne pas un fourre-tout. C'est vérifié par dependency-cruiser.
