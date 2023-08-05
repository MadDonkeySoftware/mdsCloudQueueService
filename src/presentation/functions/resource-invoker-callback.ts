import { AwilixContainer } from 'awilix';
import { Cradle } from '@fastify/awilix';
import { invokeQueueResources } from '../../core/functions/invoke-queue-resources';
import { invokeResourceWithLog } from '../../core/functions/invoke-resource-with-log-and-dlq';

export function resourceInvokerCallback({
  container,
}: {
  container: AwilixContainer<Cradle>;
}) {
  return function () {
    return invokeQueueResources({
      logger: container.resolve('logger'),
      queueRepo: container.resolve('queueRepo'),
      invokeCb: invokeResourceWithLog,
    });
  };
}
