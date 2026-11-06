# 07 — Stratégie de tests

## Pyramide

```
            ▲  E2E (Playwright, peu nombreux, parcours critiques)
           ▲▲▲  API E2E (supertest sur l'app complète + Postgres)
        ▲▲▲▲▲▲▲  Intégration (repositories, projections, outbox, controllers)
  ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲  Unit (domaine + application, majoritaires et rapides)
```

| Niveau | Cible | Outils | Suffixe | Base de données | Durée cible |
|---|---|---|---|---|---|
| Unit | agrégats, VO, domain services, command / query handlers, policies, générateur de simulation | Jest | `*.spec.ts` | aucune (fakes in-memory) | < 10 s pour toute la suite |
| Intégration | repositories (tests de contrat), mappers, UnitOfWork, outbox et relais, inbox, projections, read models SQL, controllers (`@nestjs/testing` + supertest, avec les handlers réels) | Jest + **Testcontainers** Postgres 16 | `*.int-spec.ts` | conteneur partagé par worker, schémas tronqués entre les tests | < 2 min |
| API E2E | sagas complètes par HTTP : autorisation, désactivation en cascade, timeout, compensation, remboursement | Jest + supertest + `ControllableClock` | `*.e2e-spec.ts` | conteneur dédié | < 3 min |
| UI E2E | arrivée directe sur le dashboard, filtrer les transactions, émettre une carte, lancer une simulation et voir le flux, désactiver une personne | **Playwright** | `apps/web/e2e/*.spec.ts` | `docker compose` (api + web + db) | < 5 min |
| Front unit | composants de présentation, server actions, mapping des erreurs | Jest + Testing Library | `*.spec.tsx` | – | – |

## Couverture (seuils bloquants en CI)

| Périmètre | Lignes / branches |
|---|---|
| `apps/api/src/**/domain` | ≥ 95 % / 90 % |
| `apps/api/src/**/application` | ≥ 90 % / 85 % |
| `apps/api` global (unit + intégration fusionnés) | ≥ 85 % |
| `apps/web` (hors `components/ui`) | ≥ 70 % |

## Règles

- **Un invariant = au moins un test unitaire**, nommé d'après la règle : `it('refuses authorization when amount exceeds available (C2)')`.
- **Pas de mock de ce qu'on possède** dans les tests unitaires : on utilise les fakes in-memory des ports, pas `jest.fn()` sur un repository. `jest.fn()` reste acceptable pour vérifier un appel vers un port sortant (`TransactionGateway`).
- **Tests de contrat** partagés entre les fakes et les implémentations réelles (voir [ports-and-adapters.md](04-architecture/ports-and-adapters.md#tests-de-contrat)).
- **Déterminisme** : `FixedClock` ou `ControllableClock`, `SequentialIdGenerator` et `SeededRandomGenerator` partout. Aucun `sleep` dans les tests. Pour l'asynchrone, on utilise `eventually(() => expect(...), { timeout })`.
- **Builders** de données de test : `aCard().active().withLimit(eur(500)).withHold(eur(100)).build()`, dans `test/builders/` de chaque context.
- **Given / When / Then** dans la structure des tests de handlers :
  ```ts
  it('declines with INSUFFICIENT_AVAILABLE when limit is reached', async () => {
    // Given
    const card = aCard().withLimit(eur(100)).withHold(eur(80)).build();
    await cards.save(card);
    // When
    await policy.handle(transactionRequested({ cardId: card.id, amount: eur(30) }));
    // Then
    expect(recordedEvents()).toContainEvent('CardAuthorizationRefused', { reason: 'INSUFFICIENT_AVAILABLE' });
  });
  ```
- **Tests d'architecture** (Jest + `dependency-cruiser`) : le domaine n'importe ni Nest ni TypeORM, il n'y a pas d'import entre contexts hors `contracts`, et `presentation` n'importe pas `infrastructure` (sauf les `*.module.ts`, qui servent de composition root). Commande : `pnpm arch` (`apps/api/.dependency-cruiser.cjs`).
- Les user stories ([03-features](03-features/user-stories.md)) sont tracées : chaque CA est référencé dans le nom d'au moins un test (`US-TX-1 CA4`).

## Notes Testcontainers

- Un conteneur `postgres:16-alpine` est démarré une fois par run (`test/postgres/global-setup.ts`), migrations appliquées. Les tests tournent en série et tronquent les tables entre eux.
- Sur les hôtes SELinux (Fedora, Bazzite), le conteneur de nettoyage Ryuk doit être privilégié : le global setup positionne `TESTCONTAINERS_RYUK_PRIVILEGED=true` par défaut.

## CI (GitHub Actions)

`lint` → `typecheck` → `test:unit` (avec couverture) → `test:int` → `test:e2e:api` → `build` → `test:e2e:ui`, exécutés en parallèle quand c'est possible. Les rapports de couverture sont fusionnés et publiés en artefact.
