/** @jest-environment node */
import { ApiError, apiFind, apiGet, apiRequest, getHealth, queryString } from './server';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('apiGet', () => {
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('calls the API without caching and returns the JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'ok', database: 'up' }));

    await expect(apiGet('/health')).resolves.toEqual({ status: 'ok', database: 'up' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:3001/api/v1/health');
    expect(init).toMatchObject({ cache: 'no-store', headers: { accept: 'application/json' } });
  });

  it('raises the problem+json returned by the API', async () => {
    const problem = { type: 't', title: 'Group full', status: 409, code: 'GROUP_FULL' };
    fetchMock.mockResolvedValue(jsonResponse(409, problem));

    const error = await apiGet('/groups/g-1/members').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).problem).toEqual(problem);
    expect((error as ApiError).message).toBe('Group full');
  });

  it('builds a problem when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 502, statusText: 'Bad Gateway' }));
    const error = (await apiGet('/health').catch((e: unknown) => e)) as ApiError;
    expect(error.problem).toMatchObject({
      status: 502,
      code: 'INTERNAL_ERROR',
      title: 'Bad Gateway',
    });
  });

  it('reports an unreachable API', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const error = (await apiGet('/health').catch((e: unknown) => e)) as ApiError;
    expect(error.problem).toMatchObject({ status: 503, code: 'API_UNREACHABLE' });
  });

  it('getHealth returns null instead of throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(getHealth()).resolves.toBeNull();
  });
});

describe('apiRequest', () => {
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends a JSON body for commands', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'p-1' }));
    await expect(apiRequest('POST', '/persons', { firstName: 'Ada' })).resolves.toEqual({
      id: 'p-1',
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"firstName":"Ada"}',
      headers: { 'content-type': 'application/json' },
    });
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiRequest('POST', '/persons/p-1/deactivate')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]![1]).not.toHaveProperty('body');
  });
});

describe('apiFind', () => {
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { type: 't', title: 'Not found', status: 404, code: 'PERSON_NOT_FOUND' }),
    );
    await expect(apiFind('/persons/x')).resolves.toBeNull();
  });

  it('rethrows other errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, { type: 't', title: 'Boom', status: 500, code: 'INTERNAL_ERROR' }),
    );
    await expect(apiFind('/persons/x')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('queryString', () => {
  it('drops empty parameters', () => {
    expect(queryString({ q: 'ada', status: undefined, cursor: '', limit: 10 })).toBe(
      '?q=ada&limit=10',
    );
    expect(queryString({})).toBe('');
  });
});
