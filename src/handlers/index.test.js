const supertest = require('supertest');
const sinon = require('sinon');
const chai = require('chai');

const repos = require('../repos');
const appShutdown = require('./app_shutdown');
const globals = require('../globals');
const resourceInvoker = require('./resource_invoker');

const src = require('..');

const getStubbedRepo = () => ({
  handleAppShutdown: sinon.stub(repos, 'handleAppShutdown'),
  listQueues: sinon.stub(repos, 'listQueues'),
  createQueue: sinon.stub(repos, 'createQueue'),
  removeQueue: sinon.stub(repos, 'removeQueue'),
  getMessage: sinon.stub(repos, 'getMessage'),
  createMessage: sinon.stub(repos, 'createMessage'),
  removeMessage: sinon.stub(repos, 'removeMessage'),
  getQueueSize: sinon.stub(repos, 'getQueueSize'),
  setValueForKey: sinon.stub(repos, 'setValueForKey'),
  getValueForKey: sinon.stub(repos, 'getValueForKey'),
  removeKey: sinon.stub(repos, 'removeKey'),
  acquireLock: sinon.stub(repos, 'acquireLock'),
  isLocked: sinon.stub(repos, 'isLocked'),
  releaseLock: sinon.stub(repos, 'releaseLock'),
});

describe('src/handlers/index', () => {
  beforeEach(() => {
    sinon.stub(appShutdown, 'wire');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('lists queues when queried', () => {
    // Arrange
    const app = src.buildApp();
    const repoStubs = getStubbedRepo();
    repoStubs.listQueues.resolves(['one', 'two', 'three']);

    // Act / Assert
    return supertest(app)
      .get('/queues')
      .expect('content-type', /application\/json/)
      .expect(200, ['one', 'two', 'three']);
  });

  describe('creates queue', () => {
    it('when queue does not exist it creates a queue', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['one', 'two', 'three']);
      repoStubs.createQueue.resolves(1);

      // Act / Assert
      return supertest(app)
        .post('/queue')
        .send({ name: 'test', resource: 'http://127.0.0.1/abc/invoke' })
        .expect(201)
        .then(() => {
          chai.expect(repoStubs.createQueue.callCount).to.equal(1);
          chai.expect(repoStubs.createQueue.firstCall.args[0]).to.equal('test');
          chai.expect(repoStubs.createQueue.firstCall.args[1]).to.equal();
          chai.expect(repoStubs.createQueue.firstCall.args[2]).to.equal();
          chai.expect(repoStubs.createQueue.firstCall.args[3]).to.equal();
          chai.expect(repoStubs.setValueForKey.firstCall.args[0]).to.equal('queue-meta:test');
          chai.expect(repoStubs.setValueForKey.firstCall.args[1]).to.deep.equal(JSON.stringify({
            resource: 'http://127.0.0.1/abc/invoke',
          }));
        });
    });

    it('when queue does exist it does not creates a queue', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['one', 'two', 'three', 'test']);
      repoStubs.createQueue.resolves(1);

      // Act / Assert
      return supertest(app)
        .post('/queue')
        .send({ name: 'test' })
        .expect(204);
    });
  });

  describe('update queue', () => {
    it('updates the queue metadata', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.getValueForKey.resolves('{ "other": "value" }');

      // Act / Assert
      return supertest(app)
        .post('/queue/test')
        .send({ resource: 'http://127.0.0.1/abc/invoke' })
        .expect(200)
        .then(() => {
          chai.expect(repoStubs.setValueForKey.firstCall.args[0]).to.equal('queue-meta:test');
          chai.expect(repoStubs.setValueForKey.firstCall.args[1]).to.deep.equal(JSON.stringify({
            other: 'value',
            resource: 'http://127.0.0.1/abc/invoke',
          }));
        });
    });

    it('un-sets the queue metadata', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.getValueForKey.resolves('{ "resource": "fooBar", "other": "value" }');

      // Act / Assert
      return supertest(app)
        .post('/queue/test')
        .send({ resource: null })
        .expect(200)
        .then(() => {
          chai.expect(repoStubs.setValueForKey.firstCall.args[0]).to.equal('queue-meta:test');
          chai.expect(repoStubs.setValueForKey.firstCall.args[1]).to.deep.equal(JSON.stringify({
            other: 'value',
          }));
        });
    });
  });

  describe('delete queue', () => {
    it('removes the queue when it exists', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.removeQueue.resolves(1);
      repoStubs.removeKey.resolves(true);
      repoStubs.listQueues.resolves(['test']);

      // Act / Assert
      return supertest(app)
        .delete('/queue/test')
        .expect(204)
        .then(() => {
          chai.expect(repoStubs.removeQueue.firstCall.args[0]).to.equal('test');
          chai.expect(repoStubs.removeKey.firstCall.args[0]).to.equal('queue-meta:test');
        });
    });

    it('does nothing when the queue does not exist', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['something']);

      // Act / Assert
      return supertest(app)
        .delete('/queue/test')
        .expect(404)
        .then(() => {
          chai.expect(repoStubs.removeQueue.callCount).to.equal(0);
          chai.expect(repoStubs.removeKey.callCount).to.equal(0);
        });
    });
  });

  describe('get queue details', () => {
    it('returns queue details when queue exists without metadata', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['test', 'test2']);
      repoStubs.getValueForKey.resolves();

      // Act / Assert
      return supertest(app)
        .get('/queue/test/details')
        .expect(200, {});
    });

    it('returns queue details when queue exists with metadata', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['test', 'test2']);
      repoStubs.getValueForKey.resolves('{"resource":"resource"}');

      // Act / Assert
      return supertest(app)
        .get('/queue/test/details')
        .expect(200, { resource: 'resource' });
    });
  });

  describe('get message count for queue', () => {
    it('returns when queue exists', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['test', 'test2']);
      repoStubs.getQueueSize.resolves(11);

      // Act / Assert
      return supertest(app)
        .get('/queue/test/length')
        .expect(200, { size: 11 });
    });

    it('returns 404 when queue does not exist', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['test', 'test2']);
      repoStubs.getQueueSize.rejects();

      // Act / Assert
      return supertest(app)
        .get('/queue/test3/length')
        .expect(404);
    });
  });

  describe('get message from queue', () => {
    it('returns when queue exists', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.getMessage.resolves({ id: 1 });

      // Act / Assert
      return supertest(app)
        .get('/queue/test/message')
        .expect(200, { id: 1 });
    });

    it('returns 404 when queue does not exist', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.getMessage.rejects({ name: 'queueNotFound' });

      // Act / Assert
      return supertest(app)
        .get('/queue/test/message')
        .expect(404);
    });

    it('returns 500 when dependency throws error', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.getMessage.rejects({ name: 'someError' });
      sinon.stub(globals, 'getLogger').returns({ warn: sinon.stub() });

      // Act / Assert
      return supertest(app)
        .get('/queue/test/message')
        .expect(500);
    });
  });

  describe('create message in queue', () => {
    it('successful when queue exists', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.createMessage.resolves('ok');
      const invokerStub = sinon.stub(resourceInvoker, 'invokeResourceUntilEmpty');
      invokerStub.returns();

      // Act / Assert
      return supertest(app)
        .post('/queue/test/message')
        .send({ key: 'testMessage' })
        .expect(200);
    });
  });

  describe('remove message from queue', () => {
    it('successful when message exists', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.removeMessage.resolves(1);
      const invokerStub = sinon.stub(resourceInvoker, 'invokeResourceUntilEmpty');
      invokerStub.returns();

      // Act / Assert
      return supertest(app)
        .delete('/queue/test/message/123')
        .expect(200);
    });

    it('not found when message does not exists', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.removeMessage.resolves(0);
      const invokerStub = sinon.stub(resourceInvoker, 'invokeResourceUntilEmpty');
      invokerStub.returns();

      // Act / Assert
      return supertest(app)
        .delete('/queue/test/message/123')
        .expect(404);
    });
  });

  /*
router.delete('/queue/:qid/message/:id', removeMessage); // deletes a message from the system
  */
});
