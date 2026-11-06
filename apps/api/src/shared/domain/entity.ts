export abstract class Entity<TId extends string> {
  protected constructor(readonly id: TId) {}

  equals(other: Entity<TId> | null | undefined): boolean {
    if (!other) return false;
    if (this === other) return true;
    return other.constructor === this.constructor && other.id === this.id;
  }
}
