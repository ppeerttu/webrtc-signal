const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const { secretKey } = require('../../config')[process.env.NODE_ENV];
const SignalClient = require('../SignalClient');
const states = require('../SignalClient/states');
const Logger = require('../lib/logger');
const logger = Logger.getInstance();

class SignalHandler {

  constructor(server) {
    if (!server) throw new TypeError('The SignalHandler requires a server to be passed as a constructor parameter!');

    this.io = socketio(server.server, {
      path: '/signal',
      origins: '*:*'
    });
    this.io.use(this.authenticate);
    this.clients = [];

    this._init();
  }

  _init() {
    let _handler = this;
    this.io.on('connection', socket => {

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
        const { username, offer } = data;
        if (!offer || !username) {
          logger.add('warn', `Received invalid call payload from ${client.username}!`);
          return;
        }
        logger.add('info', `${client.username} is calling to ${username}`);

        const receiver = _handler.getClientByUsername(username);

         // TODO: CHECK THE RECEIVER STATE
        if (receiver) {
          client.placeCall(receiver, offer);
          return;
        }
        socket.emit('error', { type: 'RECEIVER_NOT_FOUND' });
        _handler.broadcastClientsOnline();
      });

      // { username: <username> }
      socket.on('answer', data => {
        const { username, answer } = data;

        if (!username || !data.hasOwnProperty('answer')) {
          logger.add('warn', `Received invalid answer payload from ${client.username}!`);
          return;
        }
        logger.add('info', `${client.username} is answering to ${username}`);

        try {
          client.placeAnswer(answer);
        } catch(e) {
          logger.add('error', e);
          socket.emit('error', { type: 'RECEIVER_NOT_FOUND' });
          _handler.broadcastClientsOnline();
        }
      });

      // { username: <username>, candidate: <candidate> }
      socket.on('candidate', data => {
        const { username, candidate } = data;

        if (!username || !candidate) {
          logger.add('warn', `Received invalid candidate payload from ${client.username}`);
          return;
        }

        logger.add('verbose', `${client.username} is passing candidate to ${username}`);

        client.placeCandidate(candidate);
      });

      socket.on('leave', data => {
        client.leaveCall();
      });

      socket.on('disconnecting', reason => {
        logger.add('verbose', `User ${client.username} is disconnecting, reason: ${reason}`);
        if (client.state !== states.IDLE) {
          client.leaveCall();
        }
        let index = 0, size = _handler.clients.length;
        for (let i = 0; i < size; i++) {
          if (_handler.clients[i].id === client.id) {
            index = i;
          }
        }

        _handler.clients.splice(index, 1);
      });

      socket.on('disconnect', () => {
        logger.add('verbose', `User ${client.username} disconnected`);
        _handler.broadcastClientsOnline();
      });

    });
  }

  broadcastClientsOnline() {
    const users = this.clients.map(x => Object.assign({}, {
      username: x.username,
      state: x.state
    }));

    this.clients.map(x => {
      x.socket.emit('users', { users });
    });
  }

  getClientBySocketId(socketId) {
    const size = this.clients.length;
    for (let i = 0; i < size; i++) {
      if (this.clients[i].id === socketId) {
        return this.clients[i];
      }
    }
    return null;
  }

  getClientByUsername(username) {
    const size = this.clients.length;
    for (let i = 0; i < size; i++) {
      if (this.clients[i].username === username) {
        return this.clients[i];
      }
    }
    return null;
  }

  authenticate(socket, next) {
    const { handshake } = socket;
    if (!handshake.query || !handshake.query.token) {
      next(new Error('Unauthorized error!'));
    } else {
      const { query: { token }} = handshake;
      jwt.verify(token, secretKey, (err, decoded) => {
        if (err) next(new Error('Invalid token error!'));
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
