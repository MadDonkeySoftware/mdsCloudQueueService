import * as src from '../..';
import { FastifyInstance, InjectOptions } from 'fastify';

describe('healthCheckController test', () => {
  let app: FastifyInstance;

  function makeRequest(overrides: InjectOptions = {}) {
    return app.inject({
      ...({
        url: '/health',
        method: 'GET',
      } as InjectOptions),
      ...overrides,
    });
  }

  beforeAll(async () => {
    app = await src.buildApp();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns OK', async () => {
    // Arrange

    // Act
    const resp = await makeRequest();

    // Assert
    expect(resp.statusCode).toBe(200);
    expect(resp.json()).toEqual({ status: 'OK' });
  });
});
