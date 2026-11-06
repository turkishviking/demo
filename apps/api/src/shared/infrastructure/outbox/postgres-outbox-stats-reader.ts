import type { DataSource } from 'typeorm';
import type { OutboxStats, OutboxStatsReader } from '../../application/health.port';

export class PostgresOutboxStatsReader implements OutboxStatsReader {
  constructor(
    private readonly dataSource: DataSource,
    private readonly maxAttempts: number,
  ) {}

  async read(): Promise<OutboxStats> {
    const rows: Array<{ pending: string; dead_letter: string }> = await this.dataSource.query(
      `SELECT count(*) FILTER (WHERE attempts <  $1) AS pending,
              count(*) FILTER (WHERE attempts >= $1) AS dead_letter
         FROM shared.outbox
        WHERE dispatched_at IS NULL`,
      [this.maxAttempts],
    );
    const row = rows[0];
    return { pending: Number(row?.pending ?? 0), deadLetter: Number(row?.dead_letter ?? 0) };
  }
}
