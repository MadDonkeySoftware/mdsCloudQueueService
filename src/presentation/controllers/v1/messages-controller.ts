import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  CreateMessageRequestBody,
  CreateMessageRequestBodySchema,
  CreateMessageResponseBodySchema,
  DeleteMessageResponseBodySchema,
  GetMessageResponseBodySchema,
  MessageDeleteRequestParams,
  MessageDeleteRequestParamsSchema,
  QueueActionRequestParams,
  QueueActionRequestParamsSchema,
} from '../../schemas';
import { QueueNotFoundError } from '../../../core/errors';
import { validateToken } from '../../hooks/validate-token';
import { validateRequestOridParam } from '../../hooks/validate-request-orid-param';
import { validateCanAccessOridParam } from '../../hooks/validate-can-access-orid-param';

export function messagesController(
  app: FastifyInstance,
  opts: FastifyPluginOptions,
  done: (err?: Error) => void,
) {
  app.addHook('onRequest', validateToken);
  app.addHook('preHandler', validateRequestOridParam);
  app.addHook('preHandler', validateCanAccessOridParam);

  app.get<{
    Params: QueueActionRequestParams;
  }>(
    '/message/:orid',
    {
      schema: {
        description: 'Get a message from a queue',
        tags: ['Messages'],
        params: QueueActionRequestParamsSchema,
        response: {
          200: GetMessageResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      const message = await request.services.logic.getMessage({
        queueOrid: request.params.orid,
      });
      response.status(200).send(message ?? {});
    },
  );

  app.post<{
    Body: CreateMessageRequestBody;
    Params: QueueActionRequestParams;
  }>(
    '/message/:orid',
    {
      schema: {
        description: 'Create a message in a queue',
        tags: ['Messages'],
        body: CreateMessageRequestBodySchema,
        params: QueueActionRequestParamsSchema,
        response: {
          200: CreateMessageResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      try {
        const { body } = request;
        await request.services.logic.createMessage({
          queueOrid: request.params.orid,
          message:
            typeof body === 'object' ? JSON.stringify(body) : String(body),
        });

        response.status(200).send();
      } catch (err) {
        if (err instanceof QueueNotFoundError) {
          response.status(404).send();
          return;
        }
        throw err;
      }
    },
  );

  app.delete<{
    Params: MessageDeleteRequestParams;
  }>(
    '/message/:orid/:messageId',
    {
      schema: {
        description: 'Remove a message from a queue',
        tags: ['Messages'],
        params: MessageDeleteRequestParamsSchema,
        response: {
          200: DeleteMessageResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      const { orid, messageId } = request.params;
      try {
        await request.services.logic.removeMessage({
          queueOrid: orid,
          messageId,
        });
        response.status(200).send();
      } catch (err) {
        if (err instanceof QueueNotFoundError) {
          response.status(404).send({
            message: err.message,
          });
          return;
        }
        throw err;
      }
    },
  );

  done();
}
