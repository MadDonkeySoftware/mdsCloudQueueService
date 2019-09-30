/* eslint-disable no-unused-vars */
const {
  createLogger, format, transports, Logger,
} = require('winston');
/* eslint-enable no-unused-vars */

const OneMegabyte = 1048576;

const buildFileOptions = (opts) => {
  const defaults = {
    maxsize: OneMegabyte,
    maxFiles: 3,
  };
  return { ...defaults, ...opts };
};

/**
 * Creates a new logger object.
 * @param {string} serviceName Optional name to give the logger.
 * @returns {Logger} the logger object
 */
const buildLogger = (serviceName) => {
  if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'test') {
    return createLogger({
      level: -1,
      transports: [
        new transports.Console(),
      ],
    });
  }

  const logger = createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS',
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
    ),
    defaultMeta: { service: serviceName || 'fnStateMachine-logger' },
    transports: [
      //
      // - Write to all logs with level `info` and below to `quick-start-combined.log`.
      // - Write all logs error (and below) to `quick-start-error.log`.
      //
      new transports.File(buildFileOptions({ filename: './logs/quick-start-error.log', level: 'error' })),
      new transports.File(buildFileOptions({ filename: './logs/quick-start-combined.log' })),
    ],
  });

  //
  // If we're not in production then **ALSO** log to the `console`
  // with the colorized simple format and a debug file for tail.
  //
  if (process.env.NODE_ENV !== 'production') {
    logger.level = 'verbose';
    logger.add(new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple(),
      ),
      level: 'silly',
    }));
    logger.add(new transports.File(buildFileOptions({
      filename: './logs/quick-start-debug.log',
      format: format.simple(),
      level: 'silly',
    })));
  }

  logger.debug('Created new logger.');

  return logger;
};

module.exports = {
  buildLogger,
};
