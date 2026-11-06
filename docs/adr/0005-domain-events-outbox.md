# ADR-0005 — Domain events via transactional outbox

- **Statut** : accepté
- **Date** : 2026-11-06

## Contexte
Les contexts communiquent par events. Publier « après commit » en mémoire fait perdre des events en cas de crash, et publier « avant commit » produit des events fantômes.

## Décision
- Les events sont écrits dans `shared.outbox` **dans la même transaction** que l'agrégat.
- Un `OutboxRelay` (réveillé par `LISTEN/NOTIFY`, avec polling de secours) les dispatche sur un bus in-process.
- Les consommateurs sont **idempotents** grâce à une table `shared.inbox (subscriber, event_id)`.
- Livraison at-least-once, ordre garanti par agrégat, retry avec backoff, puis dead letter.
- Le module `@nestjs/cqrs` n'est **pas** utilisé : nos bus sont de petites implémentations derrière des ports. Le comportement reste explicite et le domaine reste indépendant.

## Alternatives considérées
- `EventEmitter2` ou `@nestjs/cqrs` EventBus sans outbox : pas de garantie de livraison.
- Broker (RabbitMQ, Kafka) dès maintenant : surdimensionné. Le port `EventPublisher` permettra la bascule plus tard.

## Conséquences
- Une infrastructure de messaging à maintenir et à tester (tests d'intégration dédiés).
- L'outbox conservée sert aussi de journal, ce qui permet de reconstruire les projections.
