import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/health is public and reports the database', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('GET /api/v1/health/outbox reports outbox backlog', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/outbox').expect(200);
    expect(res.body).toEqual({ pending: expect.any(Number), deadLetter: expect.any(Number) });
  });

  it('echoes the correlation id, or generates one', async () => {
    const echoed = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-correlation-id', 'demo-123')
      .expect(200);
    expect(echoed.headers['x-correlation-id']).toBe('demo-123');

    const generated = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(generated.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers unknown routes with problem+json', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/nope')
      .set('x-correlation-id', 'corr-404')
      .expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 404, code: 'NOT_FOUND', correlationId: 'corr-404' });
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(res.body.paths).toHaveProperty('/api/v1/health');
  });
});
