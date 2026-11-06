# Context Simulation

Génère des demandes de transaction fictives pour donner vie à la démo. C'est l'exemple de **provider externe** derrière un port.

## Agrégat `SimulationRun`

| Attribut | Type | Notes |
|---|---|---|
| `id` | `SimulationRunId` | |
| `scenario` | `NOMINAL \| FRAUD_BURST \| LIMIT_REACHED \| MIXED` | |
| `targetCardIds` | `CardId[]` | vide = toutes les cartes actives (résolu au démarrage) |
| `ratePerMinute` | `number` | de 1 à 600 |
| `maxTransactions` | `number \| null` | arrêt automatique |
| `seed` | `number` | reproductibilité |
| `status` | `RUNNING \| STOPPED \| COMPLETED` | |
| `generatedCount` | `number` | |
| `startedAt`, `endedAt` | `Date` | |

**Invariants**
- S1 : **une seule** simulation `RUNNING` à la fois. Garanti par un index unique partiel `WHERE status = 'RUNNING'` + une vérification applicative.
- S2 : `generatedCount ≤ maxTransactions`. Quand la limite est atteinte, la simulation passe en `COMPLETED`.
- S3 : `STOPPED` et `COMPLETED` sont terminaux.

## Scénarios

| Scénario | Comportement |
|---|---|
| `NOMINAL` | montants log-normaux autour de 40 €, marchands variés, cartes tirées uniformément |
| `FRAUD_BURST` | rafales de 6 à 10 transactions en moins de 60 s sur une même carte, pays étrangers |
| `LIMIT_REACHED` | montants élevés sur un petit nombre de cartes, jusqu'à épuisement du disponible |
| `MIXED` | 80 % nominal, 10 % fraude, 10 % plafond |

Le générateur (`TransactionGenerator`, domain service pur) prend un `RandomGenerator` initialisé avec la `seed` : même seed + mêmes cartes = même séquence. Le test unitaire s'appuie sur cette propriété.

## Ports

| Port | Rôle | Adapter v1 |
|---|---|---|
| `TransactionGateway` | envoyer une demande d'autorisation | `InProcessTransactionGateway` → commande `RequestAuthorization` |
| `ActiveCardsReader` | lister les cartes ciblables | projection locale `simulation.target_cards`, alimentée par `CardIssued`, `CardBlocked`, `CardUnblocked`, `CardCancelled`. Aucune lecture des tables d'un autre context. |
| `RandomGenerator` | aléatoire déterministe | `SeededRandomGenerator` (mulberry32) |
| `Scheduler` | rythme des ticks | `IntervalScheduler` (setInterval) ; `ManualScheduler` dans les tests |
| `MerchantCatalog` | marchands fictifs | `StaticMerchantCatalog` (JSON) |

## Commandes et events

- Commandes : `StartSimulation`, `StopSimulation`, `TickSimulation` (interne).
- Events : `SimulationStarted`, `SimulationStopped`, `SimulationCompleted`.
- Au redémarrage de l'API, une simulation `RUNNING` est passée à `STOPPED` (pas de reprise automatique).
