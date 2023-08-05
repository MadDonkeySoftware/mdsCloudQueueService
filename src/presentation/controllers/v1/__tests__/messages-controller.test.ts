import { asFunction, Lifetime } from 'awilix';
import { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../../../index';
import { QueueNotFoundError } from '../../../../core/errors';

jest.mock('../../../hooks/validate-token', () => {
  return {
    validateToken: jest.fn().mockImplementation((req, res, next) => {
      req.parsedToken = {
        payload: {
          accountId: 'testAccountId',
        },
      };
      next();
    }),
  };
});

describe('messages controller test', () => {
  let app: FastifyInstance;
  const testQueueOrid = 'orid:1:testIssuer:::testAccountId:qs:testQueue';
  const logicMock = {
    createMessage: jest.fn(),
    getMessage: jest.fn(),
    removeMessage: jest.fn(),
  };

  function makeRequest(overrides: InjectOptions = {}) {
    return app.inject({
      ...({
        url: '/',
        method: 'GET',
      } as InjectOptions),
      ...overrides,
    });
  }

  beforeAll(async () => {
    app = await buildApp(async ({ diContainer }) => {
      diContainer.register({
        logic: asFunction(() => logicMock, {
          lifetime: Lifetime.SCOPED,
        }),
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('get message queue', () => {
    it('when message exists, responds with 200 and message details', async () => {
      // Arrange
      logicMock.getMessage.mockResolvedValueOnce({
        id: 'testId',
        message: 'testMessage',
        rc: 1,
      });

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
        },
      });

      // Assert
      expect(logicMock.getMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(JSON.parse(response.body)).toEqual({
        id: 'testId',
        message: 'testMessage',
        rc: 1,
      });
      expect(response.statusCode).toBe(200);
    });

    it('when message does not exist, responds with 200 and empty message', async () => {
      // Arrange
      logicMock.getMessage.mockResolvedValueOnce(null);

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
        },
      });

      // Assert
      expect(logicMock.getMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(JSON.parse(response.body)).toEqual({});
      expect(response.statusCode).toBe(200);
    });
  });

  describe('create message', () => {
    it('when object message created, responds with 200 and message details', async () => {
      // Arrange
      logicMock.createMessage.mockResolvedValueOnce(undefined);

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          message: 'testMessage',
        },
      });

      // Assert
      expect(logicMock.createMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        message: JSON.stringify({ message: 'testMessage' }),
      });
      expect(response.body).toEqual('');
      expect(response.statusCode).toBe(200);
    });

    it('when primitive message created, responds with 200 and message details', async () => {
      // Arrange
      logicMock.createMessage.mockResolvedValueOnce(undefined);

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
          'content-type': 'text/plain',
        },
        payload: '123',
      });

      // Assert
      expect(logicMock.createMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        message: '123',
      });
      expect(response.body).toEqual('');
      expect(response.statusCode).toBe(200);
    });

    it('when queue does not exist, responds with 404', async () => {
      // Arrange
      logicMock.createMessage.mockRejectedValueOnce(
        new QueueNotFoundError('test error'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          message: 'testMessage',
        },
      });

      // Assert
      expect(logicMock.createMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        message: JSON.stringify({ message: 'testMessage' }),
      });
      expect(response.statusCode).toBe(404);
    });

    it('when message creation fails, responds with 500', async () => {
      // Arrange
      logicMock.createMessage.mockRejectedValueOnce(new Error('testError'));

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          message: 'testMessage',
        },
      });

      // Assert
      expect(logicMock.createMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        message: JSON.stringify({ message: 'testMessage' }),
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'testError',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('remove message', () => {
    it('when queue exists, responds with 200', async () => {
      // Arrange
      logicMock.removeMessage.mockResolvedValueOnce(undefined);

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}/messageId`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
        },
      });

      // Assert
      expect(logicMock.removeMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        messageId: 'messageId',
      });
      expect(response.body).toEqual('');
      expect(response.statusCode).toBe(200);
    });

    it('when queue does not exist, responds with 404', async () => {
      // Arrange
      logicMock.removeMessage.mockRejectedValueOnce(
        new QueueNotFoundError('test error'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}/messageId`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
        },
      });

      // Assert
      expect(logicMock.removeMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        messageId: 'messageId',
      });
      expect(response.statusCode).toBe(404);
    });

    it('when message removal fails, responds with 500', async () => {
      // Arrange
      logicMock.removeMessage.mockRejectedValueOnce(new Error('testError'));

      // Act
      const response = await makeRequest({
        url: `/v1/message/${testQueueOrid}/messageId`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
        },
      });

      // Assert
      expect(logicMock.removeMessage).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        messageId: 'messageId',
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'testError',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });
});
