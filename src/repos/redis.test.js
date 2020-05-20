const sinon = require('sinon');
const chai = require('chai');
const proxyquire = require('proxyquire');
const os = require('os');
const redis = require('redis');

const redisModule = require('./redis');

const successfulCallback = (expectedData) => {
  const impl = (...args) => {
    const cb = args[args.length - 1];
    Promise.resolve().then(() => { cb(undefined, expectedData); });
  };
  return impl;
};

const failedCallback = (expectedData) => {
  const impl = (...args) => {
    const cb = args[args.length - 1];
    Promise.resolve().then(() => { cb(expectedData, undefined); });
  };
  return impl;
};

describe('src/repos/redis', () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
    sinon.restore();
  });

  describe('createConnectionBundle', () => {
    it('Creates a new connection bundle configured with the defaults', () => {
      // Arrange
      const expectedRedisClient = {};
      const expectedRedisSMQ = {};
      const expectedRedisLock = {};
      sinon.stub(redis, 'createClient').returns(expectedRedisClient);

      // Act
      const localRedisModule = proxyquire('./redis', {
        'node-redis-lock': sinon.stub().returns(expectedRedisLock),
        rsmq: sinon.stub().returns(expectedRedisSMQ),
      });
      const result = localRedisModule.createConnectionBundle();

      // Assert
      chai.expect(result.redisClient).to.equal(expectedRedisClient);
      chai.expect(result.redisSMQ).to.equal(expectedRedisSMQ);
      chai.expect(result.redisLock).to.equal(expectedRedisLock);
    });
  });


  describe('handleAppShutdown', () => {
    it('Calls quit on bundle objects containing quit', () => {
      // Arrange
      const bundle = {
        decoy: {},
        redisClient: { quit: sinon.stub() },
        redisSMQ: { quit: sinon.stub() },
        redisLock: { quit: sinon.stub() },
      };

      // Act
      return redisModule.handleAppShutdown(bundle).then(() => {
        // Assert
        chai.expect(bundle.redisClient.quit.callCount).to.equal(1);
        chai.expect(bundle.redisSMQ.quit.callCount).to.equal(1);
        chai.expect(bundle.redisLock.quit.callCount).to.equal(1);
      });
    });
  });

  describe('listQueues', () => {
    it('returns available queues', () => {
      // Arrange
      const expectedData = [
        'test1',
        'test2',
        'test3',
      ];
      const bundle = {
        redisSMQ: {
          listQueues: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.listQueues(bundle).then((queues) => {
        // Assert
        chai.expect(queues).to.deep.equal(expectedData);
        chai.expect(bundle.redisSMQ.listQueues.callCount).to.equal(1);
      });
    });
  });

  describe('createQueue', () => {
    it('creates the queue from the provider', () => {
      // Arrange
      const expectedData = 1;
      const bundle = {
        redisSMQ: {
          createQueue: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.createQueue(bundle, 'testQueue', 1024, 0, 0).then((result) => {
        // Assert
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisSMQ.createQueue.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal({
          delay: 0,
          maxsize: 1024,
          qname: 'testQueue',
          vt: 0,
        });
      });
    });
  });

  describe('removeQueue', () => {
    it('removes the queue from the provider', () => {
      // Arrange
      const expectedData = 1;
      const bundle = {
        redisSMQ: {
          deleteQueue: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.removeQueue(bundle, 'testQueue').then((result) => {
        // Assert
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisSMQ.deleteQueue.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal({
          qname: 'testQueue',
        });
      });
    });
  });

  describe('getMessage', () => {
    it('gets a message from the provider', () => {
      // Arrange
      const expectedData = { msg: 'test' };
      const bundle = {
        redisSMQ: {
          receiveMessage: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.getMessage(bundle, 'testQueue').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisSMQ.receiveMessage.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal({
          qname: 'testQueue',
          vt: undefined,
        });
      });
    });
  });

  describe('createMessage', () => {
    it('creates message in queue', () => {
      // Arrange
      const expectedData = 'success';
      const bundle = {
        redisSMQ: {
          sendMessage: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.createMessage(bundle, 'testQueue', 'testMessage').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisSMQ.sendMessage.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal({
          qname: 'testQueue',
          message: 'testMessage',
          delay: undefined,
        });
      });
    });
  });

  describe('removeMessage', () => {
    it('deletes message in queue', () => {
      // Arrange
      const expectedData = 'success';
      const bundle = {
        redisSMQ: {
          deleteMessage: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.removeMessage(bundle, 'testQueue', '123').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisSMQ.deleteMessage.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal({
          qname: 'testQueue',
          id: '123',
        });
      });
    });
  });

  describe('getQueueSize', () => {
    it('returns the number of messages in the queue', () => {
      // Arrange
      const expectedData = 3;
      const bundle = {
        redisSMQ: {
          getQueueAttributes: sinon.fake(successfulCallback({ msgs: expectedData })),
        },
      };

      // Act
      return redisModule.getQueueSize(bundle, 'testQueue').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisSMQ.getQueueAttributes.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal({
          qname: 'testQueue',
        });
      });
    });
  });

  describe('setValueForKey', () => {
    it('sets a value for a key in the configured provider', () => {
      // Arrange
      const expectedData = 'ok';
      const bundle = {
        redisClient: {
          set: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.setValueForKey(bundle, 'testQueue', 'test').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisClient.set.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testQueue');
        chai.expect(calls[0].args[1]).to.deep.equal('test');
      });
    });
  });

  describe('getValueForKey', () => {
    it('gets a value for a key in the configured provider', () => {
      // Arrange
      const expectedData = 'test';
      const bundle = {
        redisClient: {
          get: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.getValueForKey(bundle, 'testQueue').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisClient.get.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testQueue');
      });
    });
  });

  describe('removeKey', () => {
    it('removes a key and value in the configured provider', () => {
      // Arrange
      const expectedData = 'ok';
      const bundle = {
        redisClient: {
          del: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.removeKey(bundle, 'testQueue').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisClient.del.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testQueue');
      });
    });
  });

  describe('acquireLock', () => {
    it('Returns true from promise when lock acquired successfully', () => {
      // Arrange
      const expectedData = true;
      const bundle = {
        redisLock: {
          acquire: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.acquireLock(bundle, 'testLock', 12).then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisLock.acquire.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testLock');
        chai.expect(calls[0].args[1]).to.deep.equal(12);
        chai.expect(calls[0].args[2]).to.deep.equal(`owned-by-${os.hostname()}`);
      });
    });

    it('Returns false from promise when lock not acquired successfully', () => {
      // Arrange
      const expectedData = false;
      const bundle = {
        redisLock: {
          acquire: sinon.fake(failedCallback('test error')),
        },
      };

      // Act
      return redisModule.acquireLock(bundle, 'testLock', 12).then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisLock.acquire.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testLock');
        chai.expect(calls[0].args[1]).to.deep.equal(12);
        chai.expect(calls[0].args[2]).to.deep.equal(`owned-by-${os.hostname()}`);
      });
    });
  });

  describe('isLocked', () => {
    it('Returns true from promise when lock present', () => {
      // Arrange
      const expectedData = true;
      const bundle = {
        redisLock: {
          isLocked: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.isLocked(bundle, 'testLock').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisLock.isLocked.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testLock');
      });
    });

    it('Returns false from promise when lock not present', () => {
      // Arrange
      const expectedData = false;
      const bundle = {
        redisLock: {
          isLocked: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.isLocked(bundle, 'testLock').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisLock.isLocked.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testLock');
      });
    });
  });

  describe('releaseLock', () => {
    it('Returns true from promise when lock released successfully', () => {
      // Arrange
      const expectedData = true;
      const bundle = {
        redisLock: {
          release: sinon.fake(successfulCallback(expectedData)),
        },
      };

      // Act
      return redisModule.releaseLock(bundle, 'testLock').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisLock.release.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testLock');
      });
    });

    it('Returns false from promise when lock not released successfully', () => {
      // Arrange
      const expectedData = false;
      const bundle = {
        redisLock: {
          release: sinon.fake(failedCallback('test error')),
        },
      };

      // Act
      return redisModule.releaseLock(bundle, 'testLock').then((result) => {
        chai.expect(result).to.deep.equal(expectedData);
        const calls = bundle.redisLock.release.getCalls();
        chai.expect(calls.length).to.equal(1);
        chai.expect(calls[0].args[0]).to.deep.equal('testLock');
      });
    });
  });
});
