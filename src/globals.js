const logger = require('./logger');

/**
 * returns the current logger for the application
 */
const activeLogger = logger.buildLogger();

/**
 * Promise wrapper around process.nextTick
 */
const nextTick = () => new Promise((resolve) => process.nextTick(resolve));

const delay = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

module.exports = {
  logger: activeLogger,
  nextTick,
  delay,
};
