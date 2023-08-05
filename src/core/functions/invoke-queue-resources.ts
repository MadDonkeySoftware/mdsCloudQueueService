import { map } from 'bluebird';
import { v1 as oridV1 } from '@maddonkeysoftware/orid-node';
import { QueueRepo } from '../interfaces/queue-repo';
import { BaseLogger } from 'pino';
import type {
  InvokeCallbackHandler,
  InvokeResourceWithLogArgs,
} from './invoke-resource-with-log-and-dlq';
import { invokeServerlessFunctionWithMessage } from './invoke-serverless-function-with-message';
import { invokeStateMachineWithMessage } from './invoke-state-machine-with-message';

const resourceTypeToCb: Record<string, InvokeCallbackHandler | undefined> = {
  sf: invokeServerlessFunctionWithMessage,
  sm: invokeStateMachineWithMessage,
};

export async function invokeQueueResources({
  queueRepo,
  logger,
  invokeCb,
}: {
  queueRepo: QueueRepo;
  logger: BaseLogger;
  invokeCb: (args: InvokeResourceWithLogArgs) => Promise<void>;
}) {
  const queues = await queueRepo.listQueues();
  await map(
    queues,
    async (queue) => {
      const details = await queueRepo.getQueueDetails({
        queueOrid: queue,
      });

      if (
        details.meta.resource &&
        details.meta.dlq &&
        details.currentMessages > 0
      ) {
        const parsedOrid = oridV1.parse(details.meta.resource);
        const message = await queueRepo.getMessage({
          queueOrid: queue,
        });
        if (message) {
          const cb = resourceTypeToCb[parsedOrid.service];
          if (!cb) {
            logger.warn(
              {
                queue,
                messageId: message?.id,
                resource: details.meta.resource,
                dlq: details.meta.dlq,
              },
              'Unknown resource type',
            );
          } else {
            await invokeCb({
              queue,
              queueRepo,
              message,
              resource: details.meta.resource,
              dlq: details.meta.dlq,
              logger,
              cb,
            });
          }
        }
      }
    },
    { concurrency: 1 },
  );
}
