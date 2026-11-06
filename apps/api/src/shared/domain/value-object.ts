type Primitive = string | number | boolean | bigint | null | undefined;

/**
 * Value object immuable comparé par valeur. Les sous-classes gardent un constructeur
 * privé et exposent une factory `create()` qui valide.
 */
export abstract class ValueObject<TProps extends Record<string, Primitive>> {
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  equals(other: ValueObject<TProps> | null | undefined): boolean {
    if (!other) return false;
    if (other.constructor !== this.constructor) return false;
    const keys = Object.keys(this.props);
    if (keys.length !== Object.keys(other.props).length) return false;
    return keys.every((key) => this.props[key] === other.props[key]);
  }
}
