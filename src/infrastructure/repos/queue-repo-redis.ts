import { RedisClientType } from 'redis';
import RedisSMQ from 'rsmq';
import { v1 as oridV1 } from '@maddonkeysoftware/orid-node';
import { BaseLogger } from 'pino';
import {
  CreateMessageArgs,
  CreateQueueArgs,
  GetMessageArgs,
  GetMessageResult,
  GetQueueDetailsArgs,
  HealthChecksResult,
  QueueRepo,
  RemoveMessageArgs,
  RemoveQueueArgs,
  UpdateQueueArgs,
} from '../../core/interfaces/queue-repo';
import { HealthCheckResult } from '../../core/types/health-check-result';

export class QueueRepoRedis implements QueueRepo {
  #redisClientInternal: RedisClientType;
  #redisSmqInternal: RedisSMQ;
  #logger: BaseLogger;

  constructor({
    redisClient,
    redisSmq,
    logger,
  }: {
    redisClient: RedisClientType;
    redisSmq: RedisSMQ;
    logger: BaseLogger;
  }) {
    this.#redisClientInternal = redisClient;
    this.#redisSmqInternal = redisSmq;
    this.#logger = logger;
  }

  get #redisClient() {
    if (!this.#redisClientInternal.isReady) {
      return this.#redisClientInternal
        .connect()
        .then(() => this.#redisClientInternal);
    }
    return Promise.resolve(this.#redisClientInternal);
  }

  get #redisSMQ() {
    return this.#redisSmqInternal;
  }

  #escapeName(name: string) {
    return name.replace(/:/g, '_');
  }

  #unescapeName(name: string) {
    return name.replace(/_/g, ':');
  }

  #getMetaKey(name: string) {
    return `queue-meta:${this.#escapeName(name)}`;
  }

  async createQueue(args: CreateQueueArgs) {
    const escapedName = this.#escapeName(args.name);

    await this.#redisSMQ.createQueueAsync({
      delay: args.delay,
      maxsize: args.maxSize,
      qname: escapedName,
      vt: args.visibilityTimeout,
    });

    await (
      await this.#redisClient
    ).set(this.#getMetaKey(escapedName), JSON.stringify(args.meta));
  }

  /**
   * List all queues
   * @param account the optional account to filter the list by
   */
  async listQueues(account?: string) {
    const names = await this.#redisSMQ.listQueuesAsync();
    const oridNames = names.map((name) => this.#unescapeName(name));
    return account
      ? oridNames.filter((name) => oridV1.parse(name).custom3 === account)
      : oridNames;
  }

  async updateQueue(args: UpdateQueueArgs) {
    const redisClient = await this.#redisClient;
    const escapedName = this.#escapeName(args.queueOrid);
    const existingValue = await redisClient.get(escapedName);
    const meta = JSON.parse(existingValue ?? '{}') as {
      dlq?: string | null;
      resource?: string | null;
    };

    if (args.dlq !== undefined) {
      meta.dlq = args.dlq;
    }
    if (args.resource !== undefined) {
      meta.resource = args.resource;
    }

    await redisClient.set(this.#getMetaKey(escapedName), JSON.stringify(meta));
  }

  async removeQueue(args: RemoveQueueArgs) {
    const redisClient = await this.#redisClient;
    const escapedName = this.#escapeName(args.queueOrid);

    await Promise.all([
      redisClient.del(this.#getMetaKey(escapedName)),
      this.#redisSMQ.deleteQueueAsync({ qname: escapedName }),
    ]);
  }

  async getQueueDetails(args: GetQueueDetailsArgs) {
    const redisClient = await this.#redisClient;
    const escapedName = this.#escapeName(args.queueOrid);

    const [rawMeta, details] = await Promise.all([
      redisClient.get(this.#getMetaKey(escapedName)),
      await this.#redisSMQ.getQueueAttributesAsync({
        qname: escapedName,
      }),
    ]);

    const meta = JSON.parse(rawMeta ?? '{}') as {
      dlq?: string | null;
      resource?: string | null;
    };

    return {
      orid: args.queueOrid,
      meta: {
        dlq: meta.dlq ?? null,
        resource: meta.resource ?? null,
      },
      maxSize: details.maxsize,
      delay: details.delay,
      visibilityTimeout: details.vt,
      currentMessages: details.msgs,
    };
  }

  async createMessage(args: CreateMessageArgs) {
    const escapedName = this.#escapeName(args.queueOrid);
    await this.#redisSMQ.sendMessageAsync({
      qname: escapedName,
      message: args.message,
      delay: args.delay,
    });
  }

  async getMessage(args: GetMessageArgs): Promise<GetMessageResult | null> {
    const escapedName = this.#escapeName(args.queueOrid);
    const result = (await this.#redisSMQ.receiveMessageAsync({
      qname: escapedName,
      vt: args.visibilityTimeout,
    })) as RedisSMQ.QueueMessage; // Is "QueMessage | {}" but that type is a eslint violation

    return result?.id
      ? {
          id: result.id,
          message: result.message,
          rc: result.rc,
        }
      : null;
  }

  removeMessage(args: RemoveMessageArgs) {
    const escapedName = this.#escapeName(args.queueOrid);
    return this.#redisSMQ.deleteMessageAsync({
      qname: escapedName,
      id: args.messageId,
    });
  }

  async healthChecks(timeout = 3000): Promise<HealthChecksResult> {
    const runHealthCheck = async (fn: () => Promise<void>) => {
      let status = HealthCheckResult.INDETERMINANT;
      const wrapper = async () => {
        await fn();
        status = HealthCheckResult.OK;
      };
      try {
        await Promise.race([
          wrapper(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeout),
          ),
        ]);
      } catch (err) {
        this.#logger.warn({ err }, 'health check failed');
        status = HealthCheckResult.ERROR;
      }

      return status;
    };

    const healthCheckRedis = async () => {
      const redis = await this.#redisClient;
      await redis.ping();
    };
    const healthCheckQueues = async () => {
      await this.listQueues();
    };

    const redisStatus = await runHealthCheck(healthCheckRedis);
    const queueStatus = await runHealthCheck(healthCheckQueues);

    return {
      redisStatus,
      queueStatus,
    };
  }
}
