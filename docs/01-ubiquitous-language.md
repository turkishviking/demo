# 01 — Langage ubiquitaire

Les termes ci-dessous sont **les seuls** à utiliser dans le code, les specs et l'UI. Une colonne donne le terme français (UI et docs), l'autre le terme anglais (code).

| FR | EN (code) | Context | Définition |
|---|---|---|---|
| Personne | `Person` | Cardholders | Individu pouvant être titulaire de cartes. Ne se connecte pas. |
| Groupe | `Group` | Cardholders | Ensemble nommé de personnes (famille, équipe, entreprise…). |
| Membre | `Member` / `Membership` | Cardholders | Personne rattachée à un groupe. Une personne a au plus un groupe. |
| Titulaire | `Cardholder` | Cards | Vue d'une personne côté Cards : seulement l'id et le statut. |
| Carte | `Card` | Cards | Moyen de paiement rattaché à un titulaire. |
| PAN masqué | `MaskedPan` | Cards | Numéro de carte fictif affiché sous la forme `**** **** **** 1234`. |
| Plafond | `CreditLimit` | Cards | Montant maximum d'encours autorisé sur la carte. |
| Encours | `Outstanding` | Cards | Somme des montants réservés ou réglés et pas encore remboursés. |
| Disponible | `Available` | Cards | `Plafond − Encours`. |
| Réservation | `Hold` | Cards | Montant bloqué sur la carte pour une transaction autorisée. |
| Remboursement de l'encours | `Repayment` | Cards | Diminution de l'encours (le titulaire « paie sa carte »). |
| Transaction | `Transaction` | Transactions | Opération de paiement d'un montant chez un marchand. |
| Demande d'autorisation | `AuthorizationRequest` | Transactions | Création d'une transaction à l'état `PENDING`. |
| Autorisation | `Authorization` | Transactions / Cards | Acceptation de la transaction après réservation sur la carte. |
| Refus | `Decline` | Transactions | Rejet de la transaction, toujours avec un motif (`DeclineReason`). |
| Règlement | `Settlement` | Transactions | Confirmation définitive d'une transaction autorisée. |
| Remboursement | `Refund` | Transactions | Annulation d'une transaction réglée : le montant est restitué sur la carte. |
| Marchand | `Merchant` | Transactions | Commerçant (nom, pays, catégorie). |
| Catégorie marchand | `MerchantCategory` (MCC) | Transactions | Code de catégorie : `GROCERY`, `TRAVEL`, `RESTAURANT`… |
| Simulation | `SimulationRun` | Simulation | Exécution d'un scénario de génération de transactions. |
| Scénario | `Scenario` | Simulation | Profil de génération : `NOMINAL`, `FRAUD_BURST`, `LIMIT_REACHED`, `MIXED`. |
| Graine | `Seed` | Simulation | Valeur qui rend une simulation reproductible. |
| Montant | `Money` | Shared kernel | Montant en unités mineures (centimes, entier) + devise ISO 4217. |

## Mots interdits ou ambigus

- « Compte » : ce n'est pas un concept du domaine. Utiliser carte ou personne selon le cas.
- « Utilisateur » / « opérateur » : désigne la personne qui utilise l'app (le persona), jamais une `Person`. Ce n'est pas un concept du domaine : il n'y a pas d'authentification.
- « Paiement » : utiliser *transaction*.
- « Solde » : utiliser *encours* ou *disponible*.
