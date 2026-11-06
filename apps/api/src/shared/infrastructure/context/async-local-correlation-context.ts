import { AsyncLocalStorage } from 'node:async_hooks';
import type { Correlation, CorrelationContext } from '../../application/correlation.port';

export class AsyncLocalCorrelationContext implements CorrelationContext {
  private readonly storage = new AsyncLocalStorage<Correlation>();

  current(): Correlation | undefined {
    return this.storage.getStore();
  }

  run<T>(correlation: Correlation, work: () => T): T {
    return this.storage.run(correlation, work);
  }
}
