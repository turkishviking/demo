# Context Cardholders

Gère les personnes et leur regroupement.

## Agrégat `Person`

| Attribut | Type | Notes |
|---|---|---|
| `id` | `PersonId` (UUID v7) | |
| `fullName` | `FullName` (VO) | prénom et nom, 1 à 100 caractères chacun, trimés |
| `email` | `Email` (VO) | format valide, unique (contrainte DB + vérification applicative) |
| `status` | `ACTIVE \| DEACTIVATED` | |
| `registeredAt` | `Date` | |
| `version` | `number` | verrou optimiste |

**Invariants**
- P1 : une personne `DEACTIVATED` ne peut être ni modifiée ni réactivée (choix de simplicité pour la démo).
- P2 : l'email est valide. Son unicité est garantie par une contrainte unique en DB, qui remonte une `EmailAlreadyUsedError`.

**Comportements** : `Person.register(...)`, `rename(fullName)`, `deactivate()`.

**Events** : `PersonRegistered`, `PersonRenamed`, `PersonDeactivated`.

## Agrégat `Group`

L'appartenance appartient à `Group` : c'est lui qui porte les invariants de taille et d'archivage.

| Attribut | Type | Notes |
|---|---|---|
| `id` | `GroupId` | |
| `name` | `GroupName` (VO) | 2 à 60 caractères, unique |
| `memberIds` | `Set<PersonId>` | |
| `maxMembers` | `number` | 10 par défaut, entre 1 et 50 |
| `status` | `ACTIVE \| ARCHIVED` | |
| `version` | `number` | |

**Invariants**
- G1 : `memberIds.size ≤ maxMembers`.
- G2 : pas de doublon de membre.
- G3 : un groupe `ARCHIVED` n'accepte aucune modification.
- G4 : un groupe ne peut être archivé que s'il n'a plus de membres.
- G5 : on ne peut pas baisser `maxMembers` sous le nombre de membres actuel.

**Règle inter-agrégats** (« une personne appartient à au plus un groupe »)
- Elle porte sur plusieurs `Group`. On ne la met pas dans un agrégat, on l'applique :
  1. côté application, via le port `GroupMembershipLookup.findGroupOf(personId)` avant `group.addMember()` ;
  2. côté DB, via une contrainte `UNIQUE(person_id)` sur `cardholders.group_members`, qui protège des courses.
- Un changement de groupe se fait en deux commandes (`RemoveMember` puis `AddMember`). On ne crée pas de commande « move » qui modifierait deux agrégats dans la même transaction.
- La personne ajoutée doit exister et être `ACTIVE`. C'est vérifié par le port `PersonLookup`, dans le même context, en lecture.

**Comportements** : `Group.create(name, maxMembers)`, `rename`, `addMember(personId)`, `removeMember(personId)`, `changeCapacity(n)`, `archive()`.

**Events** : `GroupCreated`, `GroupRenamed`, `PersonJoinedGroup`, `PersonLeftGroup`, `GroupArchived`.

## Réactions aux events

| Event reçu | Réaction |
|---|---|
| `PersonDeactivated` (interne) | Policy `RemoveDeactivatedPersonFromGroup` : commande `RemoveMember` si la personne a un groupe. |

## Commandes

`RegisterPerson`, `RenamePerson`, `DeactivatePerson`, `CreateGroup`, `RenameGroup`, `AddMember`, `RemoveMember`, `ChangeGroupCapacity`, `ArchiveGroup`.

## Erreurs métier

`PersonNotFound`, `PersonDeactivated`, `EmailAlreadyUsed`, `GroupNotFound`, `GroupArchived`, `GroupFull`, `PersonAlreadyInAGroup`, `PersonNotMember`, `GroupNotEmpty`, `CapacityBelowMemberCount`.
