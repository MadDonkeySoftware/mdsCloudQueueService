const sinon = require('sinon');
const chai = require('chai');

const got = require('got');
const repos = require('../repos');
const globals = require('../globals');
const { testWithSafeEnv } = require('../test-utilities');
const resourceInvoker = require('./resource_invoker');

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

describe('src/handlers/resource_invoker', () => {
  beforeEach(() => {
    sinon.stub(globals, 'getLogger').returns({
      trace: sinon.stub(),
      warn: sinon.stub(),
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('invokeResourceUntilEmpty', () => {
    it('does nothing when queue has no metadata', () => {
      // Arrange
      const postStub = sinon.stub(got, 'post');
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(false);
      repoStub.getValueForKey.resolves('');

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(postStub.callCount).to.equal(0);
      });
    });

    it('does nothing when queue has empty metadata', () => {
      // Arrange
      const postStub = sinon.stub(got, 'post');
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(false);
      repoStub.getValueForKey.resolves('{}');

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(postStub.callCount).to.equal(0);
      });
    });

    it('does nothing when queue has empty metadata resource', () => {
      // Arrange
      const postStub = sinon.stub(got, 'post');
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(false);
      repoStub.getValueForKey.resolves('{ "something": "else" }');

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(postStub.callCount).to.equal(0);
      });
    });

    it('does nothing when event firing is disabled', () => testWithSafeEnv({
      DISABLE_FIRE_EVENTS: 'true',
    }, () => {
      // Arrange
      const postStub = sinon.stub(got, 'post');
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(false);
      repoStub.getValueForKey.resolves('{ "something": "else" }');

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(postStub.callCount).to.equal(0);
      });
    }));

    it('does nothing when queue is locked', () => {
      // Arrange
      const postStub = sinon.stub(got, 'post');
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(true);

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(postStub.callCount).to.equal(0);
      });
    });

    describe('metadata has resource', () => {
      it('invokes once when one message available', () => {
        // Arrange
        const postStub = sinon.stub(got, 'post');
        postStub.resolves();

        const repoStub = getStubbedRepo();
        repoStub.isLocked.resolves(false);
        repoStub.getValueForKey.resolves('{ "resource": "http://127.0.0.1/invoke/123" }');
        repoStub.getQueueSize.onCall(0).resolves(2);
        repoStub.getQueueSize.onCall(1).resolves(1);
        repoStub.getQueueSize.onCall(2).resolves(0);

        // Act
        return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
          // Assert
          chai.expect(postStub.callCount).to.equal(2);
        });
      });
    });
  });
});
