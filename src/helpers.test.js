const sinon = require('sinon');
const chai = require('chai');

const helpers = require('./helpers');

describe(__filename, () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('oridToRepoName', () => {
    it('replaces colons with underscores', () => {
      chai.expect(helpers.oridToRepoName('test:name')).to.equal('test_name');
    });
  });

  describe('repoNameToOrid', () => {
    it('replaces underscores with colons', () => {
      chai.expect(helpers.repoNameToOrid('test_name')).to.equal('test:name');
    });
  });
});
