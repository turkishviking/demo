import type { ActionState } from '@/lib/action-state';
import { errorMessage } from '@/lib/errors';

/** Message de succès ou d'erreur d'une server action (code API → message français). */
export function FormFeedback({ state }: { state: ActionState }) {
  if (state.status === 'success') {
    return state.message ? (
      <p role="status" className="text-sm text-success">
        {state.message}
      </p>
    ) : null;
  }
  if (state.status !== 'error') return null;

  const fields = state.problem.errors?.map((issue) => issue.field) ?? [];
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <p>{errorMessage(state.problem)}</p>
      {fields.length > 0 && <p className="mt-1 text-xs">Champs concernés : {fields.join(', ')}</p>}
    </div>
  );
}
