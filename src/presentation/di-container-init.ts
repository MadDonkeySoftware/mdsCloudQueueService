import { Cradle } from '@fastify/awilix';
import { asClass, asFunction, AwilixContainer, Lifetime } from 'awilix';
import config from 'config';
import { createClient } from 'redis';
import RedisSMQ from 'rsmq';
import { Logic } from '../core/classes/logic';
import { QueueRepoRedis } from '../infrastructure/repos/queue-repo-redis';
import { IntervalInvoker } from '../core/classes/interval-invoker';
import { FastifyInstance } from 'fastify';
import { resourceInvokerCallback } from './functions/resource-invoker-callback';

/**
 * Documentation available at https://github.com/jeffijoe/awilix
 * @param args the argument object
 * @param args.diContainer The DI container to configure
 * @param args.server The fastify server instance
 */
export function diContainerInit({
  diContainer,
  server,
}: {
  diContainer: AwilixContainer<Cradle>;
  server: FastifyInstance;
}) {
  // NOTE: Keep the keys in alphabetical order to make it easier to find
  diContainer.register({
    logger: asFunction(
      () => {
        return server.log;
      },
      {
        lifetime: Lifetime.SINGLETON,
      },
    ),

    logic: asClass(Logic, {
      lifetime: Lifetime.SCOPED,
    }),

    queueRepo: asClass(QueueRepoRedis, {
      lifetime: Lifetime.SCOPED,
    }),

    redisClient: asFunction(
      () => {
        const client = createClient({
          url: config.get<string>('redisUrl'),
        });
        return client;
      },
      {
        // NOTE: if we use non-transient here the queue will close the connection on us when pending operations are still running
        lifetime: Lifetime.SCOPED,
        dispose: async (redisClient) => {
          try {
            await redisClient.quit();
          } catch (err) {
            /* ignore */
          }
        },
      },
    ),

    redisSmq: asFunction(
      ({ redisClient }) => {
        return new RedisSMQ({ client: redisClient, ns: 'rsmq' });
      },
      {
        lifetime: Lifetime.SCOPED,
        dispose: async (redisSmq) => {
          // await new Promise((res, rej) => {
          await new Promise((res, rej) => {
            // Delay the quit to give the queue time to finish processing
            setTimeout(() => {
              redisSmq.quit((err) => {
                /* istanbul ignore next */
                if (err) {
                  rej(err);
                }
                res(null);
              });
            }, 200);
          });
        },
      },
    ),

    resourceInvoker: asClass(IntervalInvoker, {
      lifetime: Lifetime.SINGLETON,
      injector: (container) => {
        return {
          pollInterval: 1000,
          callback: resourceInvokerCallback({ container }),
        };
      },
      dispose: (instance) => {
        instance.stopMonitor();
      },
    }),
  });

  return Promise.resolve();
}
