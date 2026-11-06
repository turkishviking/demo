import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Tables write du context Cardholders (docs/04-architecture/persistence.md). */
export class Cardholders1762500000000 implements MigrationInterface {
  name = 'Cardholders1762500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE cardholders.persons (
        id            uuid        PRIMARY KEY,
        first_name    text        NOT NULL,
        last_name     text        NOT NULL,
        email         text        NOT NULL,
        status        text        NOT NULL CHECK (status IN ('ACTIVE', 'DEACTIVATED')),
        registered_at timestamptz NOT NULL,
        version       integer     NOT NULL,
        CONSTRAINT persons_email_unique UNIQUE (email)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE cardholders.groups (
        id          uuid    PRIMARY KEY,
        name        text    NOT NULL,
        max_members integer NOT NULL CHECK (max_members BETWEEN 1 AND 50),
        status      text    NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED')),
        version     integer NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX groups_name_unique ON cardholders.groups (lower(name))`,
    );
    // « Une personne appartient à au plus un groupe » : garanti par UNIQUE (person_id).
    await queryRunner.query(`
      CREATE TABLE cardholders.group_members (
        group_id  uuid        NOT NULL REFERENCES cardholders.groups (id) ON DELETE CASCADE,
        person_id uuid        NOT NULL REFERENCES cardholders.persons (id),
        joined_at timestamptz NOT NULL,
        PRIMARY KEY (group_id, person_id),
        CONSTRAINT group_members_person_unique UNIQUE (person_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cardholders.group_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS cardholders.groups`);
    await queryRunner.query(`DROP TABLE IF EXISTS cardholders.persons`);
  }
}
