// All interactions with any storage mechanism should go through a "top level"
// repository such as this module. Implementation details should be hidden from
// callers to make supporting different stores as easy as possible.

const initializeRedis = () => {
  const redis = require('./redis'); // eslint-disable-line global-require
  const handleAppShutdown = () => redis.handleAppShutdown();

  const listQueues = () => redis.listQueues();
  const createQueue = (name, maxSize, delay, vt) => redis.createQueue(name, maxSize, delay, vt);
  const updateQueue = () => null;
  const removeQueue = (name) => redis.removeQueue(name);
  const getMessage = (name, vt) => redis.getMessage(name, vt);
  const createMessage = (name, message, delay) => redis.createMessage(name, message, delay);
  const removeMessage = (name, id) => redis.removeMessage(name, id);
  const getQueueSize = (name) => redis.getQueueSize(name);
  const setValueForKey = (key, value) => redis.setValueForKey(key, value);
  const getValueForKey = (key) => redis.getValueForKey(key);
  const removeKey = (key) => redis.removeKey(key);
  const acquireLock = (lockName, timeout) => redis.acquireLock(lockName, timeout);

  return {
    handleAppShutdown,
    listQueues,
    createQueue,
    updateQueue,
    removeQueue,
    getMessage,
    createMessage,
    removeMessage,
    getQueueSize,
    setValueForKey,
    getValueForKey,
    removeKey,
    acquireLock,
  };
};

const initializeStorage = () => {
  if (!process.env.MDS_QS_DB_URL || process.env.MDS_QS_DB_URL.startsWith('redis://')) {
    return initializeRedis();
  }

  throw new Error(`Database not configured properly. "${process.env.MDS_QS_DB_URL}" not understood.`);
};

module.exports = initializeStorage();
