const _ = require('lodash');
const express = require('express');
const orid = require('@maddonkeysoftware/orid-node');
const repos = require('../repos');
const globals = require('../globals');
const resourceInvoker = require('./resource_invoker');

const router = express.Router();

const oridBase = {
  provider: process.env.MDS_QS_PROVIDER_KEY,
  custom3: 1, // TODO: Implement account
  service: 'qs',
};

const getOridFromRequest = (request) => {
  const { params } = request;
  const input = `${params.orid}${params[0] || ''}`;
  const reqOrid = orid.v1.isValid(input) ? orid.v1.parse(input) : undefined;

  return reqOrid;
};

const makeOrid = (name) => orid.v1.generate(_.merge({}, oridBase, {
  resourceId: name,
}));

const oridToRepoName = (inOrid) => inOrid.replace(/:/g, '_');
const repoNameToOrid = (inName) => inName.replace(/_/g, ':');

const sendResponse = (response, status, body) => {
  response.status(status || 200);
  response.send(body);
  return Promise.resolve();
};

const listQueues = (request, response) => repos.listQueues()
  .then((results) => results.map((e) => {
    const parsedOrid = orid.v1.parse(repoNameToOrid(e));
    return {
      name: parsedOrid.resourceId,
      orid: repoNameToOrid(e),
    };
  }))
  .then((result) => sendResponse(response, 200, JSON.stringify(result)));

const queueExists = (newName, queues) => queues.indexOf(newName) > -1;

const createQueue = (request, response) => {
  const logger = globals.getLogger();
  const {
    resource, name, maxSize, delay, vt,
  } = request.body;
  const queueMeta = JSON.stringify({
    resource,
  });

  const nameRegex = /^[a-zA-Z0-9-]*$/;
  if (!nameRegex.test(name) || name.length > 50) {
    sendResponse(response, 400, JSON.stringify({
      message: 'Queue name invalid. Criteria: maximum length 50 characters, alphanumeric and hyphen only allowed.',
    }));
    return Promise.resolve();
  }

  const newOrid = makeOrid(name);
  const escapedName = oridToRepoName(newOrid);

  const newQueue = (newName, size, mdelay, visTimeout) => (
    repos.createQueue(newName, size, mdelay, visTimeout)
      .then(() => repos.setValueForKey(`queue-meta:${newName}`, queueMeta))
      .then(() => true));

  const respObj = {
    name,
    orid: newOrid,
  };

  return repos.listQueues()
    .then((queues) => queueExists(escapedName, queues))
    .then((exists) => !exists && newQueue(escapedName, maxSize, delay, vt))
    .then((created) => sendResponse(response, created ? 201 : 200, JSON.stringify(respObj)))
    .catch((err) => {
      logger.error({ err }, 'Failed to create queue.');
      sendResponse(response, 500);
    });
};

const updateQueue = (request, response) => {
  const { body } = request;
  const { resource } = body;
  const reqOrid = getOridFromRequest(request);
  const escapedName = oridToRepoName(orid.v1.generate(reqOrid));

  const mergeWithFilter = (a, b) => (b === undefined ? a : undefined);
  const metaKey = `queue-meta:${escapedName}`;
  return repos.getValueForKey(metaKey)
    .then((currentMeta) => JSON.parse(currentMeta))
    .then((currentMeta) => _.mergeWith({}, currentMeta, { resource }, mergeWithFilter))
    .then((newMeta) => _.pickBy(newMeta, _.identity))
    .then((newMeta) => repos.setValueForKey(metaKey, JSON.stringify(newMeta)))
    .then(() => sendResponse(response));
};

const removeQueue = (request, response) => {
  const reqOrid = getOridFromRequest(request);
  const escapedName = oridToRepoName(orid.v1.generate(reqOrid));

  const deleteQueue = () => repos.removeQueue(escapedName)
    .then(() => repos.removeKey(`queue-meta:${escapedName}`));

  return repos.listQueues()
    .then((queues) => queueExists(escapedName, queues))
    .then((exists) => exists && deleteQueue())
    .then((deleted) => sendResponse(response, deleted ? 204 : 404));
};

const getQueueDetails = (request, response) => {
  const reqOrid = getOridFromRequest(request);
  const queueOrid = orid.v1.generate(reqOrid);
  const escapedName = oridToRepoName(queueOrid);

  return repos.getValueForKey(`queue-meta:${escapedName}`)
    .then((metadata) => metadata || '{}')
    .then((metadata) => {
      const meta = JSON.parse(metadata);
      return JSON.stringify(_.merge(
        {},
        meta,
        { orid: queueOrid },
      ));
    })
    .then((metadata) => sendResponse(response, 200, metadata));
};

const getMessageCount = (request, response) => {
  const reqOrid = getOridFromRequest(request);
  const queueOrid = orid.v1.generate(reqOrid);
  const escapedName = oridToRepoName(queueOrid);

  return repos.getQueueSize(escapedName)
    .then((size) => sendResponse(response, 200, JSON.stringify({
      size,
      orid: queueOrid,
    })))
    .catch(() => sendResponse(response, 404));
};

const getMessage = (request, response) => {
  const logger = globals.getLogger();

  const reqOrid = getOridFromRequest(request);
  const escapedName = oridToRepoName(orid.v1.generate(reqOrid));

  return repos.getMessage(escapedName)
    .then((message) => sendResponse(response, 200, message))
    .catch((err) => {
      if (err.name === 'queueNotFound') {
        sendResponse(response, 404);
        return;
      }

      logger.warn({ err }, 'Error occurred while attempting to get queue message.');
      sendResponse(response, 500);
    });
};

const createMessage = (request, response) => {
  const { body } = request;
  const message = JSON.stringify(body);

  const reqOrid = getOridFromRequest(request);
  const escapedName = oridToRepoName(orid.v1.generate(reqOrid));

  // TODO: Research if resource defined skip queue and invoke directly is option
  // May want to also entertain batching messages before sending them to defined
  // resource or incrementally invoking the resource with message batches while
  // the queue is above zero messages.
  return repos.createMessage(escapedName, message)
    .then(() => { resourceInvoker.invokeResourceUntilEmpty(escapedName); })
    .then(() => sendResponse(response));
};

const removeMessage = (request, response) => {
  const { params } = request;
  const logger = globals.getLogger();

  const reqOrid = getOridFromRequest(request);
  const escapedName = oridToRepoName(orid.v1.generate(reqOrid));

  return repos.removeMessage(escapedName, reqOrid.resourceRider)
    .then((count) => sendResponse(response, count ? 200 : 404))
    .catch((err) => {
      logger.error({ err, params }, 'Message remove failed');
    });
};

const ensureRequestOrid = (withRider) => (request, response, next) => {
  const reqOrid = getOridFromRequest(request);

  if (!reqOrid || (withRider && !reqOrid.resourceRider)) {
    sendResponse(response, 400);
    return;
  }

  next();
};

router.get('/queues', listQueues); // get list of queues
router.post('/queue', createQueue); // create new queue
router.post('/queue/:orid', ensureRequestOrid(false), updateQueue); // update a queue
router.delete('/queue/:orid', ensureRequestOrid(false), removeQueue); // deletes a queue from the system
router.get('/queue/:orid/details', ensureRequestOrid(false), getQueueDetails); // gets the metadata associated with the queue
router.get('/queue/:orid/length', ensureRequestOrid(false), getMessageCount); // get the count of messages in a queue
router.get('/message/:orid', ensureRequestOrid(false), getMessage); // get a message from the queue
router.post('/message/:orid', ensureRequestOrid(false), createMessage); // send a message to the queue
router.delete('/message/:orid*', ensureRequestOrid(true), removeMessage); // deletes a message from the system

module.exports = router;
