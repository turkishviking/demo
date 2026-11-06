/** Type nominal : empêche de passer un `CardId` là où un `PersonId` est attendu. */
export type Brand<T, B extends string> = T & { readonly __brand: B };
