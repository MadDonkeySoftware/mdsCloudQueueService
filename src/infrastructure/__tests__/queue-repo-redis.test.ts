import RedisSMQ from 'rsmq';
import { RedisClientType } from 'redis';
import { BaseLogger } from 'pino';
import { QueueRepoRedis } from '../repos/queue-repo-redis';

describe('queue-repo-redis', () => {
  let queueRepo: QueueRepoRedis;
  const mockRedisClient = {
    isReady: false,
    connect: jest.fn(),
    set: jest.fn().mockResolvedValue(null),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn(),
  };
  const mockRedisSmq = {
    createQueueAsync: jest.fn(),
    listQueuesAsync: jest.fn(),
    deleteQueueAsync: jest.fn(),
    getQueueAttributesAsync: jest.fn(),
    sendMessageAsync: jest.fn(),
    receiveMessageAsync: jest.fn(),
    deleteMessageAsync: jest.fn(),
  };
  const mockLogger = {
    warn: jest.fn(),
  };

  beforeAll(() => {
    queueRepo = new QueueRepoRedis({
      redisClient: mockRedisClient as unknown as RedisClientType,
      redisSmq: mockRedisSmq as unknown as RedisSMQ,
      logger: mockLogger as unknown as BaseLogger,
    });
    mockRedisClient.connect.mockImplementation(() => {
      mockRedisClient.isReady = true;
      return Promise.resolve(mockRedisClient);
    });
  });

  beforeEach(() => {
    // Reset the connection state to more accurately simulate runtime behavior
    mockRedisClient.isReady = false;
  });

  describe('internal state', () => {
    it('multiple calls to redis client only open the connection once', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(null);

      // Act
      await queueRepo.updateQueue({
        queueOrid: testQueue,
      });
      await queueRepo.updateQueue({
        queueOrid: testQueue,
      });

      // Assert
      expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('createQueue', () => {
    it('creates queue and saves metadata', async () => {
      // Arrange
      const queueName = 'test-queue';

      // Act
      await queueRepo.createQueue({
        name: queueName,
        delay: 0,
        maxSize: 1000,
        visibilityTimeout: 30,
        meta: {
          dlq: 'test-dlq',
          resource: 'test-resource',
        },
      });

      // Assert
      expect(mockRedisSmq.createQueueAsync).toHaveBeenCalledWith({
        delay: 0,
        maxsize: 1000,
        qname: queueName,
        vt: 30,
      });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `queue-meta:${queueName}`,
        JSON.stringify({
          dlq: 'test-dlq',
          resource: 'test-resource',
        }),
      );
    });
  });

  describe('listQueues', () => {
    it('when accountId is not provided, returns all queues', async () => {
      // Arrange
      mockRedisSmq.listQueuesAsync.mockResolvedValue([
        'orid_1_testProvider___account_qs_test-queue-1',
        'orid_1_testProvider___account2_qs_test-queue-1',
      ]);

      // Act
      const queues = await queueRepo.listQueues();

      // Assert
      expect(queues).toEqual([
        'orid:1:testProvider:::account:qs:test-queue-1',
        'orid:1:testProvider:::account2:qs:test-queue-1',
      ]);
    });

    it('when accountId is provided, returns related queues', async () => {
      // Arrange
      mockRedisSmq.listQueuesAsync.mockResolvedValue([
        'orid_1_testProvider___account_qs_test-queue-1',
        'orid_1_testProvider___account2_qs_test-queue-1',
      ]);

      // Act
      const queues = await queueRepo.listQueues('account2');

      // Assert
      expect(queues).toEqual([
        'orid:1:testProvider:::account2:qs:test-queue-1',
      ]);
    });
  });

  describe('updateQueue', () => {
    it('updates dlq and resource against a queues meatadata', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisClient.get.mockResolvedValueOnce(null);

      // Act
      await queueRepo.updateQueue({
        queueOrid: testQueue,
        dlq: 'test-dlq',
        resource: 'test-resource',
      });

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'queue-meta:orid_1_testProvider___account_qs_test-queue-1',
        JSON.stringify({
          dlq: 'test-dlq',
          resource: 'test-resource',
        }),
      );
    });

    it('updates dlq against a queues meatadata', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({
          dlq: 'old-test-dlq',
          resource: 'old-test-resource',
        }),
      );

      // Act
      await queueRepo.updateQueue({
        queueOrid: testQueue,
        dlq: 'test-dlq',
      });

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'queue-meta:orid_1_testProvider___account_qs_test-queue-1',
        JSON.stringify({
          dlq: 'test-dlq',
          resource: 'old-test-resource',
        }),
      );
    });

    it('updates resource against a queues meatadata', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({
          dlq: 'old-test-dlq',
          resource: 'old-test-resource',
        }),
      );

      // Act
      await queueRepo.updateQueue({
        queueOrid: testQueue,
        resource: 'test-resource',
      });

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'queue-meta:orid_1_testProvider___account_qs_test-queue-1',
        JSON.stringify({
          dlq: 'old-test-dlq',
          resource: 'test-resource',
        }),
      );
    });
  });

  describe('removeQueue', () => {
    it('removes queue and metadata', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      const escapedTestQueue = 'orid_1_testProvider___account_qs_test-queue-1';

      // Act
      await queueRepo.removeQueue({
        queueOrid: testQueue,
      });

      // Assert
      expect(mockRedisSmq.deleteQueueAsync).toHaveBeenCalledWith({
        qname: escapedTestQueue,
      });
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `queue-meta:${escapedTestQueue}`,
      );
    });
  });

  describe('getQueueDetails', () => {
    it('returns queue details with metadata', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({
          dlq: 'test-dlq',
          resource: 'test-resource',
        }),
      );
      mockRedisSmq.getQueueAttributesAsync.mockResolvedValueOnce({
        maxsize: 1000,
        vt: 30,
        delay: 0,
        msgs: 0,
      });

      // Act
      const queueDetails = await queueRepo.getQueueDetails({
        queueOrid: testQueue,
      });

      // Assert
      expect(queueDetails).toEqual({
        orid: testQueue,
        delay: 0,
        maxSize: 1000,
        visibilityTimeout: 30,
        meta: {
          dlq: 'test-dlq',
          resource: 'test-resource',
        },
        currentMessages: 0,
      });
    });

    it('returns queue details without metadata', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisSmq.getQueueAttributesAsync.mockResolvedValueOnce({
        maxsize: 1000,
        vt: 30,
        delay: 0,
        msgs: 0,
      });

      // Act
      const queueDetails = await queueRepo.getQueueDetails({
        queueOrid: testQueue,
      });

      // Assert
      expect(queueDetails).toEqual({
        orid: testQueue,
        delay: 0,
        maxSize: 1000,
        visibilityTimeout: 30,
        meta: {
          dlq: null,
          resource: null,
        },
        currentMessages: 0,
      });
    });
  });

  describe('createMessage', () => {
    it('creates a message', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisSmq.sendMessageAsync.mockResolvedValueOnce(undefined);

      // Act
      await queueRepo.createMessage({
        queueOrid: testQueue,
        message: 'test-message',
      });

      // Assert
      expect(mockRedisSmq.sendMessageAsync).toHaveBeenCalledWith({
        qname: 'orid_1_testProvider___account_qs_test-queue-1',
        message: 'test-message',
      });
    });
  });

  describe('getMessage', () => {
    it('gets a message when one is available', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisSmq.receiveMessageAsync.mockResolvedValueOnce({
        id: 'test-message-id',
        message: 'test-message',
        rc: 1,
      });

      // Act
      const message = await queueRepo.getMessage({
        queueOrid: testQueue,
      });

      // Assert
      expect(message).toEqual({
        id: 'test-message-id',
        message: 'test-message',
        rc: 1,
      });
      expect(mockRedisSmq.receiveMessageAsync).toHaveBeenCalledWith({
        qname: 'orid_1_testProvider___account_qs_test-queue-1',
      });
    });

    it('gets a null when no message is available', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisSmq.receiveMessageAsync.mockResolvedValueOnce(null);

      // Act
      const message = await queueRepo.getMessage({
        queueOrid: testQueue,
      });

      // Assert
      expect(message).toEqual(null);
      expect(mockRedisSmq.receiveMessageAsync).toHaveBeenCalledWith({
        qname: 'orid_1_testProvider___account_qs_test-queue-1',
      });
    });
  });

  describe('removeMessage', () => {
    it('removes a message', async () => {
      // Arrange
      const testQueue = 'orid:1:testProvider:::account:qs:test-queue-1';
      mockRedisSmq.deleteMessageAsync.mockResolvedValueOnce(undefined);

      // Act
      await queueRepo.removeMessage({
        queueOrid: testQueue,
        messageId: 'test-message-id',
      });

      // Assert
      expect(mockRedisSmq.deleteMessageAsync).toHaveBeenCalledWith({
        qname: 'orid_1_testProvider___account_qs_test-queue-1',
        id: 'test-message-id',
      });
    });
  });

  describe('healthChecks', () => {
    it('returns healthy when redis client and redis smq are responding', async () => {
      // Arrange
      mockRedisClient.ping.mockResolvedValueOnce('PONG');
      mockRedisSmq.listQueuesAsync.mockResolvedValueOnce([]);

      // Act
      const healthChecks = await queueRepo.healthChecks();

      // Assert
      expect(healthChecks).toEqual({
        queueStatus: 'OK',
        redisStatus: 'OK',
      });
    });

    it('returns error when service under test throws error', async () => {
      // Arrange
      mockRedisClient.ping.mockRejectedValueOnce(new Error('test-error'));
      mockRedisSmq.listQueuesAsync.mockResolvedValueOnce([]);

      // Act
      const healthChecks = await queueRepo.healthChecks();

      // Assert
      expect(healthChecks).toEqual({
        queueStatus: 'OK',
        redisStatus: 'ERROR',
      });
    });

    it('returns error when service under test is not responding', async () => {
      // Arrange
      mockRedisClient.ping.mockResolvedValueOnce('PONG');
      mockRedisSmq.listQueuesAsync.mockImplementation(() => {
        return new Promise(() => {
          /* never returns */
        });
      });

      // Act
      const healthChecks = await queueRepo.healthChecks(1);

      // Assert
      expect(healthChecks).toEqual({
        queueStatus: 'ERROR',
        redisStatus: 'OK',
      });
    });
  });
});
