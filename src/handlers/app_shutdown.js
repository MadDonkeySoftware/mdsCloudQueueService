const { logger } = require('../globals');
const repos = require('../repos');

const exitHandler = (options, exitCode) => {
  if (options.cleanup) logger.verbose('cleanup');
  if (options.exitCode || exitCode === 0) logger.verbose(`ExitCode: ${exitCode}`);
  if (options.exit) {
    Promise.resolve(logger.info('Shutting down.'))
      .then(() => repos.handleAppShutdown())
      .then(() => process.exit());
  }
};

const wire = () => {
  // do something when app is closing
  process.on('exit', exitHandler.bind(null, { cleanup: true }));

  // catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, { exit: true }));

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
  process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

  // catches uncaught exceptions
  process.on('uncaughtException', (ex) => {
    logger.error('Unhandled Exception', ex);
    exitHandler.bind(null, { exit: true });
  });
};

module.exports = {
  wire,
};
