import type { IdGenerator } from '../../src/shared/application/id-generator.port';

/** Ids déterministes au format UUID (compatibles avec les colonnes `uuid`). */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = '00000000-0000-7000-8000') {}

  next(): string {
    this.counter++;
    return `${this.prefix}-${this.counter.toString(16).padStart(12, '0')}`;
  }
}
