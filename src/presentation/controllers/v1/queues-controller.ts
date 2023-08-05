import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { v1 as oridV1 } from '@maddonkeysoftware/orid-node';
import {
  CreateQueueRequestBody,
  CreateQueueRequestBodySchema,
  CreateQueueResponseBodySchema,
  DeleteQueueResponseBodySchema,
  GetQueueDetailsResponseBodySchema,
  GetQueueLengthResponseBodySchema,
  ListQueuesResponseBodySchema,
  UpdateQueueRequestBody,
  UpdateQueueRequestBodySchema,
  QueueActionRequestParams,
  QueueActionRequestParamsSchema,
  UpdateQueueResponseBodySchema,
} from '../../schemas';
import {
  QueueExistsError,
  QueueNotFoundError,
  QueueUpdateConditionError,
} from '../../../core/errors';
import { validateToken } from '../../hooks/validate-token';
import { validateRequestOridParam } from '../../hooks/validate-request-orid-param';
import { validateCanAccessOridParam } from '../../hooks/validate-can-access-orid-param';

export function queuesController(
  app: FastifyInstance,
  opts: FastifyPluginOptions,
  done: (err?: Error) => void,
) {
  app.addHook('onRequest', validateToken);
  app.addHook('preHandler', validateRequestOridParam);
  app.addHook('preHandler', validateCanAccessOridParam);

  app.get(
    '/queues',
    {
      schema: {
        response: {
          200: ListQueuesResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      const queues = await (request.parsedToken!.payload.accountId === '1'
        ? request.services.logic.listQueues()
        : request.services.logic.listQueues(
            request.parsedToken!.payload.accountId,
          ));
      response.send(
        queues.map((q) => ({
          name: oridV1.parse(q).resourceId,
          orid: q,
        })),
      );
    },
  );

  app.post<{
    Body: CreateQueueRequestBody;
  }>(
    '/queue',
    {
      schema: {
        description: 'Create a queue',
        tags: ['Queues'],
        body: CreateQueueRequestBodySchema,
        response: {
          200: CreateQueueResponseBodySchema,
          201: CreateQueueResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      try {
        const { body } = request;
        const oridName = await request.services.logic.createQueue({
          name: body.name,
          accountId: request.parsedToken!.payload.accountId,
          maxSize: body.maxSize,
          delay: body.delay,
          visibilityTimeout: body.vt,
          meta: {
            dlq: body.dlq,
            resource: body.resource,
          },
        });

        response.status(201).send({
          name: body.name,
          orid: oridName,
        });
      } catch (err) {
        if (err instanceof QueueExistsError) {
          const orid = /: (.*)/g.exec(err.message)?.[1];
          response.status(200).send({
            name: request.body.name,
            orid,
          });
          return;
        }
        throw err;
      }
    },
  );

  app.post<{
    Body: UpdateQueueRequestBody;
    Params: QueueActionRequestParams;
  }>(
    '/queue/:orid',
    {
      schema: {
        description: 'Update a queue',
        tags: ['Queues'],
        body: UpdateQueueRequestBodySchema,
        params: QueueActionRequestParamsSchema,
        response: {
          200: UpdateQueueResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      const { orid } = request.params;
      const { dlq, resource } = request.body;
      try {
        await request.services.logic.updateQueue({
          queueOrid: orid,
          dlq,
          resource,
        });
        response.status(200).send();
      } catch (err) {
        if (err instanceof QueueUpdateConditionError) {
          response.status(400).send({
            message: err.message,
          });
          return;
        }
        request.log.error(err, 'Error updating queue');
        throw err;
      }
    },
  );

  app.delete<{
    Params: QueueActionRequestParams;
  }>(
    '/queue/:orid',
    {
      schema: {
        description: 'Update a queue',
        tags: ['Queues'],
        params: QueueActionRequestParamsSchema,
        response: {
          200: DeleteQueueResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      const { orid } = request.params;
      try {
        await request.services.logic.deleteQueue({
          queueOrid: orid,
        });
        response.status(204).send();
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

  app.get<{
    Params: QueueActionRequestParams;
  }>(
    '/queue/:orid/details',
    {
      schema: {
        description: 'Get queue metadata details',
        tags: ['Queues'],
        params: QueueActionRequestParamsSchema,
        response: {
          200: GetQueueDetailsResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      const { orid } = request.params;
      try {
        const details = await request.services.logic.getQueueDetails({
          queueOrid: orid,
        });
        response.status(200).send({
          orid: details.orid,
          resource: details.meta.resource,
          dlq: details.meta.dlq,
        });
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

  // /queue/:orid/length
  app.get<{
    Params: QueueActionRequestParams;
  }>(
    '/queue/:orid/length',
    {
      schema: {
        description: 'Get queue metadata details',
        tags: ['Queues'],
        params: QueueActionRequestParamsSchema,
        response: {
          200: GetQueueLengthResponseBodySchema,
        },
      },
    },
    async (request, response) => {
      const { orid } = request.params;
      try {
        const details = await request.services.logic.getQueueDetails({
          queueOrid: orid,
        });
        response.status(200).send({
          orid: details.orid,
          size: details.currentMessages,
        });
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
