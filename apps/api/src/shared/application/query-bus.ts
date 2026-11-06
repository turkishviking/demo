/** Intention de lecture. Une query ne charge jamais d'agrégat : elle lit un read model. */
export abstract class Query<TResult> {
  declare private readonly __result?: TResult;
}

export interface QueryHandler<TQuery extends Query<TResult>, TResult> {
  execute(query: TQuery): Promise<TResult>;
}

type QueryClass<TQuery extends Query<unknown>> = abstract new (...args: never[]) => TQuery;

export interface QueryBus {
  execute<TResult>(query: Query<TResult>): Promise<TResult>;
}

export const QUERY_BUS = Symbol('QueryBus');

export class QueryHandlerNotFoundError extends Error {
  constructor(queryName: string) {
    super(`No handler registered for query ${queryName}`);
    this.name = 'QueryHandlerNotFoundError';
  }
}

export class SimpleQueryBus implements QueryBus {
  private readonly handlers = new Map<
    QueryClass<Query<unknown>>,
    QueryHandler<Query<unknown>, unknown>
  >();

  register<TQuery extends Query<TResult>, TResult>(
    queryClass: QueryClass<TQuery>,
    handler: QueryHandler<TQuery, TResult>,
  ): void {
    if (this.handlers.has(queryClass)) {
      throw new Error(`Handler already registered for query ${queryClass.name}`);
    }
    this.handlers.set(queryClass, handler as QueryHandler<Query<unknown>, unknown>);
  }

  async execute<TResult>(query: Query<TResult>): Promise<TResult> {
    const handler = this.handlers.get(query.constructor as QueryClass<Query<unknown>>);
    if (!handler) throw new QueryHandlerNotFoundError(query.constructor.name);
    return (await handler.execute(query)) as TResult;
  }
}
