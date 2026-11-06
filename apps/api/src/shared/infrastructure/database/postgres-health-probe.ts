import type { DataSource } from 'typeorm';
import type { DatabaseHealthProbe } from '../../application/health.port';

export class PostgresHealthProbe implements DatabaseHealthProbe {
  constructor(private readonly dataSource: DataSource) {}

  async isUp(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
