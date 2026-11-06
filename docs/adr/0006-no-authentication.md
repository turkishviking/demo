# ADR-0006 — Pas d'authentification

- **Statut** : accepté (remplace la première version, qui prévoyait un login opérateur par JWT)
- **Date** : 2026-11-06

## Contexte
L'application est une démo de stack, avec un seul utilisateur. L'authentification n'est pas le sujet de la démo, et un écran de connexion ne fait qu'ajouter de la friction : l'utilisateur doit arriver **directement sur le dashboard**.

## Décision
- **Aucune authentification** : pas de login ni de logout, pas de session, de cookie, de JWT ni de guard.
- Pas de context Identity, pas de table d'utilisateurs, pas de `proxy.ts` de protection côté Next.js.
- `/` affiche directement le dashboard. Toutes les routes de l'API sont publiques.
- L'API et le front écoutent sur `localhost` par défaut. L'application **ne doit pas être exposée publiquement**.

## Alternatives considérées
- Login opérateur seedé, avec JWT en cookie httpOnly : écarté, c'est de la friction et de la complexité sans valeur pour la démo.
- Auth.js / NextAuth : même raison.

## Conséquences
- Moins de code et de tests. En E2E, les tests ouvrent directement les pages.
- Si l'application devait un jour être exposée ou devenir multi-utilisateur, il faudrait un nouvel ADR (context Identity, guard global, protection des routes Next).
