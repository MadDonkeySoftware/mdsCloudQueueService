const supertest = require('supertest');
const sinon = require('sinon');
const chai = require('chai');
const orid = require('@maddonkeysoftware/orid-node');

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

describe('src/handlers/v2', () => {
  beforeEach(() => {
    sinon.stub(appShutdown, 'wire');
  });

  afterEach(() => {
    sinon.restore();
  });

  const createExpectedOrid = (resourceId, resourceRider) => orid.v1.generate({
    provider: process.env.MDS_QS_PROVIDER_KEY,
    service: 'qs',
    custom3: 1, // TODO: Update after handling account
    resourceId,
    resourceRider,
  });

  it('lists queues when queried', () => {
    // Arrange
    const app = src.buildApp();
    const repoStubs = getStubbedRepo();
    repoStubs.listQueues.resolves(['orid_1_mdsCloud___1_qs_one', 'orid_1_mdsCloud___1_qs_two', 'orid_1_mdsCloud___1_qs_three']);

    // Act / Assert
    return supertest(app)
      .get('/v2/queues')
      .expect('content-type', /application\/json/)
      .expect(200, [
        { name: 'one', orid: 'orid:1:mdsCloud:::1:qs:one' },
        { name: 'two', orid: 'orid:1:mdsCloud:::1:qs:two' },
        { name: 'three', orid: 'orid:1:mdsCloud:::1:qs:three' },
      ]);
  });

  describe('creates queue', () => {
    const buildQueueName = (name) => `orid_1_${process.env.MDS_QS_PROVIDER_KEY || ''}___1_qs_${name}`;

    it('when queue does not exist it creates a queue', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves([buildQueueName('one'), buildQueueName('two'), buildQueueName('three')]);
      repoStubs.createQueue.resolves(1);

      // Act / Assert
      return supertest(app)
        .post('/v2/queue')
        .send({ name: 'test', resource: 'http://127.0.0.1/abc/invoke' })
        .expect(201, {
          name: 'test',
          orid: createExpectedOrid('test'),
        })
        .then(() => {
          chai.expect(repoStubs.createQueue.callCount).to.equal(1);
          chai.expect(repoStubs.createQueue.firstCall.args[0]).to.equal(buildQueueName('test'));
          chai.expect(repoStubs.createQueue.firstCall.args[1]).to.equal();
          chai.expect(repoStubs.createQueue.firstCall.args[2]).to.equal();
          chai.expect(repoStubs.createQueue.firstCall.args[3]).to.equal();
          chai.expect(repoStubs.setValueForKey.firstCall.args[0]).to.equal(`queue-meta:${buildQueueName('test')}`);
          chai.expect(repoStubs.setValueForKey.firstCall.args[1]).to.deep.equal(JSON.stringify({
            resource: 'http://127.0.0.1/abc/invoke',
          }));
        });
    });

    it('when queue does exist it does not creates a queue', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves([buildQueueName('one'), buildQueueName('two'), buildQueueName('test')]);
      repoStubs.createQueue.resolves(1);

      // Act / Assert
      return supertest(app)
        .post('/v2/queue')
        .send({ name: 'test' })
        .expect(200, {
          name: 'test',
          orid: createExpectedOrid('test'),
        });
    });

    it('when queue name invalid it does not creates a queue', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves([buildQueueName('one'), buildQueueName('two'), buildQueueName('test')]);
      repoStubs.createQueue.resolves(1);

      // Act / Assert
      return supertest(app)
        .post('/v2/queue')
        .send({ name: 'test_queue' })
        .expect(400, {
          message: 'Queue name invalid. Criteria: maximum length 50 characters, alphanumeric and hyphen only allowed.',
        });
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
        .post('/v2/queue/orid:1:mdsCloud:::1:qs:test')
        .send({ resource: 'http://127.0.0.1/abc/invoke' })
        .expect(200)
        .then(() => {
          chai.expect(repoStubs.setValueForKey.firstCall.args[0]).to.equal('queue-meta:orid_1_mdsCloud___1_qs_test');
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
        .post('/v2/queue/orid:1:mdsCloud:::1:qs:test')
        .send({ resource: null })
        .expect(200)
        .then(() => {
          chai.expect(repoStubs.setValueForKey.firstCall.args[0]).to.equal('queue-meta:orid_1_mdsCloud___1_qs_test');
          chai.expect(repoStubs.setValueForKey.firstCall.args[1]).to.deep.equal(JSON.stringify({
            other: 'value',
          }));
        });
    });

    it('returns bad request when orid not provided', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();

      // Act / Assert
      return supertest(app)
        .post('/v2/queue/test')
        .send({ resource: null })
        .expect(400)
        .then(() => {
          chai.expect(repoStubs.setValueForKey.callCount).to.eql(0);
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
      repoStubs.listQueues.resolves(['orid_1_mdsCloud___1_qs_test']);

      // Act / Assert
      return supertest(app)
        .delete('/v2/queue/orid:1:mdsCloud:::1:qs:test')
        .expect(204)
        .then(() => {
          chai.expect(repoStubs.removeQueue.firstCall.args[0]).to.equal('orid_1_mdsCloud___1_qs_test');
          chai.expect(repoStubs.removeKey.firstCall.args[0]).to.equal('queue-meta:orid_1_mdsCloud___1_qs_test');
        });
    });

    it('does nothing when the queue does not exist', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['something']);

      // Act / Assert
      return supertest(app)
        .delete('/v2/queue/orid:1:mdsCloud:::1:qs:test')
        .expect(404)
        .then(() => {
          chai.expect(repoStubs.removeQueue.callCount).to.equal(0);
          chai.expect(repoStubs.removeKey.callCount).to.equal(0);
        });
    });

    it('returns bad request when orid not provided', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();

      // Act / Assert
      return supertest(app)
        .delete('/v2/queue/test')
        .expect(400)
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
        .get('/v2/queue/orid:1:mdsCloud:::1:qs:test/details')
        .expect(200, {
          orid: 'orid:1:mdsCloud:::1:qs:test',
        });
    });

    it('returns queue details when queue exists with metadata', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['test', 'test2']);
      repoStubs.getValueForKey.resolves('{"resource":"resource"}');

      // Act / Assert
      return supertest(app)
        .get('/v2/queue/orid:1:mdsCloud:::1:qs:test/details')
        .expect(200, {
          orid: 'orid:1:mdsCloud:::1:qs:test',
          resource: 'resource',
        });
    });

    it('returns bad request when orid not provided', () => {
      // Arrange
      const app = src.buildApp();

      // Act / Assert
      return supertest(app)
        .get('/v2/queue/test/details')
        .expect(400);
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
        .get('/v2/queue/orid:1:mdsCloud:::1:qs:test/length')
        .expect(200, {
          size: 11,
          orid: 'orid:1:mdsCloud:::1:qs:test',
        });
    });

    it('returns 404 when queue does not exist', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.listQueues.resolves(['test', 'test2']);
      repoStubs.getQueueSize.rejects();

      // Act / Assert
      return supertest(app)
        .get('/v2/queue/orid:1:mdsCloud:::1:qs:test3/length')
        .expect(404);
    });

    it('returns bad request when orid not provided', () => {
      // Arrange
      const app = src.buildApp();

      // Act / Assert
      return supertest(app)
        .get('/v2/queue/test/length')
        .expect(400);
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
        .get('/v2/message/orid:1:mdsCloud:::1:qs:test')
        .expect(200, { id: 1 });
    });

    it('returns 404 when queue does not exist', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.getMessage.rejects({ name: 'queueNotFound' });

      // Act / Assert
      return supertest(app)
        .get('/v2/message/orid:1:mdsCloud:::1:qs:test')
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
        .get('/v2/message/orid:1:mdsCloud:::1:qs:test')
        .expect(500);
    });

    it('returns bad request when orid not provided', () => {
      // Arrange
      const app = src.buildApp();

      // Act / Assert
      return supertest(app)
        .get('/v2/message/test')
        .expect(400);
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
        .post('/v2/message/orid:1:mdsCloud:::1:qs:test')
        .send({ key: 'testMessage' })
        .expect(200);
    });

    it('returns bad request when orid not provided', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      const invokerStub = sinon.stub(resourceInvoker, 'invokeResourceUntilEmpty').returns();

      // Act / Assert
      return supertest(app)
        .get('/v2/message/test')
        .expect(400)
        .then(() => {
          chai.expect(repoStubs.createMessage.callCount).to.equal(0);
          chai.expect(invokerStub.callCount).to.equal(0);
        });
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
        .delete('/v2/message/orid:1:mdsCloud:::1:qs:test/123')
        .expect(200);
    });

    it('not found when message does not exists', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.removeMessage.resolves(0);
      const invokerStub = sinon.stub(resourceInvoker, 'invokeResourceUntilEmpty').returns();

      // Act / Assert
      return supertest(app)
        .delete('/v2/message/orid:1:mdsCloud:::1:qs:test/123')
        .expect(404)
        .then(() => {
          chai.expect(repoStubs.removeMessage.callCount).to.equal(1);
          chai.expect(invokerStub.callCount).to.equal(0);
        });
    });

    it('bad request when orid does not include message id (missing sub path)', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.removeMessage.resolves(0);
      const invokerStub = sinon.stub(resourceInvoker, 'invokeResourceUntilEmpty').returns();

      // Act / Assert
      return supertest(app)
        .delete('/v2/message/orid:1:mdsCloud:::1:qs:test')
        .expect(400)
        .then(() => {
          chai.expect(repoStubs.removeMessage.callCount).to.equal(0);
          chai.expect(invokerStub.callCount).to.equal(0);
        });
    });

    it('bad request when orid does not include message id (including sub path)', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      repoStubs.removeMessage.resolves(0);
      const invokerStub = sinon.stub(resourceInvoker, 'invokeResourceUntilEmpty').returns();

      // Act / Assert
      return supertest(app)
        .delete('/v2/message/orid:1:mdsCloud:::1:qs:test/')
        .expect(400)
        .then(() => {
          chai.expect(repoStubs.removeMessage.callCount).to.equal(0);
          chai.expect(invokerStub.callCount).to.equal(0);
        });
    });

    it('returns bad request when orid not provided', () => {
      // Arrange
      const app = src.buildApp();
      const repoStubs = getStubbedRepo();
      const invokerStub = sinon.stub(resourceInvoker, 'invokeResourceUntilEmpty').returns();

      // Act / Assert
      return supertest(app)
        .delete('/v2/message/test')
        .expect(400)
        .then(() => {
          chai.expect(repoStubs.removeMessage.callCount).to.equal(0);
          chai.expect(invokerStub.callCount).to.equal(0);
        });
    });
  });
});
