import type { Clock } from '../../src/shared/application/clock.port';

export class FixedClock implements Clock {
  constructor(private readonly instant: Date = new Date('2026-01-01T10:00:00.000Z')) {}

  now(): Date {
    return new Date(this.instant);
  }
}

/** Horloge pilotée par le test : `advance(ms)` remplace tout `sleep`. */
export class ControllableClock implements Clock {
  private current: Date;

  constructor(start: Date = new Date('2026-01-01T10:00:00.000Z')) {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(instant: Date): void {
    this.current = new Date(instant);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
