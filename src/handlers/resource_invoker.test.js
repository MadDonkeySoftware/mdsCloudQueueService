const sinon = require('sinon');
const chai = require('chai');
const mdsSdk = require('@maddonkeysoftware/mds-cloud-sdk-node');

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

describe(__filename, () => {
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
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(false);
      repoStub.getValueForKey.resolves('');
      const sfClient = {
        invokeFunction: sinon.stub().resolves(),
      };
      sinon.stub(mdsSdk, 'getServerlessFunctionsClient').resolves(sfClient);

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(sfClient.invokeFunction.callCount).to.equal(0);
      });
    });

    it('does nothing when queue has empty metadata', () => {
      // Arrange
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(false);
      repoStub.getValueForKey.resolves('{}');
      const sfClient = {
        invokeFunction: sinon.stub().resolves(),
      };
      sinon.stub(mdsSdk, 'getServerlessFunctionsClient').resolves(sfClient);

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(sfClient.invokeFunction.callCount).to.equal(0);
      });
    });

    it('does nothing when queue has empty metadata resource', () => {
      // Arrange
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(false);
      repoStub.getValueForKey.resolves('{ "something": "else" }');
      const sfClient = {
        invokeFunction: sinon.stub().resolves(),
      };
      sinon.stub(mdsSdk, 'getServerlessFunctionsClient').resolves(sfClient);

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(sfClient.invokeFunction.callCount).to.equal(0);
      });
    });

    it('does nothing when event firing is disabled', () =>
      testWithSafeEnv(
        {
          DISABLE_FIRE_EVENTS: 'true',
        },
        () => {
          // Arrange
          const repoStub = getStubbedRepo();
          repoStub.isLocked.resolves(false);
          repoStub.getValueForKey.resolves('{ "something": "else" }');
          const sfClient = {
            invokeFunction: sinon.stub().resolves(),
          };
          sinon.stub(mdsSdk, 'getServerlessFunctionsClient').resolves(sfClient);

          // Act
          return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
            // Assert
            chai.expect(sfClient.invokeFunction.callCount).to.equal(0);
          });
        },
      ));

    it('does nothing when queue is locked', () => {
      // Arrange
      const repoStub = getStubbedRepo();
      repoStub.isLocked.resolves(true);
      const sfClient = {
        invokeFunction: sinon.stub().resolves(),
      };
      sinon.stub(mdsSdk, 'getServerlessFunctionsClient').resolves(sfClient);

      // Act
      return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
        // Assert
        chai.expect(sfClient.invokeFunction.callCount).to.equal(0);
      });
    });

    describe('metadata has resource', () => {
      it('functions resource invokes twice when two messages available', () => {
        // Arrange
        const repoStub = getStubbedRepo();
        repoStub.isLocked.resolves(false);
        repoStub.getValueForKey.resolves(
          '{"resource":"orid:1:mdsCloud:::1001:sf:11111111-2222-3333-4444-555555555555"}',
        );
        repoStub.getQueueSize.onCall(0).resolves(2);
        repoStub.getQueueSize.onCall(1).resolves(1);
        repoStub.getQueueSize.onCall(2).resolves(0);
        repoStub.getMessage.onCall(0).resolves({ id: '1', message: '{}' });
        repoStub.getMessage.onCall(1).resolves({ id: '2', message: '{}' });
        const sfClient = {
          invokeFunction: sinon.stub().resolves(),
        };
        sinon.stub(mdsSdk, 'getServerlessFunctionsClient').resolves(sfClient);

        // Act
        return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
          // Assert
          chai.expect(sfClient.invokeFunction.callCount).to.equal(2);
          chai.expect(repoStub.removeMessage.callCount).to.equal(2);
        });
      });

      it('state machine resource invokes twice when two messages available', () => {
        // Arrange
        const repoStub = getStubbedRepo();
        repoStub.isLocked.resolves(false);
        repoStub.getValueForKey.resolves(
          '{"resource":"orid:1:mdsCloud:::1001:sm:11111111-2222-3333-4444-555555555555"}',
        );
        repoStub.getQueueSize.onCall(0).resolves(2);
        repoStub.getQueueSize.onCall(1).resolves(1);
        repoStub.getQueueSize.onCall(2).resolves(0);
        repoStub.getMessage.onCall(0).resolves({ id: '1', message: '{}' });
        repoStub.getMessage.onCall(1).resolves({ id: '2', message: '{}' });
        const smClient = {
          invokeStateMachine: sinon.stub().resolves(),
        };
        sinon.stub(mdsSdk, 'getStateMachineServiceClient').resolves(smClient);

        // Act
        return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
          // Assert
          chai.expect(smClient.invokeStateMachine.callCount).to.equal(2);
          chai.expect(repoStub.removeMessage.callCount).to.equal(2);
        });
      });

      it('moves message to DLQ when resource invoke fails', () => {
        // Arrange
        const repoStub = getStubbedRepo();
        repoStub.isLocked.resolves(false);
        repoStub.getValueForKey.resolves(
          '{"resource":"orid:1:mdsCloud:::1001:sf:11111111-2222-3333-4444-555555555555", "dlq":"orid:1:mdscloud:::1001:qs:test-dlq"}',
        );
        repoStub.getQueueSize.onCall(0).resolves(1);
        repoStub.getQueueSize.onCall(1).resolves(0);
        repoStub.getMessage.onCall(0).resolves({ id: '1', message: '{}' });
        repoStub.createMessage.resolves();
        const sfClient = {
          invokeFunction: sinon.stub().rejects(),
        };
        sinon.stub(mdsSdk, 'getServerlessFunctionsClient').resolves(sfClient);

        // Act
        return resourceInvoker.invokeResourceUntilEmpty('test').then(() => {
          // Assert
          chai.expect(sfClient.invokeFunction.callCount).to.equal(1);
          chai.expect(repoStub.removeMessage.callCount).to.equal(1);
          chai.expect(repoStub.createMessage.callCount).to.equal(1);
          chai
            .expect(repoStub.createMessage.getCall(0).args)
            .to.deep.equal(['orid_1_mdscloud___1001_qs_test-dlq', '{}']);
        });
      });
    });
  });
});
