const redis = require('redis');
const RedisSMQ = require('rsmq');
const util = require('util');
const parseRedisUrl = require('parse-redis-url')(redis);
const config = require('../../config');

const { host, port } = parseRedisUrl.parse(config.DbUrl);
const ns = 'rsmq';

const redisClient = redis.createClient({
  host,
  port,
});
const queue = new RedisSMQ({
  host,
  port,
  ns,
});


const createQueuePromise = util.promisify(queue.createQueue);
const listQueuesPromise = util.promisify(queue.listQueues);
const deleteQueuePromise = util.promisify(queue.deleteQueue);
const sendMessagePromise = util.promisify(queue.sendMessage);
const receiveMessagePromise = util.promisify(queue.receiveMessage);
const deleteMessagePromise = util.promisify(queue.deleteMessage);
const getQueueAttributesPromise = util.promisify(queue.getQueueAttributes);

const handleAppShutdown = () => new Promise((resolve) => {
  queue.quit();
  redisClient.quit();
  resolve();
});

const listQueues = () => listQueuesPromise();

const createQueue = (name, maxSize, delay, vt) => createQueuePromise({
  delay,
  maxsize: maxSize,
  qname: name,
  vt,
});
const updateQueue = () => (null);
const removeQueue = (name) => deleteQueuePromise({ qname: name });

const getMessage = (name, vt) => receiveMessagePromise({
  qname: name,
  vt,
});
const createMessage = (name, message, delay) => sendMessagePromise({
  delay,
  message,
  qname: name,
});
const removeMessage = (name, id) => deleteMessagePromise({
  id,
  qname: name,
});
const getQueueSize = (name) => getQueueAttributesPromise({ qname: name })
  .then((resp) => resp.msgs);

const setPromise = util.promisify(redisClient.set).bind(redisClient);
const getPromise = util.promisify(redisClient.get).bind(redisClient);
const delPromise = util.promisify(redisClient.del).bind(redisClient);
const setValueForKey = (key, value) => setPromise(key, value);
const getValueForKey = (key) => getPromise(key);
const removeKey = (key) => delPromise(key);

module.exports = {
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
};
