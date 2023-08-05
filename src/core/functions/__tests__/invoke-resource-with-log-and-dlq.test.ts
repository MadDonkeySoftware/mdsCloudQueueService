import { invokeResourceWithLog } from '../invoke-resource-with-log-and-dlq';
import { GetMessageResult, QueueRepo } from '../../interfaces/queue-repo';
import { BaseLogger } from 'pino';

describe('invokeResourceWithLogAndDlq', () => {
  const testQueueOrid = 'orid:1:testProvider:::accountId:qs:testQueue';
  const fakeRepo = {
    createMessage: jest.fn(),
    removeMessage: jest.fn(),
  };
  const fakeMessage = {
    id: 'messageId',
    message: 'message body',
  };
  const resource = 'orid:1:testProvider:::accountId:sf:testFunction';
  const dlq = 'orid:1:testProvider:::accountId:qs:testDlq';
  const fakeLogger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const fakeCb = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('when callback succeeds, removes message from queue', async () => {
    // Arrange
    fakeCb.mockResolvedValueOnce(undefined);

    // Act
    await invokeResourceWithLog({
      queue: testQueueOrid,
      queueRepo: fakeRepo as unknown as QueueRepo,
      message: fakeMessage as unknown as GetMessageResult,
      resource,
      dlq,
      logger: fakeLogger as unknown as BaseLogger,
      cb: fakeCb,
    });

    // Assert
    expect(fakeCb).toHaveBeenCalledTimes(1);
    expect(fakeCb).toHaveBeenCalledWith({
      resource,
      message: fakeMessage.message,
    });
    expect(fakeLogger.info).toHaveBeenCalledTimes(1);
    expect(fakeRepo.removeMessage).toHaveBeenCalledTimes(1);
    expect(fakeRepo.removeMessage).toHaveBeenCalledWith({
      queueOrid: testQueueOrid,
      messageId: fakeMessage.id,
    });
  });

  it('when callback fails, moves message to dlq', async () => {
    // Arrange
    fakeCb.mockRejectedValueOnce(new Error('test error'));

    // Act
    await invokeResourceWithLog({
      queue: testQueueOrid,
      queueRepo: fakeRepo as unknown as QueueRepo,
      message: fakeMessage as unknown as GetMessageResult,
      resource,
      dlq,
      logger: fakeLogger as unknown as BaseLogger,
      cb: fakeCb,
    });

    // Assert
    expect(fakeCb).toHaveBeenCalledTimes(1);
    expect(fakeCb).toHaveBeenCalledWith({
      resource,
      message: fakeMessage.message,
    });
    expect(fakeLogger.info).toHaveBeenCalledTimes(0);
    expect(fakeLogger.error).toHaveBeenCalledTimes(1);
    expect(fakeRepo.createMessage).toHaveBeenCalledTimes(1);
    expect(fakeRepo.createMessage).toHaveBeenCalledWith({
      queueOrid: dlq,
      message: fakeMessage.message,
    });
    expect(fakeRepo.removeMessage).toHaveBeenCalledTimes(1);
    expect(fakeRepo.removeMessage).toHaveBeenCalledWith({
      queueOrid: testQueueOrid,
      messageId: fakeMessage.id,
    });
  });
});
