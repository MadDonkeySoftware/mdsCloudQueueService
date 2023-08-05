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
    (request, response) => {
      response.status(200);
      response.send({ status: 'OK' } as GetHealthResponse);
    },
  );

  done();
}
