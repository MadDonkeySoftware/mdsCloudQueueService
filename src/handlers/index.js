const got = require('got');
const repos = require('../repos');
const { logger } = require('../globals');

const delay = (ms) => new Promise((resolve) => {
  setTimeout(() => {
    resolve();
  }, ms);
});

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

const invokeResourceFnProject = (url, bodyObject) => {
  let body;
  if (!bodyObject) {
    body = '{}';
  } else {
    body = JSON.stringify(bodyObject);
  }
  const opts = {
    headers: {
      'content-type': 'application/json',
    },
    body,
  };

  return got.post(url, opts);
};

const hasMetaAndNotEmpty = (qid) => Promise.all([repos.getQueueSize(qid), repos.getValueForKey(`queue-meta:${qid}`)])
  .then((data) => {
    if (data[0]) {
      if (data[1]) {
        const meta = JSON.parse(data[1]);
        return meta.resource && meta.resource !== '';
      }
    }
    return false;
  });

// TODO: Move this out into a worker than can be run stand alone.
const invokeResourceUntilEmpty = (qid) => repos.acquireLock(`${qid}-lock`, 30 * 1000)
  .then((release) => delay(1 * 1000)
    .then(() => repos.getValueForKey(`queue-meta:${qid}`))
    .then((metadata) => {
      if (!metadata) { return Promise.resolve(); }

      const meta = JSON.parse(metadata);
      if (!meta.resource || process.env.DISABLE_FIRE_EVENTS) { return Promise.resolve(); }

      return invokeResourceFnProject(meta.resource)
        .then(() => Promise.resolve()) // causes http response to not bubble out
        .catch((err) => {
          if (err) {
            process.stdout.write(`ERROR: ${err.message} when invoking ${meta.resource}\n`);
          }
          return Promise.resolve();
        });
    })
    .finally(() => release()))
  .then(() => hasMetaAndNotEmpty(qid))
  .then((shouldRunAgain) => {
    if (shouldRunAgain) {
      return invokeResourceUntilEmpty(qid);
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
    .then(() => { invokeResourceUntilEmpty(qid); })
    .then(() => sendResponse(response));
};

const removeMessage = (request, response) => {
  const { params } = request;
  const { qid, id } = params;

  return repos.removeMessage(qid, id)
    .then((count) => sendResponse(response, count ? 200 : 404))
    .catch((err) => {
      logger.error('Message remove failed', err, params);
    });
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
