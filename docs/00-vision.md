# 00 — Vision

## Objectif

CardSim est une **vitrine technique**. Elle doit montrer, sur un domaine simple mais réaliste, comment on structure une application avec :

- une architecture **Clean / hexagonale** dont le domaine ne dépend d'aucun framework ;
- une modélisation **DDD** : bounded contexts, agrégats guidés par les invariants, domain events ;
- une séparation **CQRS** entre lecture et écriture ;
- une **pyramide de tests** complète, avec une couverture élevée ;
- un front **Next.js 16 / React 19** orienté server components.

Le métier sert de support. La qualité du code, des frontières et des tests compte plus que l'étendue fonctionnelle.

## Persona

**L'opérateur** est l'utilisateur unique de l'application. Il n'a **pas à se connecter** : à l'ouverture de l'app, il arrive directement sur le dashboard. Il :
- gère les groupes, les personnes et les cartes ;
- lance et arrête des simulations de transactions ;
- consulte les transactions et des indicateurs agrégés (par carte, personne, groupe, période, catégorie) ;
- peut bloquer une carte ou rembourser une transaction.

Les **personnes** (titulaires de cartes) ne se connectent pas : ce sont des données métier.

## Périmètre

**Inclus**
- CRUD métier des groupes, personnes et cartes, avec leurs règles (statuts, plafonds, appartenance).
- Cycle de vie d'une transaction : demande, autorisation ou refus, règlement, remboursement.
- Simulation paramétrable (scénario, cadence, graine aléatoire), avec un suivi en direct.
- Dashboard et listes filtrables (côté lecture).

**Hors périmètre**
- Authentification, sessions, multi-utilisateur, rôles : l'app est ouverte ([ADR-0006](adr/0006-no-authentication.md)).
- Vraie connexion à un réseau de paiement, PCI-DSS, chiffrement des PAN (on stocke uniquement un PAN masqué et fictif).
- Multi-devise réelle et conversion : une devise unique, EUR (le value object `Money` porte quand même la devise).
- Facturation, relevés, intérêts.
- Haute disponibilité et scalabilité.

## Critères de réussite de la démo

1. `domain/` compile et se teste sans NestJS ni TypeORM.
2. Chaque invariant listé dans `02-domain/` est couvert par un test unitaire.
3. Le scénario « personne désactivée → cartes bloquées → transactions refusées » fonctionne de bout en bout grâce aux events, sans couplage direct entre les contexts.
4. Couverture ≥ 90 % sur `domain` + `application` et ≥ 80 % au global.
5. Le dashboard se charge en server components, sans fetch côté client pour les données initiales.

## Points ouverts

- Plafond de dépense **au niveau du groupe**, en plus de celui de la carte : il demanderait une saga supplémentaire. Reporté.
- Cache côté lecture (Redis ou in-memory) : le port est prévu, l'implémentation viendra plus tard.
- Mises à jour en direct : SSE (choix actuel) ou WebSocket.
- Bus d'events externe (RabbitMQ, NATS) à la place du relais in-process : possible plus tard grâce au port `EventPublisher`.
