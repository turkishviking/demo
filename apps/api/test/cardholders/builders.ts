import {
  Email,
  FullName,
  Group,
  GroupCapacity,
  GroupId,
  GroupName,
  Person,
  PersonId,
  type Membership,
} from '../../src/cardholders/domain';

const AT = new Date('2026-01-01T10:00:00.000Z');
let sequence = 0;
const nextId = (prefix: string) =>
  `00000000-0000-7000-${prefix}-${(++sequence).toString(16).padStart(12, '0')}`;

/** Builder de `Person` : `aPerson().named('Ada', 'Lovelace').deactivated().build()`. */
export function aPerson() {
  let id = nextId('a000');
  let first = 'Ada';
  let last = 'Lovelace';
  let email = `ada.${sequence}@example.com`;
  let deactivated = false;
  let persisted = true;

  const builder = {
    withId(value: string) {
      id = value;
      return builder;
    },
    named(firstName: string, lastName: string) {
      first = firstName;
      last = lastName;
      return builder;
    },
    withEmail(value: string) {
      email = value;
      return builder;
    },
    deactivated() {
      deactivated = true;
      return builder;
    },
    /** Agrégat neuf (version 0, event `PersonRegistered` en attente). */
    unsaved() {
      persisted = false;
      return builder;
    },
    build(): Person {
      const props = {
        id: PersonId.from(id),
        fullName: FullName.create(first, last),
        email: Email.create(email),
        registeredAt: AT,
      };
      if (!persisted) return Person.register(props);
      return Person.restore({ ...props, status: deactivated ? 'DEACTIVATED' : 'ACTIVE' }, 1);
    },
  };
  return builder;
}

/** Builder de `Group` : `aGroup().withCapacity(2).withMembers(p1, p2).build()`. */
export function aGroup() {
  let id = nextId('b000');
  let name = `Group ${sequence}`;
  let capacity = 10;
  let members: Membership[] = [];
  let archived = false;
  let persisted = true;

  const builder = {
    withId(value: string) {
      id = value;
      return builder;
    },
    named(value: string) {
      name = value;
      return builder;
    },
    withCapacity(value: number) {
      capacity = value;
      return builder;
    },
    withMembers(...personIds: string[]) {
      members = personIds.map((p) => ({ personId: PersonId.from(p), joinedAt: AT }));
      return builder;
    },
    archived() {
      archived = true;
      return builder;
    },
    unsaved() {
      persisted = false;
      return builder;
    },
    build(): Group {
      const props = {
        id: GroupId.from(id),
        name: GroupName.create(name),
        capacity: GroupCapacity.create(capacity),
      };
      if (!persisted) return Group.create(props);
      return Group.restore({ ...props, status: archived ? 'ARCHIVED' : 'ACTIVE', members }, 1);
    },
  };
  return builder;
}

export const somePersonId = () => PersonId.from(nextId('c000'));
