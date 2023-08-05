import { QueueRepo } from '../../interfaces/queue-repo';
import { invokeQueueResources } from '../invoke-queue-resources';
import { BaseLogger } from 'pino';
import { invokeServerlessFunctionWithMessage } from '../invoke-serverless-function-with-message';

describe('invokeQueueResources', () => {
  const queueOrid = 'orid:1:testProvider:::accountId:qs:testQueue';
  const queueRepoMock = {
    listQueues: jest.fn(),
    getQueueDetails: jest.fn(),
    getMessage: jest.fn(),
  };
  const fakeLogger = {
    info: jest.fn(),
    warn: jest.fn(),
  };
  const fakeInvokeCb = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('when no queues available, does nothing', async () => {
    // Arrange
    queueRepoMock.listQueues.mockResolvedValueOnce([]);

    // Act
    await invokeQueueResources({
      queueRepo: queueRepoMock as unknown as QueueRepo,
      logger: fakeLogger as unknown as BaseLogger,
      invokeCb: fakeInvokeCb,
    });

    // Assert
    expect(queueRepoMock.listQueues).toHaveBeenCalledTimes(1);
    expect(queueRepoMock.listQueues).toHaveBeenCalledWith();
    expect(queueRepoMock.getQueueDetails).toHaveBeenCalledTimes(0);
  });

  it('when queue has no resource, does nothing', async () => {
    // Arrange
    queueRepoMock.listQueues.mockResolvedValueOnce([queueOrid]);
    queueRepoMock.getQueueDetails.mockResolvedValueOnce({
      meta: {},
      currentMessages: 1,
    });

    // Act
    await invokeQueueResources({
      queueRepo: queueRepoMock as unknown as QueueRepo,
      logger: fakeLogger as unknown as BaseLogger,
      invokeCb: fakeInvokeCb,
    });

    // Assert
    expect(queueRepoMock.listQueues).toHaveBeenCalledTimes(1);
    expect(queueRepoMock.listQueues).toHaveBeenCalledWith();
    expect(queueRepoMock.getQueueDetails).toHaveBeenCalledTimes(1);
    expect(queueRepoMock.getQueueDetails).toHaveBeenCalledWith({
      queueOrid,
    });
    expect(fakeInvokeCb).toHaveBeenCalledTimes(0);
  });

  it('when queue has resource that is not supported, logs warning', async () => {
    // Arrange
    queueRepoMock.listQueues.mockResolvedValueOnce([queueOrid]);
    queueRepoMock.getQueueDetails.mockResolvedValueOnce({
      meta: {
        resource: 'orid:1:testProvider:::accountId:xx:testFunction',
        dlq: 'orid:1:testProvider:::accountId:qs:testQueueDlq',
      },
      currentMessages: 1,
    });
    queueRepoMock.getMessage.mockResolvedValueOnce({
      id: 'testMessageId',
      message: 'testMessageBody',
    });

    // Act
    await invokeQueueResources({
      queueRepo: queueRepoMock as unknown as QueueRepo,
      logger: fakeLogger as unknown as BaseLogger,
      invokeCb: fakeInvokeCb,
    });

    // Assert
    expect(queueRepoMock.listQueues).toHaveBeenCalledTimes(1);
    expect(queueRepoMock.listQueues).toHaveBeenCalledWith();
    expect(queueRepoMock.getQueueDetails).toHaveBeenCalledTimes(1);
    expect(queueRepoMock.getQueueDetails).toHaveBeenCalledWith({
      queueOrid,
    });
    expect(fakeInvokeCb).toHaveBeenCalledTimes(0);
    expect(fakeLogger.warn).toHaveBeenCalledTimes(1);
    expect(fakeLogger.warn).toHaveBeenCalledWith(
      {
        queue: queueOrid,
        messageId: 'testMessageId',
        resource: 'orid:1:testProvider:::accountId:xx:testFunction',
        dlq: 'orid:1:testProvider:::accountId:qs:testQueueDlq',
      },
      'Unknown resource type',
    );
  });

  it('when queue has dlq, resource, and messages invokes resource', async () => {
    // Arrange
    queueRepoMock.listQueues.mockResolvedValueOnce([queueOrid]);
    queueRepoMock.getQueueDetails.mockResolvedValueOnce({
      meta: {
        resource: 'orid:1:testProvider:::accountId:sf:testFunction',
        dlq: 'orid:1:testProvider:::accountId:qs:testQueueDlq',
      },
      currentMessages: 1,
    });
    queueRepoMock.getMessage.mockResolvedValueOnce({
      id: 'testMessageId',
      message: 'testMessageBody',
    });

    // Act
    await invokeQueueResources({
      queueRepo: queueRepoMock as unknown as QueueRepo,
      logger: fakeLogger as unknown as BaseLogger,
      invokeCb: fakeInvokeCb,
    });

    // Assert
    expect(queueRepoMock.listQueues).toHaveBeenCalledTimes(1);
    expect(queueRepoMock.listQueues).toHaveBeenCalledWith();
    expect(queueRepoMock.getQueueDetails).toHaveBeenCalledTimes(1);
    expect(queueRepoMock.getQueueDetails).toHaveBeenCalledWith({
      queueOrid,
    });
    expect(fakeInvokeCb).toHaveBeenCalledTimes(1);
    expect(fakeInvokeCb).toHaveBeenCalledWith({
      queue: queueOrid,
      queueRepo: queueRepoMock,
      message: {
        id: 'testMessageId',
        message: 'testMessageBody',
      },
      resource: 'orid:1:testProvider:::accountId:sf:testFunction',
      dlq: 'orid:1:testProvider:::accountId:qs:testQueueDlq',
      logger: fakeLogger,
      cb: invokeServerlessFunctionWithMessage,
    });
  });
});
