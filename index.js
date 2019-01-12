const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');
const SignalHandler = require('./app/SignalHandler');
const config = require('./config')[process.env.NODE_ENV];
const pjson = require('./package.json');
const bindRoutes = require('./app/routes');
const Logger = require('./app/lib/logger');
const logger = Logger.getInstance();

const app = restify.createServer({
  name: pjson.name
});

const cors = corsMiddleware({
  origins: ['*']
});
// Use restify plugins
app.use(restify.plugins.acceptParser(app.acceptable));
app.use(restify.plugins.queryParser());
app.use(restify.plugins.bodyParser());

// Add cors middleware for now
app.pre(cors.preflight);
app.use(cors.actual);

app.pre((req, res, next) => {
  logger.add('info', 'REQUEST', req);
  next();
});

// Add HTTP API routes
bindRoutes(app);

// Create a WebRTC signal handler
const signalHandler = new SignalHandler(app);

const port = config.httpPort || 3000;

app.listen(port, () => {
  logger.add('warn', 'Listening to port ' + port);
});
