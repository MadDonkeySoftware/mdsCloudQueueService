const _ = require('lodash');
const express = require('express');
const repos = require('../repos');
const globals = require('../globals');
const resourceInvoker = require('./resource_invoker');

const router = express.Router();

const sendResponse = (response, status, body) => {
  response.status(status || 200);
  response.send(body);
  return Promise.resolve();
};

const listQueues = (request, response) => repos.listQueues()
  .then((result) => sendResponse(response, 200, JSON.stringify(result)));

const queueExists = (newName, queues) => queues.indexOf(newName) > -1;

const createQueue = (request, response) => {
  const {
    resource, name, maxSize, delay, vt,
  } = request.body;
  const queueMeta = JSON.stringify({
    resource,
  });

  const newQueue = (newName, size, mdelay, visTimeout) => (
    repos.createQueue(newName, size, mdelay, visTimeout)
      .then(() => repos.setValueForKey(`queue-meta:${name}`, queueMeta))
      .then(() => true));

  return repos.listQueues()
    .then((queues) => queueExists(name, queues))
    .then((exists) => !exists && newQueue(name, maxSize, delay, vt))
    .then((created) => sendResponse(response, created ? 201 : 204));
};

const updateQueue = (request, response) => {
  const { body, params } = request;
  const { resource } = body;
  const { id } = params;

  const mergeWithFilter = (a, b) => (b === undefined ? a : undefined);
  const metaKey = `queue-meta:${id}`;
  return repos.getValueForKey(metaKey)
    .then((currentMeta) => JSON.parse(currentMeta))
    .then((currentMeta) => _.mergeWith({}, currentMeta, { resource }, mergeWithFilter))
    .then((newMeta) => _.pickBy(newMeta, _.identity))
    .then((newMeta) => repos.setValueForKey(metaKey, JSON.stringify(newMeta)))
    .then(() => sendResponse(response));
};

const removeQueue = (request, response) => {
  const { id } = request.params;

  const deleteQueue = () => repos.removeQueue(id)
    .then(() => repos.removeKey(`queue-meta:${id}`));

  return repos.listQueues()
    .then((queues) => queueExists(id, queues))
    .then((exists) => exists && deleteQueue())
    .then((deleted) => sendResponse(response, deleted ? 204 : 404));
};

const getQueueDetails = (request, response) => {
  const { params } = request;
  const { id } = params;

  return repos.getValueForKey(`queue-meta:${id}`)
    .then((metadata) => metadata || '{}')
    .then((metadata) => sendResponse(response, 200, metadata));
};

const getMessageCount = (request, response) => {
  const { params } = request;
  const { qid } = params;

  return repos.getQueueSize(qid)
    .then((size) => sendResponse(response, 200, JSON.stringify({ size })))
    .catch(() => sendResponse(response, 404));
};

const getMessage = (request, response) => {
  const { params } = request;
  const { qid } = params;
  const logger = globals.getLogger();

  return repos.getMessage(qid)
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
  const { body, params } = request;
  const { qid } = params;
  const message = JSON.stringify(body);

  // TODO: Research if resource defined skip queue and invoke directly is option
  // May want to also entertain batching messages before sending them to defined
  // resource or incrementally invoking the resource with message batches while
  // the queue is above zero messages.
  return repos.createMessage(qid, message)
    .then(() => { resourceInvoker.invokeResourceUntilEmpty(qid); })
    .then(() => sendResponse(response));
};

const removeMessage = (request, response) => {
  const { params } = request;
  const { qid, id } = params;
  const logger = globals.getLogger();

  return repos.removeMessage(qid, id)
    .then((count) => sendResponse(response, count ? 200 : 404))
    .catch((err) => {
      logger.error({ err, params }, 'Message remove failed');
    });
};

router.get('/queues', listQueues); // get list of queues
router.post('/queue', createQueue); // create new queue
router.post('/queue/:id', updateQueue); // update a queue
router.delete('/queue/:id', removeQueue); // deletes a queue from the system
router.get('/queue/:id/details', getQueueDetails); // gets the metadata associated with the queue
router.get('/queue/:qid/length', getMessageCount); // get the count of messages in a queue
router.get('/queue/:qid/message', getMessage); // get a message from the queue
router.post('/queue/:qid/message', createMessage); // send a message to the queue
router.delete('/queue/:qid/message/:id', removeMessage); // deletes a message from the system

module.exports = router;
