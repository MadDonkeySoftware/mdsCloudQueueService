/* eslint-disable no-unused-expressions */
const chai = require('chai');
const sinon = require('sinon');
const axios = require('axios');

const handlerHelpers = require('./handler-helpers');

describe('globals', () => {
  describe('getAppPublicSignature', () => {
    it('Multiple calls call MDS_IDENTITY_URL once and returns the available signature', () => {
      // Arrange
      const previousMdsIdentityUrl = process.env.MDS_IDENTITY_URL;
      process.env.MDS_IDENTITY_URL = 'http://127.0.0.1:1234';
      const url = `${process.env.MDS_IDENTITY_URL}/v1/publicSignature`;
      const getStub = sinon.stub(axios, 'get');
      getStub.withArgs(url).resolves({ data: { signature: 'public-signature' } });

      // Act
      return handlerHelpers.getAppPublicSignature()
        .then((signature) => {
          // Assert
          chai.expect(signature).to.be.equal('public-signature');
          return handlerHelpers.getAppPublicSignature();
        })
        .then((signature) => {
          // Assert
          chai.expect(signature).to.be.equal('public-signature');
        })
        .finally(() => {
          // Assert
          process.env.MDS_IDENTITY_URL = previousMdsIdentityUrl;
          chai.expect(getStub.callCount).to.be.equal(1);
        });
    });
  });
});
