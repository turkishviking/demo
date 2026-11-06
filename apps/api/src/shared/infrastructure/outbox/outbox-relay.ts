import type { DataSource } from 'typeorm';
import type { Clock } from '../../application/clock.port';
import type { EventBus } from '../../application/event-bus';
import type { EventEnvelope } from '../../application/event-envelope';
import { sql } from '../database/sql';

export interface OutboxRelayOptions {
  batchSize: number;
  maxAttempts: number;
  /** Délai de base du backoff exponentiel. */
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
}

export interface RelayLogger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

interface OutboxRow {
  event_id: string;
  type: string;
  version: number;
  aggregate_id: string;
  aggregate_version: number;
  payload: unknown;
  correlation_id: string;
  causation_id: string | null;
  occurred_at: Date;
  attempts: number;
}

export interface BatchResult {
  /** Events sélectionnés dans ce lot. */
  selected: number;
  dispatched: number;
  failed: number;
}

/**
 * Transporte les events de l'outbox vers le bus. Aucune logique métier ici.
 *
 * Garanties :
 * - at-least-once (les abonnés dédupliquent via l'inbox) ;
 * - ordre par agrégat : un event n'est livré que si tous les précédents du même agrégat
 *   l'ont été (un event en échec, ou en dead letter, bloque la suite de son agrégat) ;
 * - plusieurs relais peuvent tourner en parallèle (`FOR UPDATE SKIP LOCKED`) ; c'est pourquoi
 *   un lot ne contient qu'un event par agrégat, `drain()` enchaînant les lots.
 *
 * Les abonnés s'exécutent dans leurs propres transactions, pas dans celle du relais.
 */
export class OutboxRelay {
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly options: OutboxRelayOptions,
    private readonly logger?: RelayLogger,
  ) {
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 500;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 60_000;
  }

  async processBatch(): Promise<BatchResult> {
    return this.dataSource.transaction(async (manager) => {
      const now = this.clock.now();
      const { rows } = await sql<OutboxRow>(
        manager,
        `SELECT o.event_id, o.type, o.version, o.aggregate_id, o.aggregate_version, o.payload,
                o.correlation_id, o.causation_id, o.occurred_at, o.attempts
           FROM shared.outbox o
          WHERE o.dispatched_at IS NULL
            AND o.attempts < $1
            AND o.next_attempt_at <= $2
            AND NOT EXISTS (
              SELECT 1 FROM shared.outbox p
               WHERE p.aggregate_id = o.aggregate_id
                 AND p.dispatched_at IS NULL
                 AND p.position < o.position)
          ORDER BY o.position
          LIMIT $3
          FOR UPDATE SKIP LOCKED`,
        [this.options.maxAttempts, now, this.options.batchSize],
      );

      const result: BatchResult = { selected: rows.length, dispatched: 0, failed: 0 };
      const blockedAggregates = new Set<string>();

      for (const row of rows) {
        if (blockedAggregates.has(row.aggregate_id)) continue;
        try {
          await this.bus.dispatch(toEnvelope(row));
          await sql(manager, `UPDATE shared.outbox SET dispatched_at = $2 WHERE event_id = $1`, [
            row.event_id,
            this.clock.now(),
          ]);
          result.dispatched++;
        } catch (error) {
          blockedAggregates.add(row.aggregate_id);
          result.failed++;
          await this.recordFailure(manager, row, error);
        }
      }
      return result;
    });
  }

  /** Traite les lots tant que des events sont livrés. Renvoie le nombre total livré. */
  async drain(maxBatches = 1000): Promise<number> {
    let total = 0;
    for (let i = 0; i < maxBatches; i++) {
      const { dispatched } = await this.processBatch();
      if (dispatched === 0) break;
      total += dispatched;
    }
    return total;
  }

  retryDelayMs(attempts: number): number {
    return Math.min(this.baseRetryDelayMs * 2 ** (attempts - 1), this.maxRetryDelayMs);
  }

  private async recordFailure(
    manager: Parameters<typeof sql>[0],
    row: OutboxRow,
    error: unknown,
  ): Promise<void> {
    const attempts = row.attempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    const nextAttemptAt = new Date(this.clock.now().getTime() + this.retryDelayMs(attempts));
    await sql(
      manager,
      `UPDATE shared.outbox SET attempts = $2, next_attempt_at = $3, last_error = $4 WHERE event_id = $1`,
      [row.event_id, attempts, nextAttemptAt, message.slice(0, 2000)],
    );

    const context = { eventId: row.event_id, type: row.type, attempts, error: message };
    if (attempts >= this.options.maxAttempts) {
      this.logger?.error('Outbox event moved to dead letter', context);
    } else {
      this.logger?.warn('Outbox event dispatch failed, will retry', context);
    }
  }
}

function toEnvelope(row: OutboxRow): EventEnvelope {
  return {
    eventId: row.event_id,
    type: row.type,
    version: row.version,
    aggregateId: row.aggregate_id,
    aggregateVersion: row.aggregate_version,
    occurredAt: new Date(row.occurred_at).toISOString(),
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload: row.payload,
  };
}
