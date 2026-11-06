import 'server-only';
import type { ActionState } from './action-state';
import { ApiError } from './api/server';

/** Une `ApiError` devient un état d'erreur affichable ; toute autre erreur est relancée. */
export function failure(error: unknown): ActionState {
  if (error instanceof ApiError) return { status: 'error', problem: error.problem };
  throw error;
}

export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}
