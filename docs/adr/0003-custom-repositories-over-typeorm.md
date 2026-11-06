# ADR-0003 — Repositories maison au-dessus de la DataSource TypeORM

- **Statut** : accepté
- **Date** : 2026-11-06

## Contexte
Les `Repository<T>` TypeORM imposent des entités ORM décorées, avec un chargement partiel et du lazy loading. Cela va contre un domaine pur, où l'agrégat est chargé et sauvegardé comme un tout.

## Décision
- Les interfaces de repository sont définies dans le **domaine** : `findById`, `save`, plus quelques finders métier.
- Les implémentations utilisent **la `DataSource` / l'`EntityManager` directement** (SQL paramétré ou QueryBuilder), avec des **mappers explicites** entre lignes SQL et agrégat.
- Chargement et sauvegarde systématiques de l'**agrégat complet**. Verrou optimiste par colonne `version`.
- Le repository écrit aussi les events de l'agrégat dans l'outbox, dans la même transaction.
- La transaction est portée par un `UnitOfWork`, qui propage l'`EntityManager` via `AsyncLocalStorage`.

## Alternatives considérées
- TypeORM `Repository<T>` + entités ORM = domaine : couplage fort et invariants contournables.
- Prisma, MikroORM : hors stack imposée. MikroORM aurait un vrai unit of work, mais il est écarté.
- Event sourcing : plus puissant, mais trop complexe pour la démo. L'outbox conservée donne une partie des bénéfices.

## Conséquences
- Des mappers à écrire et à tester (tests de contrat partagés avec les fakes in-memory).
- Contrôle total du SQL, sans magie ni requêtes N+1 cachées.
- TypeORM reste utile pour la connexion, les transactions et les migrations.
