import { DomainError, NotFoundError } from '../../../shared/domain/domain-error';

export class PersonNotFoundError extends NotFoundError {
  readonly code = 'PERSON_NOT_FOUND';
  constructor(personId: string) {
    super(`Person ${personId} not found`, { personId });
  }
}

/** P1 : une personne désactivée ne peut plus être modifiée ni ajoutée à un groupe. */
export class PersonDeactivatedError extends DomainError {
  readonly code = 'PERSON_DEACTIVATED';
  constructor(personId: string) {
    super(`Person ${personId} is deactivated`, { personId });
  }
}

/** P2 : l'email est unique. */
export class EmailAlreadyUsedError extends DomainError {
  readonly code = 'EMAIL_ALREADY_USED';
  constructor(email: string) {
    super(`Email ${email} is already used`, { email });
  }
}

export class GroupNotFoundError extends NotFoundError {
  readonly code = 'GROUP_NOT_FOUND';
  constructor(groupId: string) {
    super(`Group ${groupId} not found`, { groupId });
  }
}

export class GroupNameAlreadyUsedError extends DomainError {
  readonly code = 'GROUP_NAME_ALREADY_USED';
  constructor(name: string) {
    super(`Group name "${name}" is already used`, { name });
  }
}

/** G3 : un groupe archivé n'accepte aucune modification. */
export class GroupArchivedError extends DomainError {
  readonly code = 'GROUP_ARCHIVED';
  constructor(groupId: string) {
    super(`Group ${groupId} is archived`, { groupId });
  }
}

/** G1 : nombre de membres ≤ capacité. */
export class GroupFullError extends DomainError {
  readonly code = 'GROUP_FULL';
  constructor(groupId: string, maxMembers: number) {
    super(`Group ${groupId} already has ${maxMembers} members`, { groupId, maxMembers });
  }
}

/** G2 + règle inter-agrégats : une personne appartient à au plus un groupe. */
export class PersonAlreadyInAGroupError extends DomainError {
  readonly code = 'PERSON_ALREADY_IN_A_GROUP';
  constructor(personId: string, groupId?: string) {
    super(
      `Person ${personId} is already in a group${groupId ? ` (${groupId})` : ''}`,
      groupId ? { personId, groupId } : { personId },
    );
  }
}

export class PersonNotMemberError extends DomainError {
  readonly code = 'PERSON_NOT_MEMBER';
  constructor(groupId: string, personId: string) {
    super(`Person ${personId} is not a member of group ${groupId}`, { groupId, personId });
  }
}

/** G4 : seul un groupe vide peut être archivé. */
export class GroupNotEmptyError extends DomainError {
  readonly code = 'GROUP_NOT_EMPTY';
  constructor(groupId: string, memberCount: number) {
    super(`Group ${groupId} still has ${memberCount} member(s)`, { groupId, memberCount });
  }
}

/** G5 : la capacité ne descend pas sous le nombre de membres. */
export class CapacityBelowMemberCountError extends DomainError {
  readonly code = 'CAPACITY_BELOW_MEMBER_COUNT';
  constructor(groupId: string, maxMembers: number, memberCount: number) {
    super(`Group ${groupId} has ${memberCount} members, capacity ${maxMembers} is too low`, {
      groupId,
      maxMembers,
      memberCount,
    });
  }
}
