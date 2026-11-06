import type { DomainEvent } from './domain-event';
import { Entity } from './entity';

/**
 * Racine d'agrégat : frontière de cohérence et unité de persistance.
 *
 * - `version` sert au verrou optimiste : 0 = jamais persisté.
 * - Les events sont enregistrés via `record()` puis récupérés par le repository
 *   avec `pullEvents()` au moment du `save`, dans la même transaction.
 */
export abstract class AggregateRoot<TId extends string> extends Entity<TId> {
  private _version: number;
  private _pendingEvents: DomainEvent[] = [];

  protected constructor(id: TId, version: number) {
    super(id);
    if (!Number.isInteger(version) || version < 0) {
      throw new RangeError(`Invalid aggregate version: ${version}`);
    }
    this._version = version;
  }

  /** Version persistée (celle chargée depuis la base, ou 0 pour un nouvel agrégat). */
  get version(): number {
    return this._version;
  }

  get isNew(): boolean {
    return this._version === 0;
  }

  get pendingEvents(): readonly DomainEvent[] {
    return this._pendingEvents;
  }

  protected record(event: DomainEvent): void {
    this._pendingEvents.push(event);
  }

  /** Retire et renvoie les events en attente. Appelé une seule fois par `save`. */
  pullEvents(): DomainEvent[] {
    const events = this._pendingEvents;
    this._pendingEvents = [];
    return events;
  }

  /** Appelé par le repository après un save réussi. */
  markPersisted(version: number): void {
    if (version <= this._version) {
      throw new RangeError(`Version must increase (current ${this._version}, got ${version})`);
    }
    this._version = version;
  }
}
