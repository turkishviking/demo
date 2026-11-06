import { Command } from '../../../shared/application/command-bus';

export class CreateGroupCommand extends Command<{ id: string }> {
  constructor(
    readonly name: string,
    readonly maxMembers?: number,
  ) {
    super();
  }
}

export class RenameGroupCommand extends Command {
  constructor(
    readonly groupId: string,
    readonly name: string,
  ) {
    super();
  }
}

export class AddMemberCommand extends Command {
  constructor(
    readonly groupId: string,
    readonly personId: string,
  ) {
    super();
  }
}

export class RemoveMemberCommand extends Command {
  constructor(
    readonly groupId: string,
    readonly personId: string,
  ) {
    super();
  }
}

export class ChangeGroupCapacityCommand extends Command {
  constructor(
    readonly groupId: string,
    readonly maxMembers: number,
  ) {
    super();
  }
}

export class ArchiveGroupCommand extends Command {
  constructor(readonly groupId: string) {
    super();
  }
}
