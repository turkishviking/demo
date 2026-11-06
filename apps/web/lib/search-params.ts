type SearchParams = Record<string, string | string[] | undefined>;

/** Premier valeur d'un paramètre d'URL (`?q=a&q=b` → `a`), vide → `undefined`. */
export function param(params: SearchParams, name: string): string | undefined {
  const value = params[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : undefined;
}

/** Valeur d'un paramètre limitée à une liste connue. */
export function oneOf<T extends string>(
  params: SearchParams,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const value = param(params, name);
  return allowed.find((candidate) => candidate === value);
}
