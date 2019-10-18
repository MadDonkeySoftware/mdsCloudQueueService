const bodyParser = require('body-parser');
const express = require('express');
const { logger } = require('./globals');
const handlers = require('./handlers');
const appShutdown = require('./handlers/app_shutdown');

const app = express();
const port = 8888;

const requestLogger = (req, res, next) => {
  logger.verbose(`Handling ${req.path} - ${req.method}`);
  next();
};

const commonResponseSetup = (req, res, next) => {
  res.setHeader('content-type', 'application/json');
  next();
};

const configureRoutes = (expressApp) => {
  expressApp.get('/', (req, res) => {
    // TODO: Need to create help documentation and publish it here.
    res.send('Hello World!');
  });

  expressApp.get('/queues', handlers.listQueues); // get list of queues

  expressApp.post('/queue', handlers.createQueue); // create new queue
  expressApp.post('/queue/:id', handlers.updateQueue); // update a queue
  expressApp.delete('/queue/:id', handlers.removeQueue); // deletes a queue from the system
  expressApp.get('/queue/:id/details', handlers.getQueueDetails); // gets the metadata associated with the queue
  expressApp.get('/queue/:qid/length', handlers.getMessageCount); // get the count of messages in a queue
  expressApp.get('/queue/:qid/message', handlers.getMessage); // get a message from the queue
  expressApp.post('/queue/:qid/message', handlers.createMessage); // send a message to the queue
  expressApp.delete('/queue/:qid/message/:id', handlers.removeMessage); // deletes a message from the system
};

appShutdown.wire();
app.use(requestLogger);
app.use(commonResponseSetup);
app.use(bodyParser.json());
configureRoutes(app);

app.listen(port, () => logger.info(`Example app listening on port ${port}!`));
