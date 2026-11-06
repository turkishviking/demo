export interface DatabaseHealthProbe {
  isUp(): Promise<boolean>;
}

export const DATABASE_HEALTH_PROBE = Symbol('DatabaseHealthProbe');

export interface OutboxStats {
  /** Events pas encore livrés et encore rejouables. */
  pending: number;
  /** Events abandonnés après le nombre maximum de tentatives. */
  deadLetter: number;
}

export interface OutboxStatsReader {
  read(): Promise<OutboxStats>;
}

export const OUTBOX_STATS_READER = Symbol('OutboxStatsReader');
