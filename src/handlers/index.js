const got = require('got');
const repos = require('../repos');

const sendResponse = (response, status, body) => {
  response.status(status || 200);
  response.send(body);
  return Promise.resolve();
};

const listQueues = (request, response) => repos.listQueues().then((result) => {
  response.send(JSON.stringify(result));
});
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

  const queueMeta = JSON.stringify({
    resource,
  });

  return repos.setValueForKey(`queue-meta:${id}`, queueMeta)
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

  return repos.getMessage(qid)
    .then((message) => sendResponse(response, 200, message))
    .catch((err) => {
      if (err.name === 'queueNotFound') {
        sendResponse(response, 404);
        return;
      }

      throw err;
    });
};

const invokeResource = (qid) => repos.getValueForKey(`queue-meta:${qid}`)
  .then((metadata) => {
    if (metadata) {
      const meta = JSON.parse(metadata);
      const opts = {
        headers: {
          'content-type': 'application/json',
        },
        body: '{}',
      };

      if (meta.resource) {
        // NOTE: the user doesn't care what the response is.
        got.post(meta.resource, opts);
      }
    }

    return Promise.resolve();
  });

const createMessage = (request, response) => {
  const { body, params } = request;
  const { qid } = params;
  const message = JSON.stringify(body);

  // TODO: Research if resource defined skip queue and invoke directly is option
  // May want to also entertain batching messages before sending them to defined
  // resource or incrementally invoking the resource with message batches while
  // the queue is above zero messages.
  return repos.createMessage(qid, message)
    .then((id) => invokeResource(qid, id))
    .then(() => sendResponse(response));
};

const removeMessage = (request, response) => {
  const { params } = request;
  const { qid, id } = params;

  return repos.removeMessage(qid, id)
    .then((count) => sendResponse(response, count ? 200 : 404));
};


module.exports = {
  listQueues,
  createQueue,
  updateQueue,
  removeQueue,
  getMessageCount,
  getMessage,
  createMessage,
  removeMessage,
};
