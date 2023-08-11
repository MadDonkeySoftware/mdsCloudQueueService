import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { GetHealthResponse, GetHealthResponseSchema } from '../schemas';

export function healthCheckController(
  app: FastifyInstance,
  opts: FastifyPluginOptions,
  done: (err?: Error) => void,
) {
  app.get<{
    Body: any;
  }>(
    '/',
    {
      schema: {
        description: 'Health check',
        tags: ['X-HIDDEN'],
        response: {
          200: GetHealthResponseSchema,
        },
      },
    },
    async (request, response) => {
      const statuses = await request.services.logic.healthChecks();

      response.status(200);
      response.send({ serverStatus: 'OK', ...statuses } as GetHealthResponse);
    },
  );

  done();
}
