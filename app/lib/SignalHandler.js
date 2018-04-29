const socketio = require('socket.io');

class SignalHandler {

  constructor(server) {
    if (!server) throw new TypeError('The SignalHandler requires a server to be passed as a constructor parameter!');

    this.io = socketio(server.server, {
      path: '/signal',
      origins: '*:*'
    });
    this.clients = {};

    this._init();
  }

  _init() {
    this.io.on('connection', socket => {

      console.log('new connection!');

      socket.on('init', data => {
        console.log('init', data);
      });

      socket.on('call', data => {
        console.log('call', data);
      });

      socket.on('decline', data => {
        console.log('decline', data);
      });

      socket.on('disconnect', data => {
        console.log('disconnect', data);
      });

    });
  }

}

module.exports = SignalHandler;
