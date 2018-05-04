const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const { secretKey } = require('../../config')[process.env.NODE_ENV];
const Logger = require('./logger');
const logger = Logger.getInstance();

class SignalHandler {

  constructor(server) {
    if (!server) throw new TypeError('The SignalHandler requires a server to be passed as a constructor parameter!');

    this.io = socketio(server.server, {
      path: '/signal',
      origins: '*:*'
    });
    this.io.use(this.authenticate);
    this.clients = {};

    this._init();
  }

  _init() {
    let _handler = this;
    this.io.on('connection', socket => {

      const { data: { username }} = socket.decodedToken;


      if (!username || _handler.clients[username]) {
        return socket.disconnect(true);
      }

      for (let key in _handler.clients) {
        if (_handler.clients[key].id === socket.id) return socket.disconnect(true);
      }

      _handler.clients[username] = socket;
      socket.username = username;

      logger.add('info', `User ${username} connected`);


      const users = [];
      for (let key in _handler.clients) {
        users.push({ username: key });
      }

      // TODO: Send only to clients in _handler.clients
      for (let key in _handler.clients) {
        _handler.clients[key].emit('users', { users });
      }

      // { offer: <offer>, username: <username> }
      socket.on('call', data => {
        console.log('call', data);
        const { username, offer } = data;
        if (!offer || !username) return;

        const receiver = _handler.clients[data.username];
        if (!socket) return;

        socket.otherUser = data.username;
        receiver.emit('call', { username: socket.username, offer });
      });

      // { username: <username> }
      socket.on('answer', data => {
        console.log('answer', data);

        if (!data.username || !data.hasOwnProperty('answer')) return;

        const receiver = _handler.clients[data.username];
        if (!receiver) return;

        socket.otherUser = data.username;

        receiver.emit('answer', { answer: data.answer });
      });

      // { username: <username>, candidate: <candidate> }
      socket.on('candidate', data => {
        console.log('candidate', data);
        const { username, candidate } = data;


        if (!username || !candidate) return;

        const receiver = _handler.clients[username];
        if (!receiver) return;

        receiver.emit('candidate', { candidate });
      });

      socket.on('leave', data => {
        console.log('leave', data);
        const { username } = data;
        if (!username) return;

        const receiver = _handler.clients[username];
        if (!receiver) return;

        socket.otherName = null;
        receiver.otherName = null;
        receiver.emit('leave');
      });


      socket.on('disconnect', data => {
        console.log('disconnect', data);

        if(socket.username) {
          delete _handler.clients[socket.username];

          if (socket.otherUser) {

            console.log('Disconnecting from ', socket.otherUser);
            const receiver = _handler.clients[socket.otherUser];

            if (receiver) {
              receiver.otherName = null;
              receiver.emit('leave');
            }
          }
        }
      });

    });
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
