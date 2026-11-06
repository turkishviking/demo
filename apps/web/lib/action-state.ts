import type { ProblemDetails } from '@cardsim/shared';

/** État renvoyé par une server action et consommé par `useActionState` (importable côté client). */
export type ActionState =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; problem: ProblemDetails };

export const IDLE: ActionState = { status: 'idle' };

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
