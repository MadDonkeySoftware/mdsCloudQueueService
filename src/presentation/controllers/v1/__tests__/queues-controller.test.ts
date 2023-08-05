import { asFunction, Lifetime } from 'awilix';
import { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../../../index';
import {
  QueueExistsError,
  QueueNotFoundError,
  QueueUpdateConditionError,
} from '../../../../core/errors';
import { validateToken } from '../../../hooks/validate-token';
import { IdentityJwt } from '../../../types/identity-jwt';

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
const mockValidateToken = jest.mocked(validateToken);

describe('queues controller test', () => {
  let app: FastifyInstance;
  const logicMock = {
    listQueues: jest.fn(),
    createQueue: jest.fn(),
    updateQueue: jest.fn(),
    deleteQueue: jest.fn(),
    getQueueDetails: jest.fn(),
  };
  const testQueueOrid = 'orid:1:testIssuer:::testAccountId:qs:testQueue';

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
    app = await buildApp(({ diContainer }) => {
      diContainer.register({
        logic: asFunction(() => logicMock, {
          lifetime: Lifetime.SCOPED,
        }),
      });
      return Promise.resolve();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('list queues', () => {
    it('when valid request, responds with 200 and list of queues', async () => {
      // Arrange
      logicMock.listQueues.mockResolvedValueOnce([
        'orid:1:testIssuer:::1000:qs:queue1',
        'orid:1:testIssuer:::1000:qs:queue2',
      ]);

      // Act
      const response = await makeRequest({
        url: '/v1/queues',
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.listQueues).toHaveBeenCalledWith('testAccountId');
      expect(JSON.parse(response.body)).toEqual([
        {
          name: 'queue1',
          orid: 'orid:1:testIssuer:::1000:qs:queue1',
        },
        {
          name: 'queue2',
          orid: 'orid:1:testIssuer:::1000:qs:queue2',
        },
      ]);
      expect(response.statusCode).toBe(200);
    });

    it('when valid system request, responds with 200 and list of all queues', async () => {
      // Arrange
      logicMock.listQueues.mockResolvedValueOnce([
        'orid:1:testIssuer:::1000:qs:queue1',
        'orid:1:testIssuer:::1000:qs:queue2',
      ]);
      mockValidateToken.mockImplementationOnce((req) => {
        req.parsedToken = {
          payload: {
            accountId: '1',
          },
        } as IdentityJwt;
        return Promise.resolve();
      });

      // Act
      const response = await makeRequest({
        url: '/v1/queues',
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.listQueues).toHaveBeenCalledWith();
      expect(JSON.parse(response.body)).toEqual([
        {
          name: 'queue1',
          orid: 'orid:1:testIssuer:::1000:qs:queue1',
        },
        {
          name: 'queue2',
          orid: 'orid:1:testIssuer:::1000:qs:queue2',
        },
      ]);
      expect(response.statusCode).toBe(200);
    });
  });

  describe('create queue', () => {
    it('when valid request, responds with 201 and created details', async () => {
      // Arrange
      logicMock.createQueue.mockResolvedValueOnce('newTestId');

      // Act
      const response = await makeRequest({
        url: '/v1/queue',
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
        },
      });

      // Assert
      expect(logicMock.createQueue).toHaveBeenCalledWith({
        accountId: 'testAccountId',
        delay: undefined,
        maxSize: undefined,
        meta: {
          dlq: undefined,
          resource: undefined,
        },
        name: 'testName',
        visibilityTimeout: undefined,
      });
      expect(JSON.parse(response.body)).toEqual({
        orid: 'newTestId',
        name: 'testName',
      });
      expect(response.statusCode).toBe(201);
    });

    it('when valid request including dlq and resource, responds with 201 and created details', async () => {
      // Arrange
      logicMock.createQueue.mockResolvedValueOnce('newTestId');

      // Act
      const response = await makeRequest({
        url: '/v1/queue',
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
          dlq: 'testDlq',
          resource: 'testResource',
        },
      });

      // Assert
      expect(logicMock.createQueue).toHaveBeenCalledWith({
        accountId: 'testAccountId',
        delay: undefined,
        maxSize: undefined,
        meta: {
          dlq: 'testDlq',
          resource: 'testResource',
        },
        name: 'testName',
        visibilityTimeout: undefined,
      });
      expect(JSON.parse(response.body)).toEqual({
        orid: 'newTestId',
        name: 'testName',
      });
      expect(response.statusCode).toBe(201);
    });

    it('when valid request and existing queue, responds with 200 and details', async () => {
      // Arrange
      logicMock.createQueue.mockRejectedValueOnce(
        new QueueExistsError('foo: newTestId'),
      );

      // Act
      const response = await makeRequest({
        url: '/v1/queue',
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
        },
      });

      // Assert
      expect(logicMock.createQueue).toHaveBeenCalledWith({
        accountId: 'testAccountId',
        delay: undefined,
        maxSize: undefined,
        meta: {
          dlq: undefined,
          resource: undefined,
        },
        name: 'testName',
        visibilityTimeout: undefined,
      });
      expect(JSON.parse(response.body)).toEqual({
        orid: 'newTestId',
        name: 'testName',
      });
      expect(response.statusCode).toBe(200);
    });

    it('does not hide other errors', async () => {
      // Arrange
      logicMock.createQueue.mockRejectedValueOnce(new Error('some error'));

      // Act
      const response = await makeRequest({
        url: '/v1/queue',
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          name: 'testName',
        },
      });

      // Assert
      expect(logicMock.createQueue).toHaveBeenCalledWith({
        accountId: 'testAccountId',
        delay: undefined,
        maxSize: undefined,
        meta: {
          dlq: undefined,
          resource: undefined,
        },
        name: 'testName',
        visibilityTimeout: undefined,
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'some error',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('update queue', () => {
    it('when valid request, responds with 200', async () => {
      // Arrange
      logicMock.updateQueue.mockResolvedValueOnce(undefined);

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          dlq: 'testDlq',
          resource: 'testResource',
        },
      });

      // Assert
      expect(logicMock.updateQueue).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        dlq: 'testDlq',
        resource: 'testResource',
      });
      expect(response.body).toBe('');
      expect(response.statusCode).toBe(200);
    });

    it('when logic throws condition error, responds with 400', async () => {
      // Arrange
      logicMock.updateQueue.mockRejectedValueOnce(
        new QueueUpdateConditionError('test message'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          dlq: 'testDlq',
          resource: 'testResource',
        },
      });

      // Assert
      expect(logicMock.updateQueue).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        dlq: 'testDlq',
        resource: 'testResource',
      });
      expect(JSON.parse(response.body)).toEqual({
        message: 'test message',
      });
      expect(response.statusCode).toBe(400);
    });

    it('when logic throws unknown error, responds with 500', async () => {
      // Arrange
      logicMock.updateQueue.mockRejectedValueOnce(new Error('test message'));

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}`,
        method: 'POST',
        headers: {
          token: 'testToken',
        },
        payload: {
          dlq: 'testDlq',
          resource: 'testResource',
        },
      });

      // Assert
      expect(logicMock.updateQueue).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
        dlq: 'testDlq',
        resource: 'testResource',
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'test message',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('delete queue', () => {
    it('when valid request, responds with 200', async () => {
      // Arrange
      logicMock.updateQueue.mockResolvedValueOnce(undefined);

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
        payload: {
          dlq: 'testDlq',
          resource: 'testResource',
        },
      });

      // Assert
      expect(logicMock.deleteQueue).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(response.body).toBe('');
      expect(response.statusCode).toBe(204);
    });

    it('when logic throws not found error, responds with 400', async () => {
      // Arrange
      logicMock.deleteQueue.mockRejectedValueOnce(
        new QueueNotFoundError('test message'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
        payload: {
          dlq: 'testDlq',
          resource: 'testResource',
        },
      });

      // Assert
      expect(logicMock.deleteQueue).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(response.statusCode).toBe(404);
    });

    it('when logic throws unknown error, responds with 500', async () => {
      // Arrange
      logicMock.deleteQueue.mockRejectedValueOnce(new Error('test message'));

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}`,
        method: 'DELETE',
        headers: {
          token: 'testToken',
        },
        payload: {
          dlq: 'testDlq',
          resource: 'testResource',
        },
      });

      // Assert
      expect(logicMock.deleteQueue).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'test message',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('get queue details', () => {
    it('when valid request, responds with 200', async () => {
      // Arrange
      logicMock.getQueueDetails.mockResolvedValueOnce({
        orid: testQueueOrid,
        meta: {
          resource: 'testResource',
          dlq: 'testDlq',
        },
      });

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}/details`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getQueueDetails).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(JSON.parse(response.body)).toEqual({
        orid: testQueueOrid,
        resource: 'testResource',
        dlq: 'testDlq',
      });
      expect(response.statusCode).toBe(200);
    });

    it('when logic throws not found error, responds with 400', async () => {
      // Arrange
      logicMock.getQueueDetails.mockRejectedValueOnce(
        new QueueNotFoundError('test message'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}/details`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getQueueDetails).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(response.statusCode).toBe(404);
    });

    it('when logic throws unknown error, responds with 500', async () => {
      // Arrange
      logicMock.getQueueDetails.mockRejectedValueOnce(
        new Error('test message'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}/details`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getQueueDetails).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'test message',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });

  describe('get queue length', () => {
    it('when valid request, responds with 200', async () => {
      // Arrange
      logicMock.getQueueDetails.mockResolvedValueOnce({
        orid: testQueueOrid,
        currentMessages: 10,
      });

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}/length`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getQueueDetails).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(JSON.parse(response.body)).toEqual({
        orid: testQueueOrid,
        size: 10,
      });
      expect(response.statusCode).toBe(200);
    });

    it('when logic throws not found error, responds with 400', async () => {
      // Arrange
      logicMock.getQueueDetails.mockRejectedValueOnce(
        new QueueNotFoundError('test message'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}/length`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getQueueDetails).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(response.statusCode).toBe(404);
    });

    it('when logic throws unknown error, responds with 500', async () => {
      // Arrange
      logicMock.getQueueDetails.mockRejectedValueOnce(
        new Error('test message'),
      );

      // Act
      const response = await makeRequest({
        url: `/v1/queue/${testQueueOrid}/length`,
        method: 'GET',
        headers: {
          token: 'testToken',
        },
      });

      // Assert
      expect(logicMock.getQueueDetails).toHaveBeenCalledWith({
        queueOrid: testQueueOrid,
      });
      expect(JSON.parse(response.body)).toEqual({
        error: 'Internal Server Error',
        message: 'test message',
        statusCode: 500,
      });
      expect(response.statusCode).toBe(500);
    });
  });
});
