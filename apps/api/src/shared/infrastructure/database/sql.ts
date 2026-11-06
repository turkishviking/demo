import type { EntityManager } from 'typeorm';

export interface SqlResult<TRow> {
  rows: TRow[];
  rowCount: number;
}

/**
 * Exécute une requête SQL paramétrée et renvoie lignes + nombre de lignes affectées,
 * quel que soit le type de requête (TypeORM renvoie des formes différentes sinon).
 */
export async function sql<TRow = Record<string, unknown>>(
  manager: EntityManager,
  query: string,
  parameters: unknown[] = [],
): Promise<SqlResult<TRow>> {
  const ownRunner = manager.queryRunner === undefined;
  const runner = manager.queryRunner ?? manager.connection.createQueryRunner();
  try {
    const result = await runner.query(query, parameters, true);
    return { rows: (result.records ?? []) as TRow[], rowCount: result.affected ?? 0 };
  } finally {
    if (ownRunner) await runner.release();
  }
}
