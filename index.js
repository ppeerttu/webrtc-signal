const restify = require('restify');
const SignalHandler = require('./app/lib/SignalHandler');
const server = restify.createServer();
const config = require('./config')[process.env.NODE_ENV];
const bindRoutes = require('./app/routes');
const cors = require('./app/lib/cors');

// Use restify plugins
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

// Add cors middleware for now
server.use(cors);

// Add HTTP API routes
bindRoutes(server);

// Create a WebRTC signal handler
const signalHandler = new SignalHandler(server);

const port = config.httpPort || 3000;

server.listen(port, () => {
  console.log('Listeing to localhost:' + port);
});
