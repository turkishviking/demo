export interface HealthDto {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

export interface OutboxHealthDto {
  pending: number;
  deadLetter: number;
}
