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

    this.io = new SocketIO(server, {
      path: '/webrtc/signal',
      origins: '*:*'
    });
    this.io.use(this.authenticate);
    this.clients = [];
    this.callsOngoing = [];
    this.intervalId = null;
    this._init();
  }

  __closeServer() {
    const self = this;
    return new Promise(resolve => {
      self.io.close(() => resolve());
    });
  }

  /**
   * Shutdown the server.
   * 
   * Close the server and release all resources.
   */
  async shutdown() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    await this.__closeServer();
  }

  /**
   * Initialize the handler
   */
  _init() {
    const _handler = this;
    this.io.on('connection', socket => {
      _handler.manageConnection(socket);
    });

    // Don't set interval during tests 
    if (process.env.NODE_ENV === 'test') return;

    this.intervalId = setInterval(() => {
      _handler.callsOngoing.forEach(c => {
        const calls = [];
        if (!c.answered && (c.startedAt < (Date.now() - (30 * 1000)))) {
          c.caller.leaveCall();
          try {
            _handler.removeCall(c);
          } catch(e) {
            logger.add('error', e);
          }
        }
      });
    }, 10000);
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
      const call = this.callsOngoing.find(x => (x.caller === client || x.receiver === client));
      client.leaveCall();
      if (call) {
        try {
          this.removeCall(call);
        } catch(e) {
          logger.add('error', e);
        }
      }
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
        this.saveCall(client, receiver);
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
      if (!answer && client.caller) {
        this.removeCall(client.caller, client);
      }
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
   * Save a call that has been placed between
   * two clients
   * @param {SignalClient} caller
   * @param {SignalClient} handler
   */
  saveCall(caller, receiver) {
    if (!(caller instanceof SignalClient) || !(receiver instanceof SignalClient)) {
      throw new TypeError('Invalid parameters for SignalHandler.saveCall!');
    }
    // TODO: Check if there is a call already between these two clients etc...
    this.callsOngoing.push({
      caller,
      receiver,
      startedAt: Date.now(),
      answered: false
    });
  }

  /**
   * Check that the call between these two clients
   * has been answered
   * @param {SignalClient} caller
   * @param {SignalClient} receiver
   */
  checkCallAnswered(caller, receiver) {
    if (!(caller instanceof SignalClient) || !(receiver instanceof SignalClient)) {
      throw new TypeError('Invalid parameters for SignalHandler.saveCall!');
    }

    const call = this.callsOngoing.find(x => (x.caller === caller && x.receiver === receiver));
    if (!call) {
      logger.add(
        'warn',
        `Tried to find and check answered a call for caller ${caller.id} and receiver ${receiver.id} but none found!`
      );
    } else {
      call.answered = true;
    }
  }

  /**
   * Remove a call from SignalHandlers
   * callsOngoing list.
   * @param {object} call
   */
  removeCall(call) {
    if (
      !call
      || !(call.caller instanceof SignalClient)
      || !(call.receiver instanceof SignalClient)
    ) {
      throw new TypeError('Invalid parameters for SignalHandler.saveCall!');
    }
    this.callsOngoing.splice(this.callsOngoing.indexOf(call), 1);
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
      const call = this.callsOngoing.find(x => (x.caller === client || x.receiver === client));
      if (call) {
        try {
          this.removeCall(call);
        } catch(e) {
          logger.add('error', e);
        }
      }
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
        } else {
          console.log(decoded);
          socket.decodedToken = decoded;
          next();
        }
      });
    }
  }

}

module.exports = SignalHandler;
