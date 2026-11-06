# 06 — Frontend (Next.js 16 / React 19)

## Principes

- **Server Components par défaut.** `"use client"` uniquement pour l'interactivité locale : formulaires avec état, graphiques, flux SSE, toasts. Les client components sont des feuilles de l'arbre, jamais des layouts.
- **Lectures** : dans les server components, via un client API typé (`lib/api/server.ts`). Pas de `useEffect` pour charger des données.
- **Mutations** : via des **Server Actions** (`app/**/actions.ts`, `"use server"`). Elles appellent l'API, puis `revalidatePath` / `revalidateTag`, et renvoient un état `{ ok } | { error: ProblemDetails }` consommé par `useActionState`.
- **Filtres et pagination dans l'URL** (`searchParams`). Une page filtrée est donc entièrement rendue côté serveur et partageable.
- **Streaming** : `loading.tsx` et `<Suspense>` par bloc du dashboard (KPIs, graphique, dernières transactions), chacun avec son skeleton shadcn.
- Dans Next 16, `params` et `searchParams` sont des **Promises** (`await props.params`).
- **Pas d'authentification** : aucune page de login, aucun `proxy.ts` de protection. `/` affiche directement le dashboard ([ADR-0006](adr/0006-no-authentication.md)).
- Le front ne contient **aucune logique métier** : il affiche ce que renvoie l'API et mappe les `code` d'erreur vers des messages français (`lib/errors.ts`).

## Arborescence

```
apps/web/
  app/
    (app)/layout.tsx                  # shell : sidebar, header (sélecteur de thème)
    (app)/page.tsx                    # dashboard
    (app)/transactions/page.tsx       # liste + filtres
    (app)/transactions/[id]/page.tsx
    (app)/cards/page.tsx, [id]/page.tsx, new/page.tsx
    (app)/people/page.tsx, [id]/page.tsx, new/page.tsx
    (app)/groups/page.tsx, [id]/page.tsx, new/page.tsx
    (app)/simulation/page.tsx         # formulaire + flux en direct + historique
    (app)/**/actions.ts
    (app)/**/error.tsx, not-found.tsx, loading.tsx
  components/
    ui/                               # shadcn/ui générés (button, card, table, dialog, badge, form…)
    domain/                           # TransactionStatusBadge, MoneyAmount, MaskedPan, AvailableGauge, Timeline
    charts/                           # VolumeChart (client, Recharts via le composant chart de shadcn)
    live/                             # LiveTransactionFeed (client, EventSource)
  lib/
    api/server.ts                     # fetch typé + mapping des erreurs
    format.ts                         # Intl.NumberFormat fr-FR, dates
    errors.ts                         # code → message
```

## Pages

| Route | Contenu | Interactivité client |
|---|---|---|
| `/` | page d'arrivée, sans connexion. KPIs sur la période (sélecteur dans l'URL), courbe de volume, top catégories, 10 dernières transactions | graphique |
| `/transactions` | table paginée par curseur, filtres (statut, carte, personne, groupe, catégorie, dates, montants) | formulaire de filtres (GET natif, sans JS indispensable) |
| `/transactions/[id]` | chronologie, marchand, carte, personne, groupe ; boutons « Régler » et « Rembourser » selon le statut | boutons (server actions) |
| `/cards` · `/cards/[id]` | liste, puis détail avec jauge du disponible, actions bloquer / débloquer / plafond / rembourser l'encours, transactions de la carte | dialogs |
| `/people` · `/people/[id]` | liste, puis détail : cartes, groupe, total ; action désactiver (avec confirmation) | dialog |
| `/groups` · `/groups/[id]` | liste, puis détail : membres, ajout et retrait, capacité, archivage | combobox de personnes |
| `/simulation` | formulaire de lancement, simulation en cours (compteur, bouton stop), flux en direct, historique | SSE |

## UI

- shadcn/ui (thème neutre) et Tailwind. Mode sombre via `next-themes`.
- Les statuts ont une couleur cohérente partout : `PENDING` gris, `AUTHORIZED` bleu, `SETTLED` vert, `DECLINED` rouge, `REFUNDED` violet.
- Les montants sont toujours formatés en `fr-FR` (`42,50 €`) et alignés à droite dans les tables.
- Accessibilité : labels de formulaire, focus visible, contrastes AA, tables avec `<caption>`.

## Tests front

- Composants de présentation (`components/domain`) : Jest + Testing Library.
- Server actions : tests unitaires avec un client API mocké.
- Parcours complets : Playwright (voir [07-testing-strategy.md](07-testing-strategy.md)).
