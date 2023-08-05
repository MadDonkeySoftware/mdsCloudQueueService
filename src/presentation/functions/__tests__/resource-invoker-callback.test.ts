import { AwilixContainer } from 'awilix';
import { resourceInvokerCallback } from '../resource-invoker-callback';
import { invokeQueueResources } from '../../../core/functions/invoke-queue-resources';

jest.mock('../../../core/functions/invoke-queue-resources', () => ({
  invokeQueueResources: jest.fn(),
}));
const mockInvokeQueueResources = jest.mocked(invokeQueueResources);

describe('resource-invoker-callback', () => {
  it('returns function', () => {
    // Arrange
    const mockContainer = {
      resolve: jest.fn(),
    };

    // Act
    const result = resourceInvokerCallback({
      container: mockContainer as unknown as AwilixContainer,
    });

    // Assert
    expect(result).toBeInstanceOf(Function);
  });

  it('returns function that calls invokeQueueResources', async () => {
    // Arrange
    const fakeLogger = { label: 'logger' };
    const fakeQueueRepo = { label: 'repo' };
    const mockContainer = {
      resolve: jest.fn().mockImplementation((key) => {
        switch (key) {
          case 'logger':
            return fakeLogger;
          case 'queueRepo':
            return fakeQueueRepo;
          default:
            throw new Error(`Unexpected key ${key}`);
        }
      }),
    };
    const temp = resourceInvokerCallback({
      container: mockContainer as unknown as AwilixContainer,
    });

    // Act
    await temp();

    // Assert
    expect(mockContainer.resolve).toHaveBeenCalledWith('logger');
    expect(mockContainer.resolve).toHaveBeenCalledWith('queueRepo');
    expect(mockInvokeQueueResources).toHaveBeenCalledWith({
      logger: fakeLogger,
      queueRepo: fakeQueueRepo,
      invokeCb: expect.any(Function),
    });
  });
});
