import { IntervalInvoker } from '../interval-invoker';
import { BaseLogger } from 'pino';

// NOTE: There be dragons here. Jests fake timers throw off the error processing
// in some tests such that the asserts were firing /BEFORE/ the try-catch logic
// of the method under test was firing. Be aware before making modifications to
// this test suite.
describe('internal-invoker', () => {
  const interval = 100;
  const errorLog = jest.fn();
  const callback = jest.fn();
  let intervalInvoker: IntervalInvoker;

  beforeAll(() => {
    intervalInvoker = new IntervalInvoker({
      pollInterval: interval,
      callback,
      logger: { error: errorLog } as unknown as BaseLogger,
    });
  });

  beforeEach(() => {});

  afterAll(() => {
    intervalInvoker.stopMonitor();
    jest.useRealTimers();
  });

  it('invokes the callback on the specified time interval', () => {
    // Arrange
    jest.useFakeTimers();
    callback.mockResolvedValueOnce(undefined);
    intervalInvoker.startMonitor();

    // Act
    jest.advanceTimersByTime(interval);
    intervalInvoker.stopMonitor();
    jest.useRealTimers();

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('logs an error if the callback throws', async () => {
    // Arrange
    jest.useFakeTimers();
    callback.mockRejectedValueOnce(new Error('test error'));
    intervalInvoker.startMonitor();

    // Act
    jest.advanceTimersByTime(interval);
    intervalInvoker.stopMonitor();
    jest.useRealTimers();
    // NOTE: There be dragons here. Jests fake timers throw off the error processing and logging
    // such that the asserts below were firing /BEFORE/ the catch of the method under test was
    // firing. This is a workaround to allow the error to be logged before the asserts are run.
    await new Promise((resolve) => setTimeout(resolve, 1));

    // Assert
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith(
      { err: new Error('test error') },
      'Error invoking resources',
    );
  });
});
