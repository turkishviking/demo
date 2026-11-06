import { Command } from '../../../shared/application/command-bus';

export class RegisterPersonCommand extends Command<{ id: string }> {
  constructor(
    readonly firstName: string,
    readonly lastName: string,
    readonly email: string,
  ) {
    super();
  }
}

export class RenamePersonCommand extends Command {
  constructor(
    readonly personId: string,
    readonly firstName: string,
    readonly lastName: string,
  ) {
    super();
  }
}

export class DeactivatePersonCommand extends Command {
  constructor(readonly personId: string) {
    super();
  }
}
