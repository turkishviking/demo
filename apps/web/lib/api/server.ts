import 'server-only';
import type { HealthDto, ProblemDetails } from '@cardsim/shared';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }

  get status(): number {
    return this.problem.status;
  }
}

type Method = 'GET' | 'POST' | 'DELETE';

/**
 * Client HTTP de l'API, utilisable uniquement côté serveur (server components, server actions).
 * Les erreurs `problem+json` sont levées en `ApiError` ; une API injoignable donne `API_UNREACHABLE`.
 */
export async function apiRequest<T>(
  method: Method,
  path: `/${string}`,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      method,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init?.headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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

  if (response.status === 204) return undefined as T;
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      (json as ProblemDetails | null) ?? {
        type: 'about:blank',
        title: response.statusText,
        status: response.status,
        code: 'INTERNAL_ERROR',
      },
    );
  }
  return json as T;
}

export function apiGet<T>(path: `/${string}`, init?: RequestInit): Promise<T> {
  return apiRequest<T>('GET', path, undefined, init);
}

/** Lecture d'une ressource : `null` si elle est introuvable (404). */
export async function apiFind<T>(path: `/${string}`): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Query string sans les paramètres vides. */
export function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function getHealth(): Promise<HealthDto | null> {
  try {
    return await apiGet<HealthDto>('/health');
  } catch {
    return null;
  }
}
