import {
  CardholdersEventTypes,
  type GroupArchivedV1,
  type GroupCapacityChangedV1,
  type GroupCreatedV1,
  type GroupRenamedV1,
  type PersonJoinedGroupV1,
  type PersonLeftGroupV1,
} from '../../contracts/cardholders.events';
import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  CapacityBelowMemberCountError,
  GroupArchivedError,
  GroupFullError,
  GroupNotEmptyError,
  PersonAlreadyInAGroupError,
  PersonNotMemberError,
} from '../errors/cardholders.errors';
import type { PersonId } from '../person/person-id';
import type { GroupCapacity } from './group-capacity.vo';
import type { GroupId } from './group-id';
import type { GroupName } from './group-name.vo';

export type GroupStatus = 'ACTIVE' | 'ARCHIVED';

export interface Membership {
  readonly personId: PersonId;
  readonly joinedAt: Date;
}

export interface CreateGroupProps {
  id: GroupId;
  name: GroupName;
  capacity: GroupCapacity;
}

export interface GroupSnapshot extends CreateGroupProps {
  status: GroupStatus;
  members: Membership[];
}

/**
 * Groupe de personnes. Il porte l'appartenance, donc les invariants de taille et d'archivage :
 * G1 (taille ≤ capacité), G2 (pas de doublon), G3 (archivé = figé), G4 (archivage d'un groupe
 * vide uniquement), G5 (capacité ≥ nombre de membres).
 * La règle « une personne dans au plus un groupe » porte sur plusieurs groupes : elle est
 * appliquée par la couche application et par une contrainte unique en base.
 */
export class Group extends AggregateRoot<GroupId> {
  private readonly _members: Map<PersonId, Date>;

  private constructor(
    id: GroupId,
    version: number,
    private _name: GroupName,
    private _capacity: GroupCapacity,
    private _status: GroupStatus,
    members: readonly Membership[],
  ) {
    super(id, version);
    this._members = new Map(members.map((m) => [m.personId, new Date(m.joinedAt)]));
  }

  static create(props: CreateGroupProps): Group {
    const group = new Group(props.id, 0, props.name, props.capacity, 'ACTIVE', []);
    group.record({
      type: CardholdersEventTypes.GroupCreated,
      version: 1,
      payload: {
        groupId: props.id,
        name: props.name.value,
        maxMembers: props.capacity.value,
      } satisfies GroupCreatedV1,
    });
    return group;
  }

  /** Reconstruction depuis la persistance : ni validation de création, ni event. */
  static restore(snapshot: GroupSnapshot, version: number): Group {
    return new Group(
      snapshot.id,
      version,
      snapshot.name,
      snapshot.capacity,
      snapshot.status,
      snapshot.members,
    );
  }

  get name(): GroupName {
    return this._name;
  }

  get capacity(): GroupCapacity {
    return this._capacity;
  }

  get status(): GroupStatus {
    return this._status;
  }

  get isArchived(): boolean {
    return this._status === 'ARCHIVED';
  }

  get memberCount(): number {
    return this._members.size;
  }

  get members(): Membership[] {
    return [...this._members].map(([personId, joinedAt]) => ({
      personId,
      joinedAt: new Date(joinedAt),
    }));
  }

  hasMember(personId: PersonId): boolean {
    return this._members.has(personId);
  }

  snapshot(): GroupSnapshot {
    return {
      id: this.id,
      name: this._name,
      capacity: this._capacity,
      status: this._status,
      members: this.members,
    };
  }

  /** Sans effet si le nom ne change pas. */
  rename(name: GroupName): void {
    this.ensureActive();
    if (name.equals(this._name)) return;
    this._name = name;
    this.record({
      type: CardholdersEventTypes.GroupRenamed,
      version: 1,
      payload: { groupId: this.id, name: name.value } satisfies GroupRenamedV1,
    });
  }

  addMember(personId: PersonId, joinedAt: Date): void {
    this.ensureActive();
    if (this._members.has(personId)) throw new PersonAlreadyInAGroupError(personId, this.id);
    if (this._members.size >= this._capacity.value) {
      throw new GroupFullError(this.id, this._capacity.value);
    }
    this._members.set(personId, new Date(joinedAt));
    this.record({
      type: CardholdersEventTypes.PersonJoinedGroup,
      version: 1,
      payload: {
        groupId: this.id,
        personId,
        joinedAt: joinedAt.toISOString(),
      } satisfies PersonJoinedGroupV1,
    });
  }

  removeMember(personId: PersonId): void {
    this.ensureActive();
    if (!this._members.delete(personId)) throw new PersonNotMemberError(this.id, personId);
    this.record({
      type: CardholdersEventTypes.PersonLeftGroup,
      version: 1,
      payload: { groupId: this.id, personId } satisfies PersonLeftGroupV1,
    });
  }

  /** Sans effet si la capacité ne change pas. */
  changeCapacity(capacity: GroupCapacity): void {
    this.ensureActive();
    if (capacity.equals(this._capacity)) return;
    if (capacity.value < this._members.size) {
      throw new CapacityBelowMemberCountError(this.id, capacity.value, this._members.size);
    }
    this._capacity = capacity;
    this.record({
      type: CardholdersEventTypes.GroupCapacityChanged,
      version: 1,
      payload: { groupId: this.id, maxMembers: capacity.value } satisfies GroupCapacityChangedV1,
    });
  }

  archive(): void {
    this.ensureActive();
    if (this._members.size > 0) throw new GroupNotEmptyError(this.id, this._members.size);
    this._status = 'ARCHIVED';
    this.record({
      type: CardholdersEventTypes.GroupArchived,
      version: 1,
      payload: { groupId: this.id } satisfies GroupArchivedV1,
    });
  }

  private ensureActive(): void {
    if (this.isArchived) throw new GroupArchivedError(this.id);
  }
}
