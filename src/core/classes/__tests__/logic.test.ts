import { Logic } from '../logic';
import { CreateQueueArgs } from '../../interfaces/queue-repo';

describe('logic', () => {
  let logic: Logic;
  const mockQueueRepo = {
    listQueues: jest.fn(),
    createQueue: jest.fn(),
    updateQueue: jest.fn(),
    removeQueue: jest.fn(),
    getQueueDetails: jest.fn(),
    createMessage: jest.fn(),
    getMessage: jest.fn(),
    removeMessage: jest.fn().mockResolvedValue(1),
    healthChecks: jest.fn(),
  };

  beforeAll(() => {
    logic = new Logic({ queueRepo: mockQueueRepo });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listQueues', () => {
    it('passes undefined argument to repo and returns results', async () => {
      // Arrange
      mockQueueRepo.listQueues.mockResolvedValueOnce(['queue1', 'queue2']);

      // Act
      const result = await logic.listQueues();

      // Assert
      expect(mockQueueRepo.listQueues).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.listQueues).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(['queue1', 'queue2']);
    });

    it('passes argument to repo and returns results', async () => {
      // Arrange
      mockQueueRepo.listQueues.mockResolvedValueOnce(['queue1', 'queue2']);

      // Act
      const result = await logic.listQueues('accountId');

      // Assert
      expect(mockQueueRepo.listQueues).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.listQueues).toHaveBeenCalledWith('accountId');
      expect(result).toEqual(['queue1', 'queue2']);
    });
  });

  describe('createQueue', () => {
    it('when name is invalid, throws InvalidNameError', async () => {
      // Arrange
      const testQueueName = 'invalid name';
      const args: CreateQueueArgs & { accountId: string } = {
        accountId: 'accountId',
        name: testQueueName,
        meta: {
          resource: 'resource',
          dlq: 'dlq',
        },
      };

      // Act & Assert
      await expect(
        logic.createQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Queue name invalid. Criteria: maximum length 50 characters, alphanumeric and hyphen only."`,
      );
      expect(mockQueueRepo.listQueues).toHaveBeenCalledTimes(0);
      expect(mockQueueRepo.createQueue).toHaveBeenCalledTimes(0);
    });

    it('when queue already exists, throws QueueExistsError', async () => {
      // Arrange
      const testQueueName = 'testQueueName';
      const testQueueOrid = `orid:1:testIssuer:::accountId:qs:${testQueueName}`;
      mockQueueRepo.listQueues.mockResolvedValueOnce([testQueueOrid]);
      const args: CreateQueueArgs & { accountId: string } = {
        accountId: 'accountId',
        name: testQueueName,
        meta: {
          resource: 'resource',
          dlq: 'dlq',
        },
      };

      // Act & Assert
      await expect(
        logic.createQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Queue already exists: orid:1:testIssuer:::accountId:qs:testQueueName"`,
      );
      expect(mockQueueRepo.listQueues).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.createQueue).toHaveBeenCalledTimes(0);
    });

    it('when valid parameters, returns queue orid', async () => {
      // Arrange
      const testQueueName = 'testQueueName';
      const testQueueOrid = `orid:1:testIssuer:::accountId:qs:${testQueueName}`;
      mockQueueRepo.listQueues.mockResolvedValueOnce([]);
      mockQueueRepo.createQueue.mockResolvedValueOnce(undefined);
      const args: CreateQueueArgs & { accountId: string } = {
        accountId: 'accountId',
        name: testQueueName,
        meta: {
          resource: 'resource',
          dlq: 'dlq',
        },
      };

      // Act
      const response = await logic.createQueue(args);

      // Assert
      expect(mockQueueRepo.createQueue).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.createQueue).toHaveBeenCalledWith({
        ...args,
        name: testQueueOrid,
      });
      expect(response).toEqual(testQueueOrid);
    });
  });

  describe('updateQueue', () => {
    it('when all parameters valid, updates queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        dlq: 'orid:1:testIssuer:::accountId:qs:testDlqName',
        resource: 'orid:1:testIssuer:::accountId:sf:testResourceName',
      };

      // Act & Assert
      await expect(logic.updateQueue(args)).resolves.not.toThrow();
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledWith(args);
    });

    it('when dlq and resource are null, updates queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        dlq: null,
        resource: null,
      };

      // Act & Assert
      await expect(logic.updateQueue(args)).resolves.not.toThrow();
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledWith(args);
    });

    it('when dlq and resource are undefined, updates queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
      };

      // Act & Assert
      await expect(logic.updateQueue(args)).resolves.not.toThrow();
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledWith(args);
    });

    it('when resource parameter invalid, throws error and does not create queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        dlq: 'orid:1:testIssuer:::accountId:qs:testDlqName',
        resource: 'orid:1:testIssuer:::accountId:qs:testResourceName',
      };

      // Act & Assert
      await expect(
        logic.updateQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Resource must be one of the following types: sf, sm"`,
      );
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(0);
    });

    it('when dlq parameter invalid, throws error and does not create queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        dlq: 'orid:1:testIssuer:::accountId:sf:testDlqName',
        resource: 'orid:1:testIssuer:::accountId:sf:testResourceName',
      };

      // Act & Assert
      await expect(
        logic.updateQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"DLQ must be a queue"`);
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(0);
    });

    it('when dlq is invalid orid, throws error and does not create queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        dlq: 'trash',
        resource: 'orid:1:testIssuer:::accountId:sf:testResourceName',
      };

      // Act & Assert
      await expect(
        logic.updateQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"dlq must be a valid orid"`,
      );
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(0);
    });

    it('when resource is invalid orid, throws error and does not create queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        dlq: 'orid:1:testIssuer:::accountId:qs:testDlqName',
        resource: 'trash',
      };

      // Act & Assert
      await expect(
        logic.updateQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"resource must be a valid orid"`,
      );
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(0);
    });

    it('when resource provided but dlq omitted, throws error and does not create queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        resource: 'orid:1:testIssuer:::accountId:sf:testResourceName',
      };

      // Act & Assert
      await expect(
        logic.updateQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"When using resource or dlq both resource and dlq must be provided"`,
      );
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(0);
    });

    it('when dlq provided but resource omitted, throws error and does not create queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        dlq: 'orid:1:testIssuer:::accountId:qs:testDlqName',
      };

      // Act & Assert
      await expect(
        logic.updateQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"When using resource or dlq both resource and dlq must be provided"`,
      );
      expect(mockQueueRepo.updateQueue).toHaveBeenCalledTimes(0);
    });
  });

  describe('deleteQueue', () => {
    it('when valid queue orid, deletes queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
      };
      mockQueueRepo.listQueues.mockResolvedValueOnce([testQueueOrid]);

      // Act & Assert
      await expect(logic.deleteQueue(args)).resolves.not.toThrow();
      expect(mockQueueRepo.removeQueue).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.removeQueue).toHaveBeenCalledWith(args);
    });

    it('when invalid queue orid, throws error and does not delete queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
      };
      mockQueueRepo.listQueues.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        logic.deleteQueue(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Queue does not exists: orid:1:testIssuer:::accountId:qs:testQueueName"`,
      );
      expect(mockQueueRepo.removeQueue).toHaveBeenCalledTimes(0);
    });
  });

  describe('getQueueDetails', () => {
    it('when valid queue orid, returns queue details', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
      };
      mockQueueRepo.listQueues.mockResolvedValueOnce([testQueueOrid]);
      mockQueueRepo.getQueueDetails.mockResolvedValueOnce({
        orid: testQueueOrid,
        name: 'testQueueName',
        dlq: 'orid:1:testIssuer:::accountId:qs:testDlqName',
        resource: 'orid:1:testIssuer:::accountId:sf:testResourceName',
      });

      // Act & Assert
      await expect(logic.getQueueDetails(args)).resolves.not.toThrow();
      expect(mockQueueRepo.getQueueDetails).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.getQueueDetails).toHaveBeenCalledWith(args);
    });

    it('when invalid queue orid, throws error and does not return queue details', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
      };
      mockQueueRepo.listQueues.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        logic.getQueueDetails(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Queue does not exists: orid:1:testIssuer:::accountId:qs:testQueueName"`,
      );
      expect(mockQueueRepo.getQueueDetails).toHaveBeenCalledTimes(0);
    });
  });

  describe('createMessage', () => {
    it('when valid queue orid, creates message', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        message: 'testMessage',
      };
      mockQueueRepo.listQueues.mockResolvedValueOnce([testQueueOrid]);

      // Act & Assert
      await expect(logic.createMessage(args)).resolves.not.toThrow();
      expect(mockQueueRepo.createMessage).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.createMessage).toHaveBeenCalledWith(args);
    });

    it('when invalid queue orid, throws error and does not create message', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
        message: 'testMessage',
      };
      mockQueueRepo.listQueues.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        logic.createMessage(args),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Queue does not exists: orid:1:testIssuer:::accountId:qs:testQueueName"`,
      );
      expect(mockQueueRepo.createMessage).toHaveBeenCalledTimes(0);
    });
  });

  describe('getMessage', () => {
    it('retrieves message from queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        queueOrid: testQueueOrid,
      };
      mockQueueRepo.getMessage.mockResolvedValueOnce({
        id: 'testId',
        message: 'testMessage',
      });

      // Act
      const message = await logic.getMessage(args);

      // Assert
      expect(message).toEqual({
        id: 'testId',
        message: 'testMessage',
      });
      expect(mockQueueRepo.getMessage).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.getMessage).toHaveBeenCalledWith(args);
    });
  });

  describe('removeMessage', () => {
    it('removes message from queue', async () => {
      // Arrange
      const testQueueOrid = 'orid:1:testIssuer:::accountId:qs:testQueueName';
      const args = {
        messageId: 'testId',
        queueOrid: testQueueOrid,
      };

      // Act & Assert
      await expect(logic.removeMessage(args)).resolves.not.toThrow();
      expect(mockQueueRepo.removeMessage).toHaveBeenCalledTimes(1);
      expect(mockQueueRepo.removeMessage).toHaveBeenCalledWith(args);
    });
  });

  describe('healthChecks', () => {
    it('returns health checks', async () => {
      // Arrange
      mockQueueRepo.healthChecks.mockResolvedValueOnce({
        redisStatus: 'OK',
        queueStatus: 'OK',
      });

      // Act
      const healthChecks = await logic.healthChecks();

      // Assert
      expect(healthChecks).toEqual({
        redisStatus: 'OK',
        queueStatus: 'OK',
      });
      expect(mockQueueRepo.healthChecks).toHaveBeenCalledTimes(1);
    });
  });
});
