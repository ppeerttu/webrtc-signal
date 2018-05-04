const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');
const SignalHandler = require('./app/lib/SignalHandler');
const config = require('./config')[process.env.NODE_ENV];
const pjson = require('./package.json');
const bindRoutes = require('./app/routes');
//const cors = require('./app/lib/cors');
const Logger = require('./app/lib/logger');
const logger = Logger.getInstance();

const server = restify.createServer({
  name: pjson.name
});

const cors = corsMiddleware({
  origins: ['*']
});
// Use restify plugins
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

// Add cors middleware for now
server.pre(cors.preflight);
server.use(cors.actual);
//server.on('MethodNotAllowed', cors);

server.pre((req, res, next) => {
  logger.add('info', 'REQUEST', req);
  next();
});

// Add HTTP API routes
bindRoutes(server);

// Create a WebRTC signal handler
const signalHandler = new SignalHandler(server);

const port = config.httpPort || 3000;

server.listen(port, () => {
  console.log('Listening to port ' + port);
});
