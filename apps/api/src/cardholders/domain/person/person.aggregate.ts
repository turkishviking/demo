import {
  CardholdersEventTypes,
  type PersonDeactivatedV1,
  type PersonRegisteredV1,
  type PersonRenamedV1,
} from '../../contracts/cardholders.events';
import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { PersonDeactivatedError } from '../errors/cardholders.errors';
import type { Email } from './email.vo';
import type { FullName } from './full-name.vo';
import type { PersonId } from './person-id';

export type PersonStatus = 'ACTIVE' | 'DEACTIVATED';

export interface RegisterPersonProps {
  id: PersonId;
  fullName: FullName;
  email: Email;
  registeredAt: Date;
}

export interface PersonSnapshot extends RegisterPersonProps {
  status: PersonStatus;
}

/**
 * Personne pouvant être titulaire de cartes.
 * P1 : une personne désactivée ne peut être ni modifiée ni réactivée.
 * P2 (unicité de l'email) est garantie hors de l'agrégat (lookup + contrainte DB).
 */
export class Person extends AggregateRoot<PersonId> {
  private constructor(
    id: PersonId,
    version: number,
    private _fullName: FullName,
    private readonly _email: Email,
    private _status: PersonStatus,
    private readonly _registeredAt: Date,
  ) {
    super(id, version);
  }

  static register(props: RegisterPersonProps): Person {
    const person = new Person(
      props.id,
      0,
      props.fullName,
      props.email,
      'ACTIVE',
      new Date(props.registeredAt),
    );
    person.record({
      type: CardholdersEventTypes.PersonRegistered,
      version: 1,
      payload: {
        personId: props.id,
        firstName: props.fullName.firstName,
        lastName: props.fullName.lastName,
        email: props.email.value,
        registeredAt: props.registeredAt.toISOString(),
      } satisfies PersonRegisteredV1,
    });
    return person;
  }

  /** Reconstruction depuis la persistance : ni validation de création, ni event. */
  static restore(snapshot: PersonSnapshot, version: number): Person {
    return new Person(
      snapshot.id,
      version,
      snapshot.fullName,
      snapshot.email,
      snapshot.status,
      new Date(snapshot.registeredAt),
    );
  }

  get fullName(): FullName {
    return this._fullName;
  }

  get email(): Email {
    return this._email;
  }

  get status(): PersonStatus {
    return this._status;
  }

  get isActive(): boolean {
    return this._status === 'ACTIVE';
  }

  get registeredAt(): Date {
    return new Date(this._registeredAt);
  }

  snapshot(): PersonSnapshot {
    return {
      id: this.id,
      fullName: this._fullName,
      email: this._email,
      status: this._status,
      registeredAt: this.registeredAt,
    };
  }

  /** Sans effet si le nom ne change pas. */
  rename(fullName: FullName): void {
    this.ensureActive();
    if (fullName.equals(this._fullName)) return;
    this._fullName = fullName;
    this.record({
      type: CardholdersEventTypes.PersonRenamed,
      version: 1,
      payload: {
        personId: this.id,
        firstName: fullName.firstName,
        lastName: fullName.lastName,
      } satisfies PersonRenamedV1,
    });
  }

  deactivate(): void {
    this.ensureActive();
    this._status = 'DEACTIVATED';
    this.record({
      type: CardholdersEventTypes.PersonDeactivated,
      version: 1,
      payload: {
        personId: this.id,
      } satisfies PersonDeactivatedV1,
    });
  }

  private ensureActive(): void {
    if (!this.isActive) throw new PersonDeactivatedError(this.id);
  }
}
