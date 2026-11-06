import { ConcurrencyError } from './concurrency-error';

/** Intention d'écriture. `TResult` est le type renvoyé par son handler (void ou id). */
export abstract class Command<TResult = void> {
  declare private readonly __result?: TResult;
}

export interface CommandHandler<
  TCommand extends Command<unknown>,
  TResult = CommandResult<TCommand>,
> {
  execute(command: TCommand): Promise<TResult>;
}

type CommandClass<TCommand extends Command<unknown>> = abstract new (...args: never[]) => TCommand;

/** Type de résultat déclaré par une commande. */
export type CommandResult<TCommand> = TCommand extends Command<infer TResult> ? TResult : never;

export interface CommandBus {
  execute<TResult>(command: Command<TResult>): Promise<TResult>;
}

export const COMMAND_BUS = Symbol('CommandBus');

export class CommandHandlerNotFoundError extends Error {
  constructor(commandName: string) {
    super(`No handler registered for command ${commandName}`);
    this.name = 'CommandHandlerNotFoundError';
  }
}

/**
 * Associe une classe de commande à son handler et rejoue la commande en cas de
 * `ConcurrencyError` (verrou optimiste), jusqu'à `maxAttempts` fois.
 */
export class SimpleCommandBus implements CommandBus {
  private readonly handlers = new Map<
    CommandClass<Command<unknown>>,
    CommandHandler<Command<unknown>, unknown>
  >();

  constructor(private readonly maxAttempts = 3) {
    if (maxAttempts < 1) throw new RangeError('maxAttempts must be >= 1');
  }

  register<TCommand extends Command<unknown>>(
    commandClass: CommandClass<TCommand>,
    handler: CommandHandler<TCommand, CommandResult<TCommand>>,
  ): void {
    if (this.handlers.has(commandClass)) {
      throw new Error(`Handler already registered for command ${commandClass.name}`);
    }
    this.handlers.set(commandClass, handler as CommandHandler<Command<unknown>, unknown>);
  }

  async execute<TResult>(command: Command<TResult>): Promise<TResult> {
    const handler = this.handlers.get(command.constructor as CommandClass<Command<unknown>>);
    if (!handler) throw new CommandHandlerNotFoundError(command.constructor.name);

    for (let attempt = 1; ; attempt++) {
      try {
        return (await handler.execute(command)) as TResult;
      } catch (error) {
        if (!(error instanceof ConcurrencyError) || attempt >= this.maxAttempts) throw error;
      }
    }
  }
}
