const _ = require('lodash');
const axios = require('axios');
const orid = require('@maddonkeysoftware/orid-node');
const jwt = require('jsonwebtoken');
const urlJoin = require('url-join');

let SIGNATURE;

const getIssuer = () => process.env.ORID_PROVIDER_KEY || 'mdsCloudQueueService';

const getAppPublicSignature = async () => {
  if (!SIGNATURE) {
    const url = urlJoin(process.env.MDS_IDENTITY_URL || 'http://localhost', 'v1', 'publicSignature');
    const resp = await axios.get(url);
    SIGNATURE = _.get(resp, ['data', 'signature']);
  }
  return SIGNATURE;
};

const sendResponse = (response, status, body) => {
  response.status(status || 200);
  response.send(body);
  return Promise.resolve();
};

const getOridFromRequest = (request, key) => {
  const { params } = request;
  const input = `${params[key]}${params[0] || ''}`;
  const reqOrid = orid.v1.isValid(input) ? orid.v1.parse(input) : undefined;

  return reqOrid;
};

const validateToken = async (request, response, next) => {
  const { headers } = request;
  const { token } = headers;
  if (!token) {
    return sendResponse(response, 403);
  }

  try {
    // NOTE: We use the exported version of the file to allow down stream testers to easily stub.
    const publicSignature = await module.exports.getAppPublicSignature();
    const parsedToken = jwt.verify(token, publicSignature, { complete: true });
    if (parsedToken && parsedToken.payload.iss === getIssuer()) {
      request.parsedToken = parsedToken;
    } else {
      return sendResponse(response, 403);
    }
  } catch (err) {
    return sendResponse(response, 403);
  }
  return next();
};

const ensureRequestOrid = (withRider, key) => (request, response, next) => {
  const reqOrid = getOridFromRequest(request, key);

  if (!reqOrid || (withRider && !reqOrid.resourceRider)) {
    return sendResponse(response, 400);
  }

  return next();
};

const canAccessResource = (oridKey) => (request, response, next) => {
  const reqOrid = getOridFromRequest(request, oridKey);

  const tokenAccountId = _.get(request, ['parsedToken', 'payload', 'accountId']);
  if (tokenAccountId !== reqOrid.custom3 && tokenAccountId !== '1') {
    return sendResponse(response, 403);
  }

  return next();
};

module.exports = {
  getIssuer,
  getAppPublicSignature,
  sendResponse,
  getOridFromRequest,
  validateToken,
  ensureRequestOrid,
  canAccessResource,
};
