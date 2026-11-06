import { ConcurrencyError } from '../../../shared/application/concurrency-error';
import type { EventEnvelopeFactory } from '../../../shared/application/event-envelope';
import type { EventPublisher } from '../../../shared/application/event-publisher.port';
import { isUniqueViolation } from '../../../shared/infrastructure/database/pg-errors';
import { sql } from '../../../shared/infrastructure/database/sql';
import type { TransactionContext } from '../../../shared/infrastructure/database/transaction-context';
import type { PersonLookup } from '../../application/ports/person-lookup.port';
import { EmailAlreadyUsedError } from '../../domain/errors/cardholders.errors';
import { Email } from '../../domain/person/email.vo';
import { FullName } from '../../domain/person/full-name.vo';
import { Person, type PersonStatus } from '../../domain/person/person.aggregate';
import { PersonId } from '../../domain/person/person-id';
import type { PersonRepository } from '../../domain/person/person.repository';

interface PersonRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: PersonStatus;
  registered_at: Date;
  version: number;
}

const toDomain = (row: PersonRow): Person =>
  Person.restore(
    {
      id: PersonId.from(row.id),
      fullName: FullName.create(row.first_name, row.last_name),
      email: Email.create(row.email),
      status: row.status,
      registeredAt: row.registered_at,
    },
    row.version,
  );

/** Persistance de `Person` en SQL explicite (ADR-0003). */
export class TypeormPersonRepository implements PersonRepository {
  constructor(
    private readonly transactions: TransactionContext,
    private readonly envelopes: EventEnvelopeFactory,
    private readonly publisher: EventPublisher,
  ) {}

  async findById(id: PersonId): Promise<Person | null> {
    const { rows } = await sql<PersonRow>(
      this.transactions.current(),
      `SELECT id, first_name, last_name, email, status, registered_at, version
         FROM cardholders.persons WHERE id = $1`,
      [id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async save(person: Person): Promise<void> {
    const manager = this.transactions.requireTransactional();
    const expectedVersion = person.version;
    const { envelopes, nextVersion } = this.envelopes.pullFrom(person);
    const values = [
      person.id,
      person.fullName.firstName,
      person.fullName.lastName,
      person.email.value,
      person.status,
      person.registeredAt,
      nextVersion,
    ];

    try {
      if (person.isNew) {
        await sql(
          manager,
          `INSERT INTO cardholders.persons
             (id, first_name, last_name, email, status, registered_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          values,
        );
      } else {
        const { rowCount } = await sql(
          manager,
          `UPDATE cardholders.persons
              SET first_name = $2, last_name = $3, email = $4, status = $5, registered_at = $6,
                  version = $7
            WHERE id = $1 AND version = $8`,
          [...values, expectedVersion],
        );
        if (rowCount === 0) throw new ConcurrencyError('Person', person.id, expectedVersion);
      }
    } catch (error) {
      if (isUniqueViolation(error, 'persons_email_unique')) {
        throw new EmailAlreadyUsedError(person.email.value);
      }
      throw error;
    }

    await this.publisher.publish(envelopes);
    person.markPersisted(nextVersion);
  }
}

export class SqlPersonLookup implements PersonLookup {
  constructor(private readonly transactions: TransactionContext) {}

  async statusOf(id: PersonId): Promise<PersonStatus | null> {
    const { rows } = await sql<{ status: PersonStatus }>(
      this.transactions.current(),
      `SELECT status FROM cardholders.persons WHERE id = $1`,
      [id],
    );
    return rows[0]?.status ?? null;
  }

  async isEmailTaken(email: Email): Promise<boolean> {
    const { rows } = await sql(
      this.transactions.current(),
      `SELECT 1 FROM cardholders.persons WHERE email = $1`,
      [email.value],
    );
    return rows.length > 0;
  }
}
