const sinon = require('sinon');
const chai = require('chai');
const proxyquire = require('proxyquire');
const { testWithSafeEnv } = require('../test-utilities');

const verifyModuleMethodsExist = (underTest) => {
  chai.expect(underTest.handleAppShutdown).to.not.be.equal(undefined);
  chai.expect(underTest.listQueues).to.not.be.equal(undefined);
  chai.expect(underTest.createQueue).to.not.be.equal(undefined);
  chai.expect(underTest.removeQueue).to.not.be.equal(undefined);
  chai.expect(underTest.getMessage).to.not.be.equal(undefined);
  chai.expect(underTest.createMessage).to.not.be.equal(undefined);
  chai.expect(underTest.removeMessage).to.not.be.equal(undefined);
  chai.expect(underTest.getQueueSize).to.not.be.equal(undefined);
  chai.expect(underTest.setValueForKey).to.not.be.equal(undefined);
  chai.expect(underTest.getValueForKey).to.not.be.equal(undefined);
  chai.expect(underTest.removeKey).to.not.be.equal(undefined);
  chai.expect(underTest.acquireLock).to.not.be.equal(undefined);
  chai.expect(underTest.isLocked).to.not.be.equal(undefined);
  chai.expect(underTest.releaseLock).to.not.be.equal(undefined);
};

describe('src/repos/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('when db url not set initializes redis', () => {
    // Arrange
    const createConnectionBundleStub = sinon.stub();

    // Act
    const localModule = proxyquire('.', {
      './redis': {
        createConnectionBundle: createConnectionBundleStub,
      },
    });

    // Assert
    chai.expect(createConnectionBundleStub.callCount).to.equal(1);
    verifyModuleMethodsExist(localModule);
  });

  it('when db url set to redis initializes redis', () => testWithSafeEnv({
    MDS_QS_DB_URL: 'redis://127.0.0.1',
  }, () => {
    // Arrange
    const createConnectionBundleStub = sinon.stub();

    // Act
    const localModule = proxyquire('.', {
      './redis': {
        createConnectionBundle: createConnectionBundleStub,
      },
    });

    // Assert
    chai.expect(createConnectionBundleStub.callCount).to.equal(1);
    verifyModuleMethodsExist(localModule);
  }));

  it('when db url set to redis initializes redis', () => testWithSafeEnv({
    MDS_QS_DB_URL: 'mysql://127.0.0.1',
  }, () => {
    // Arrange
    const createConnectionBundleStub = sinon.stub();

    // Act
    try {
      proxyquire('.', {
        './redis': {
          createConnectionBundle: createConnectionBundleStub,
        },
      });
    } catch (err) {
      chai.expect(err.message).to.be.equal('Database not configured properly. "mysql://127.0.0.1" not understood.');
    }

    // Assert
    chai.expect(createConnectionBundleStub.callCount).to.equal(0);
  }));
});
