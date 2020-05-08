// All interactions with any storage mechanism should go through a "top level"
// repository such as this module. Implementation details should be hidden from
// callers to make supporting different stores as easy as possible.
const _ = require('lodash');

const initializeRedis = () => {
  const redis = require('./redis'); // eslint-disable-line global-require
  const connBundle = redis.createConnectionBundle(process.env.MDS_QS_DB_URL);
  const handleAppShutdown = _.partial(redis.handleAppShutdown, connBundle);

  const listQueues = _.partial(redis.listQueues, connBundle);
  const createQueue = _.partial(redis.createQueue, connBundle);
  const removeQueue = _.partial(redis.removeQueue, connBundle);
  const getMessage = _.partial(redis.getMessage, connBundle);
  const createMessage = _.partial(redis.createMessage, connBundle);
  const removeMessage = _.partial(redis.removeMessage, connBundle);
  const getQueueSize = _.partial(redis.getQueueSize, connBundle);
  const setValueForKey = _.partial(redis.setValueForKey, connBundle);
  const getValueForKey = _.partial(redis.getValueForKey, connBundle);
  const removeKey = _.partial(redis.removeKey, connBundle);
  const acquireLock = _.partial(redis.acquireLock, connBundle);
  const isLocked = _.partial(redis.isLocked, connBundle);
  const releaseLock = _.partial(redis.releaseLock, connBundle);

  return {
    handleAppShutdown,
    listQueues,
    createQueue,
    removeQueue,
    getMessage,
    createMessage,
    removeMessage,
    getQueueSize,
    setValueForKey,
    getValueForKey,
    removeKey,
    acquireLock,
    isLocked,
    releaseLock,
  };
};

const initializeStorage = () => {
  if (!process.env.MDS_QS_DB_URL || process.env.MDS_QS_DB_URL.startsWith('redis://')) {
    return initializeRedis();
  }

  throw new Error(`Database not configured properly. "${process.env.MDS_QS_DB_URL}" not understood.`);
};

module.exports = initializeStorage();
