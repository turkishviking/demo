import type { Clock } from '../../../shared/application/clock.port';
import type { CommandHandler } from '../../../shared/application/command-bus';
import type { IdGenerator } from '../../../shared/application/id-generator.port';
import type { UnitOfWork } from '../../../shared/application/unit-of-work.port';
import { EmailAlreadyUsedError, PersonNotFoundError } from '../../domain/errors/cardholders.errors';
import { Email } from '../../domain/person/email.vo';
import { FullName } from '../../domain/person/full-name.vo';
import { Person } from '../../domain/person/person.aggregate';
import { PersonId } from '../../domain/person/person-id';
import type { PersonRepository } from '../../domain/person/person.repository';
import type { PersonLookup } from '../ports/person-lookup.port';
import type {
  DeactivatePersonCommand,
  RegisterPersonCommand,
  RenamePersonCommand,
} from './person.commands';

async function loadPerson(persons: PersonRepository, personId: string): Promise<Person> {
  const person = await persons.findById(PersonId.from(personId));
  if (!person) throw new PersonNotFoundError(personId);
  return person;
}

/** US-CH-1 : enregistrer une personne (email unique, P2). */
export class RegisterPersonHandler implements CommandHandler<RegisterPersonCommand> {
  constructor(
    private readonly persons: PersonRepository,
    private readonly lookup: PersonLookup,
    private readonly uow: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: RegisterPersonCommand): Promise<{ id: string }> {
    const fullName = FullName.create(command.firstName, command.lastName);
    const email = Email.create(command.email);

    return this.uow.run(async () => {
      // Vérification applicative ; la contrainte unique en base couvre les courses.
      if (await this.lookup.isEmailTaken(email)) throw new EmailAlreadyUsedError(email.value);
      const person = Person.register({
        id: PersonId.from(this.ids.next()),
        fullName,
        email,
        registeredAt: this.clock.now(),
      });
      await this.persons.save(person);
      return { id: person.id };
    });
  }
}

export class RenamePersonHandler implements CommandHandler<RenamePersonCommand> {
  constructor(
    private readonly persons: PersonRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(command: RenamePersonCommand): Promise<void> {
    const fullName = FullName.create(command.firstName, command.lastName);
    await this.uow.run(async () => {
      const person = await loadPerson(this.persons, command.personId);
      person.rename(fullName);
      if (person.pendingEvents.length > 0) await this.persons.save(person);
    });
  }
}

/** US-CH-2 CA1. Le retrait du groupe (CA3) est fait par une policy, en asynchrone. */
export class DeactivatePersonHandler implements CommandHandler<DeactivatePersonCommand> {
  constructor(
    private readonly persons: PersonRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(command: DeactivatePersonCommand): Promise<void> {
    await this.uow.run(async () => {
      const person = await loadPerson(this.persons, command.personId);
      person.deactivate();
      await this.persons.save(person);
    });
  }
}
