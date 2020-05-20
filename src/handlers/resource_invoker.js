const got = require('got');

const globals = require('../globals');
const repos = require('../repos');

const invokeResourceFnProject = (url) => {
  const body = '{}';
  const opts = {
    headers: {
      'content-type': 'application/json',
    },
    body,
  };

  return got.post(url, opts);
};

const invokeResourceUntilEmpty = async (qid) => {
  const logger = globals.getLogger();
  if (process.env.DISABLE_FIRE_EVENTS) {
    logger.trace(
      { disableFireEvents: process.env.DISABLE_FIRE_EVENTS },
      'Event firing has been disabled.',
    );
    return Promise.resolve();
  }

  logger.trace({ qid }, `Acquiring lock for ${qid}.`);
  const lockKey = `${qid}-lock`;

  const isLocked = await repos.isLocked(lockKey);
  if (isLocked) {
    logger.trace('It appears there is an existing lock. Skipping.');
    return Promise.resolve();
  }

  await repos.acquireLock(lockKey, 30);

  try {
    const metadata = await repos.getValueForKey(`queue-meta:${qid}`);
    logger.trace({ metadata }, 'Attempting to parse metadata');
    if (!metadata) {
      logger.trace(
        { qid, metadata, disableFireEvents: process.env.DISABLE_FIRE_EVENTS },
        'Metadata not found or event firing disabled.',
      );
      return Promise.resolve();
    }

    const meta = JSON.parse(metadata);
    if (!meta.resource) {
      logger.trace(
        { qid, metadata, disableFireEvents: process.env.DISABLE_FIRE_EVENTS },
        'Metadata not found or event firing disabled.',
      );
      return Promise.resolve();
    }

    const pendingMessages = await repos.getQueueSize(qid);
    if (pendingMessages < 1) {
      logger.trace({ pendingMessages }, 'No messages pending. Skipping metadata and lock fetch.');
      return Promise.resolve();
    }

    try {
      logger.trace(
        { qid, metadata },
        'Invoking resource',
      );
      await invokeResourceFnProject(meta.resource);
      logger.trace(
        { qid, metadata },
        'Resource invoke completed successfully.',
      );
    } catch (err) {
      logger.warn(
        { err, resource: meta.resource },
        'An error occurred when invoking the resource.',
      );
    }
  } catch (err) {
    logger.warn({ err }, 'A problem occurred while attempting to fire the metadata resource.');
  } finally {
    logger.trace({ qid }, `Releasing lock for ${qid}.`);
    await repos.releaseLock(lockKey);
  }

  await invokeResourceUntilEmpty(qid);

  return Promise.resolve();
};

module.exports = {
  invokeResourceFnProject,
  invokeResourceUntilEmpty,
};
