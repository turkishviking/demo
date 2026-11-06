import 'server-only';
import type { HealthDto, ProblemDetails } from '@cardsim/shared';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }
}

/**
 * Client HTTP de l'API, utilisable uniquement côté serveur (server components, server actions).
 * Les erreurs `problem+json` sont levées en `ApiError` ; une API injoignable donne `API_UNREACHABLE`.
 */
export async function apiGet<T>(path: `/${string}`, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { accept: 'application/json', ...init?.headers },
      signal: init?.signal ?? AbortSignal.timeout(5000),
    });
  } catch {
    throw new ApiError({
      type: 'about:blank',
      title: 'API unreachable',
      status: 503,
      code: 'API_UNREACHABLE',
      detail: `Cannot reach ${API_URL}`,
    });
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      (body as ProblemDetails | null) ?? {
        type: 'about:blank',
        title: response.statusText,
        status: response.status,
        code: 'INTERNAL_ERROR',
      },
    );
  }
  return body as T;
}

export async function getHealth(): Promise<HealthDto | null> {
  try {
    return await apiGet<HealthDto>('/health');
  } catch {
    return null;
  }
}
