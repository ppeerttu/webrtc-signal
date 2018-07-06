const SocketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { secretKey } = require('../../config')[process.env.NODE_ENV];
const SignalClient = require('../SignalClient');
const states = require('../SignalClient/states');
const errors = require('./errors');
const Logger = require('../lib/logger');
const logger = Logger.getInstance();

class SignalHandler {

  constructor(server) {
    if (!server) throw new TypeError('The SignalHandler requires a server as a constructor parameter!');

    this.io = new SocketIO(server.server, {
      path: '/signal',
      origins: '*:*'
    });
    this.io.use(this.authenticate);
    this.clients = [];

    this._init();
  }

  /**
   * Initialize the handler
   */
  _init() {
    const _handler = this;
    this.io.on('connection', socket => {
      _handler.manageConnection(socket);
    });
  }

  /**
   * Controller method for incoming connections
   * @param {Object} socket An instance of Socket.io client
   */
  manageConnection(socket) {
    const _handler = this;
    const connUname = socket.decodedToken.data.username;

    if (!connUname || _handler.getClientByUsername(connUname)) {
      return socket.disconnect(true); // User already online
    }

    logger.add('info', `User ${connUname} connected`);

    const client = new SignalClient(socket, connUname);
    _handler.clients.push(client);

    _handler.broadcastClientsOnline();

    // { offer: <offer>, username: <username> }
    socket.on('call', data => {
      _handler.manageCall(client, data);
    });

    // { username: <username> }
    socket.on('answer', data => {
      _handler.manageAnswer(client, data);
    });

    // { username: <username>, candidate: <candidate> }
    socket.on('candidate', data => {
      _handler.manageCandidate(client, data);
    });

    socket.on('leave', () => {
      client.leaveCall();
    });

    socket.on('disconnecting', reason => {
      _handler.prepareClientDisconnect(client, reason);
    });

    socket.on('disconnect', () => {
      logger.add('verbose', `User ${client.username} disconnected`);
      _handler.broadcastClientsOnline();
    });
  }

  /**
   * Pass a call to the given peer.
   * @param {SignalClient} client The client object that is calling
   * @param {Object} payload The payload of the call message
   */
  manageCall(client, payload) {
    if (typeof payload !== 'object' || payload === null) return logger.add('warn', `Received invalid payload from ${client.username}!`);
    const { username, offer } = payload;
    if (
      !offer
      || typeof offer !== 'object'
      || !username
      || typeof username !== 'string'
      || !(client instanceof SignalClient)
    ) {
      logger.add('warn', `Received invalid call payload from ${client.username}!`);
      return;
    }
    logger.add('info', `${client.username} is calling to ${username}`);

    const receiver = this.getClientByUsername(username);

    if (receiver && receiver.state === states.IDLE) {
      try {
        client.placeCall(receiver, offer);
      } catch(e) {
        logger.add('error', e);
        client.socket.emit('service_error', { type: errors.RECEIVER_NOT_FOUND });
      }
    } else if (receiver) {
      client.socket.emit('service_error', { type: errors.RECEIVER_UNAVAILABLE });
    } else {
      client.socket.emit('service_error', { type: errors.RECEIVER_NOT_FOUND });
    }
    this.broadcastClientsOnline();
  }

  /**
   * Pass answer to the peer of the client.
   * @param {SignalClient} client The client object
   * @param {Object} payload The payload of the answer message
   */
  manageAnswer(client, payload) {
    if (typeof payload !== 'object' || payload === null) return logger.add('warn', `Received invalid payload from ${client.username}!`);
    const { answer } = payload;
    if (answer !== false && typeof answer !== 'object') {
      return logger.add('warn', `Received invalid answer payload from ${client.username}!`);
    }

    logger.add('info', `${client.username} is answering`);

    try {
      client.placeAnswer(answer);
    } catch(e) {
      logger.add('error', e);
      client.socket.emit('service_error', { type: errors.RECEIVER_NOT_FOUND });
      client._initState();
    } finally {
      this.broadcastClientsOnline();
    }
  }

  /**
   * Pass given candidate to the peer of the client.
   * @param {SignalClient} client The client object
   * @param {Object} payload The payload of the candidate message
   */
  manageCandidate(client, payload) {
    if (typeof payload !== 'object' || payload === null) return logger.add('warn', `Received invalid payload from ${client.username}!`);
    const { candidate } = payload;

    if (!candidate|| typeof candidate !== 'object') {
      logger.add('warn', `Received invalid candidate payload from ${client.username}`);
      return;
    }

    logger.add('verbose', `${client.username} is passing candidate`);

    try {
      client.placeCandidate(candidate);
    } catch(e) {
      logger.add('error', e);
    }
  }

  /**
   * Handle actions for the client that is going to disconnect.
   * @param {SignalClient} client The client object
   * @param {string} reason The reason of disconnecting
   */
  prepareClientDisconnect(client, reason) {
    logger.add('verbose', `User ${client.username} is disconnecting, reason: ${reason}`);
    if (client.state !== states.IDLE) {
      client.leaveCall();
    }
    let index = 0, size = this.clients.length;
    for (let i = 0; i < size; i++) {
      if (this.clients[i].id === client.id) {
        index = i;
      }
    }

    this.clients.splice(index, 1);
  }

  /**
   * Broadcast the state and username of each client for
   * every client online.
   */
  broadcastClientsOnline() {
    const users = this.clients.map(x => Object.assign({}, {
      username: x.username,
      state: x.state
    }));

    this.clients.map(x => {
      x.socket.emit('users', { users });
    });
  }

  /**
   * Get client by given socket id.
   * @param {string} socketId The id of the client
   * @return {SignalClient|null} The found client or null if not found.
   */
  getClientBySocketId(socketId) {
    const size = this.clients.length;
    for (let i = 0; i < size; i++) {
      if (this.clients[i].socket.id === socketId) {
        return this.clients[i];
      }
    }
    return null;
  }

  /**
   * Get client by given username.
   * @param {string} username The username of the client
   * @return {SignalClient|null} The found client or null if not found.
   */
  getClientByUsername(username) {
    const size = this.clients.length;
    for (let i = 0; i < size; i++) {
      if (this.clients[i].username === username) {
        return this.clients[i];
      }
    }
    return null;
  }

  /**
   * Authenticate the incoming WS connection
   * @param {Object} socket Socket.io client object
   * @param {function} next The next middleware callback function
   */
  authenticate(socket, next) {
    const { handshake } = socket;
    if (!handshake.query || !handshake.query.token) {
      logger.add('warn', 'Received invalid token!');
      socket.disconnect(true);
    } else {
      const { query: { token }} = handshake;
      jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
          logger.add('warn', 'Received invalid token!');
          socket.disconnect(true);
        }
        else {
          console.log(decoded);
          socket.decodedToken = decoded;
          next();
        }
      });
    }
  }

}

module.exports = SignalHandler;
