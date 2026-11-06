# 03 — User stories

Format : `US-<context>-<n>`. Chaque critère d'acceptation (CA) devient au moins un test. Les CA métier sont testés en unit, les CA de bout en bout en E2E.

> Il n'y a pas d'authentification : toutes les pages sont accessibles directement ([ADR-0006](../adr/0006-no-authentication.md)).

## Cardholders

**US-CH-1 — Enregistrer une personne**
- CA1 : avec un nom complet et un email valide, la personne est créée en `ACTIVE`.
- CA2 : un email déjà utilisé est refusé (`EMAIL_ALREADY_USED`).

**US-CH-2 — Désactiver une personne**
- CA1 : la personne passe en `DEACTIVATED`.
- CA2 : *(asynchrone)* toutes ses cartes passent en `BLOCKED(CARDHOLDER_DEACTIVATED)` en moins de 5 s.
- CA3 : *(asynchrone)* elle est retirée de son groupe.
- CA4 : toute transaction demandée ensuite sur ses cartes est `DECLINED(CARD_BLOCKED)`.

**US-CH-3 — Créer et gérer un groupe**
- CA1 : un nom unique et une capacité entre 1 et 50 sont requis.
- CA2 : ajouter une personne qui est déjà dans un groupe est refusé (`PERSON_ALREADY_IN_A_GROUP`).
- CA3 : ajouter un membre à un groupe plein est refusé (`GROUP_FULL`).
- CA4 : un groupe qui a encore des membres ne peut pas être archivé (`GROUP_NOT_EMPTY`).
- CA5 : la capacité ne peut pas descendre sous le nombre de membres actuel.

## Cards

**US-CA-1 — Émettre une carte**
- CA1 : une carte est émise pour une personne active, avec un plafond entre 100 € et 20 000 €, une marque et une expiration à 3 ans.
- CA2 : seul le PAN masqué est visible.
- CA3 : une personne désactivée ou inconnue est refusée.

**US-CA-2 — Bloquer / débloquer une carte**
- CA1 : une carte bloquée refuse toute nouvelle autorisation.
- CA2 : une carte bloquée pour `CARDHOLDER_DEACTIVATED` ne peut pas être débloquée.

**US-CA-3 — Modifier le plafond**
- CA1 : un plafond inférieur à l'encours actuel est refusé.

**US-CA-4 — Rembourser l'encours**
- CA1 : l'encours diminue du montant remboursé et le disponible augmente d'autant.
- CA2 : un montant supérieur à l'encours est refusé.

## Transactions

**US-TX-1 — Demander une autorisation** (API ou simulation)
- CA1 : la transaction est créée en `PENDING`, et l'API répond `202` avec son id.
- CA2 : si la carte est active et que le disponible suffit, elle passe en `AUTHORIZED` et le disponible baisse du montant.
- CA3 : si le disponible est insuffisant, elle passe en `DECLINED(INSUFFICIENT_AVAILABLE)`.
- CA4 : rejouer la même requête (même `transactionId`, même payload) ne crée pas de doublon et ne réserve pas deux fois.
- CA5 : sans réponse de Cards en 30 s, elle passe en `DECLINED(AUTHORIZATION_TIMEOUT)`.
- CA6 : à partir de 6 autorisations en 60 s sur une même carte, elle est `DECLINED(SUSPECTED_FRAUD)` et la carte est bloquée.

**US-TX-2 — Régler une transaction**
- CA1 : une transaction `AUTHORIZED` est réglée automatiquement au bout de 60 s (configurable), ou manuellement.
- CA2 : seule une transaction `AUTHORIZED` peut être réglée.

**US-TX-3 — Rembourser une transaction**
- CA1 : seule une transaction `SETTLED` peut être remboursée. Elle passe en `REFUNDED`.
- CA2 : *(asynchrone)* le disponible de la carte remonte du montant.

## Reporting (consultation)

**US-RE-1 — Dashboard**
- CA0 : ouvrir l'app (`/`) affiche directement le dashboard, sans écran de connexion ni redirection.
- CA1 : il affiche, sur la période choisie (24 h, 7 j, 30 j) : le volume autorisé, le nombre de transactions, le taux de refus et le top 5 des catégories.
- CA2 : il affiche une courbe du volume par jour ou par heure.
- CA3 : il affiche les 10 dernières transactions.

**US-RE-2 — Liste des transactions**
- CA1 : la pagination est par curseur, 25 transactions par page, triées par `requestedAt` décroissant.
- CA2 : on peut filtrer par statut, carte, personne, groupe, catégorie, plage de dates et plage de montants.
- CA3 : les filtres sont reflétés dans l'URL (lien partageable, rendu serveur).

**US-RE-3 — Détail**
- CA1 : la page d'une transaction montre sa chronologie (requested → authorized → settled → refunded) et sa carte, sa personne et son groupe.
- CA2 : la page d'une carte montre le plafond, l'encours, le disponible (jauge) et ses transactions.
- CA3 : la page d'une personne montre ses cartes, son groupe et le total dépensé. La page d'un groupe montre ses membres et son total.

## Simulation

**US-SI-1 — Lancer une simulation**
- CA1 : je choisis un scénario, une cadence, une limite optionnelle et une seed optionnelle (aléatoire par défaut, affichée).
- CA2 : lancer une simulation alors qu'une autre tourne est refusé (`SIMULATION_ALREADY_RUNNING`).
- CA3 : un flux en direct (SSE) affiche les transactions générées et leur décision.

**US-SI-2 — Arrêter une simulation**
- CA1 : l'arrêt est immédiat. Les transactions déjà demandées terminent leur cycle normalement.
