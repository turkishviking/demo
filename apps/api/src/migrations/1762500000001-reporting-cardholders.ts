import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Read models de Reporting alimentés par les events de Cardholders (docs/04-architecture/cqrs.md). */
export class ReportingCardholders1762500000001 implements MigrationInterface {
  name = 'ReportingCardholders1762500000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE reporting.rm_groups (
        id           uuid        PRIMARY KEY,
        name         text        NOT NULL,
        max_members  integer     NOT NULL,
        member_count integer     NOT NULL DEFAULT 0,
        status       text        NOT NULL DEFAULT 'ACTIVE',
        created_at   timestamptz NOT NULL,
        version      integer     NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX rm_groups_created_idx ON reporting.rm_groups (created_at DESC, id DESC)`,
    );

    // Pas de clé étrangère : les read models sont des copies dénormalisées.
    await queryRunner.query(`
      CREATE TABLE reporting.rm_people (
        id            uuid        PRIMARY KEY,
        first_name    text        NOT NULL,
        last_name     text        NOT NULL,
        email         text        NOT NULL,
        status        text        NOT NULL DEFAULT 'ACTIVE',
        registered_at timestamptz NOT NULL,
        group_id      uuid        NULL,
        group_name    text        NULL,
        version       integer     NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX rm_people_registered_idx ON reporting.rm_people (registered_at DESC, id DESC)`,
    );
    await queryRunner.query(`CREATE INDEX rm_people_group_idx ON reporting.rm_people (group_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS reporting.rm_people`);
    await queryRunner.query(`DROP TABLE IF EXISTS reporting.rm_groups`);
  }
}
