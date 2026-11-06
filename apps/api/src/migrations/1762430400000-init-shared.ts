import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Schémas des bounded contexts + outbox / inbox (docs/04-architecture/events-and-messaging.md). */
export class InitShared1762430400000 implements MigrationInterface {
  name = 'InitShared1762430400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const schema of [
      'shared',
      'cardholders',
      'cards',
      'transactions',
      'simulation',
      'reporting',
    ]) {
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    }

    await queryRunner.query(`
      CREATE TABLE shared.outbox (
        position          bigserial    NOT NULL UNIQUE,
        event_id          uuid         PRIMARY KEY,
        type              text         NOT NULL,
        version           integer      NOT NULL,
        aggregate_id      uuid         NOT NULL,
        aggregate_version integer      NOT NULL,
        payload           jsonb        NOT NULL,
        correlation_id    text         NOT NULL,
        causation_id      text         NULL,
        occurred_at       timestamptz  NOT NULL,
        dispatched_at     timestamptz  NULL,
        attempts          integer      NOT NULL DEFAULT 0,
        next_attempt_at   timestamptz  NOT NULL DEFAULT now(),
        last_error        text         NULL,
        CONSTRAINT outbox_aggregate_version_unique UNIQUE (aggregate_id, aggregate_version)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX outbox_undispatched_idx ON shared.outbox (position) WHERE dispatched_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX outbox_aggregate_position_idx ON shared.outbox (aggregate_id, position)`,
    );

    await queryRunner.query(`
      CREATE TABLE shared.inbox (
        subscriber   text        NOT NULL,
        event_id     uuid        NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (subscriber, event_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS shared.inbox`);
    await queryRunner.query(`DROP TABLE IF EXISTS shared.outbox`);
    for (const schema of [
      'reporting',
      'simulation',
      'transactions',
      'cards',
      'cardholders',
      'shared',
    ]) {
      await queryRunner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  }
}
