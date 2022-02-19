const os = require('os');
const redis = require('redis');
const Lock = require('node-redis-lock');
const RedisSMQ = require('rsmq');
const util = require('util');
const parseRedisUrl = require('parse-redis-url')(redis);

/**
 * @typedef {Object} RedisConnectionBundle
 * @property {redis.RedisClient} redisClient A configured redis client.
 * @property {RedisSMQ} redisSMQ A configured redisSQM instance
 * @property {Lock} redisLock A configured redis based lock
 */

/**
 * @returns {RedisConnectionBundle} Connection bundle to be used when working with the Redis repo.
 */
const createConnectionBundle = (redisUrl) => {
  if (process.env.NODE_ENV === 'test') return undefined;

  const { host, port } = parseRedisUrl.parse(
    redisUrl || 'redis://127.0.0.1:6379',
  );

  const redisClient = redis.createClient({ host, port });
  const redisSMQ = new RedisSMQ({ host, port, ns: 'rsmq' });
  const redisLock = new Lock({ namespace: 'locking' }, redisClient);

  return {
    redisClient,
    redisSMQ,
    redisLock,
  };
};

/**
 * Handles safely closing the bundled redis connection object
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @returns {Promise<void>}
 */
const handleAppShutdown = (bundle) =>
  new Promise((resolve) => {
    const keys = Object.keys(bundle);
    for (let i = 0; i < keys.length; i += 1) {
      const item = bundle[keys[i]];
      if (item.quit) {
        item.quit();
      }
    }

    resolve();
  });

/**
 * Gets an array of the available queues.
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @returns {Promise<string[]>}
 */
const listQueues = (bundle) => {
  const listQueuesPromise = util.promisify(bundle.redisSMQ.listQueues);
  return listQueuesPromise();
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} name The name for the queue.
 * @param {number} [maxSize] Maximum message size in bytes. 1024 <-> 65536 or -1 for unlimited.
 * @param {number} [delay] Seconds that the delivery of new messages will be delayed.
 * @param {number} [vt] Seconds that a message will be invisible after being received.
 */
const createQueue = (bundle, name, maxSize, delay, vt) => {
  const createQueuePromise = util.promisify(bundle.redisSMQ.createQueue);
  return createQueuePromise({
    delay,
    maxsize: maxSize,
    qname: name,
    vt,
  });
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} name The name for the queue.
 */
const removeQueue = (bundle, name) => {
  const deleteQueuePromise = util.promisify(bundle.redisSMQ.deleteQueue);
  return deleteQueuePromise({ qname: name });
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} name The name for the queue.
 * @param {number} [vt] Seconds that a message will be invisible after being received.
 */
const getMessage = (bundle, name, vt) => {
  const receiveMessagePromise = util.promisify(bundle.redisSMQ.receiveMessage);
  return receiveMessagePromise({
    qname: name,
    vt,
  });
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} name The name for the queue.
 * @param {string} message The message to enqueue.
 * @param {number} [delay] Seconds that the delivery of new messages will be delayed.
 */
const createMessage = (bundle, name, message, delay) => {
  const sendMessagePromise = util.promisify(bundle.redisSMQ.sendMessage);
  return sendMessagePromise({
    delay,
    message,
    qname: name,
  });
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} name The name for the queue.
 * @param {string} id The unique id for the message.
 */
const removeMessage = (bundle, name, id) => {
  const deleteMessagePromise = util.promisify(bundle.redisSMQ.deleteMessage);
  return deleteMessagePromise({
    id,
    qname: name,
  });
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} name The name for the queue.
 * @returns {Promise<number>}
 */
const getQueueSize = (bundle, name) => {
  const getQueueAttributesPromise = util.promisify(
    bundle.redisSMQ.getQueueAttributes,
  );
  return getQueueAttributesPromise({ qname: name }).then((resp) => resp.msgs);
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} key The unique identifier for the value
 * @param {string} value The value to be stored.
 */
const setValueForKey = (bundle, key, value) => {
  const setPromise = util
    .promisify(bundle.redisClient.set)
    .bind(bundle.redisClient);
  return setPromise(key, value);
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} key The unique identifier for the value
 */
const getValueForKey = (bundle, key) => {
  const getPromise = util
    .promisify(bundle.redisClient.get)
    .bind(bundle.redisClient);
  return getPromise(key);
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @param {string} key The unique identifier for the value
 */
const removeKey = (bundle, key) => {
  const delPromise = util
    .promisify(bundle.redisClient.del)
    .bind(bundle.redisClient);
  return delPromise(key);
};

const lockValue = `owned-by-${os.hostname()}`;

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 * @returns {Promise<boolean>}
 */
const acquireLock = (bundle, lockName, timeout) => {
  const acquireLockPromise = util
    .promisify(bundle.redisLock.acquire)
    .bind(bundle.redisLock);
  return acquireLockPromise(lockName, timeout, lockValue).catch(() => false);
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 */
const isLocked = (bundle, lockName) => {
  const isLockedPromise = util
    .promisify(bundle.redisLock.isLocked)
    .bind(bundle.redisLock);
  return isLockedPromise(lockName).then((r) => !!r);
};

/**
 * @param {RedisConnectionBundle} bundle The connection bundle to close
 */
const releaseLock = (bundle, lockName) => {
  const releaseLockPromise = util
    .promisify(bundle.redisLock.release)
    .bind(bundle.redisLock);
  return releaseLockPromise(lockName, lockValue).catch(() => false);
};

module.exports = {
  handleAppShutdown,
  createConnectionBundle,
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
