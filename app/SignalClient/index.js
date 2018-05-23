const states = require('./states');

class SignalClient {

  constructor(socket, username) {
    if (
      !socket
      || !username
      || typeof username !== 'string'
    ) throw new Error('Invalid parameters for the constructor of SignalClient');
    this.socket = socket;
    this._state = states.IDLE;
    this._caller = null;
    this._receiver = null;
    this.id = socket.id;
    this.username = username;
  }

  _initState() {
    this.state = states.IDLE;
    this.caller = null;
    this.receiver = null;
  }

  placeCall(receiver, offer) {
    this.receiver = receiver;
    this.state = states.ALERTING;

    receiver.caller = this;
    receiver.state = states.RINGING;
    receiver.socket.emit('call', {
      username: this.username,
      offer
    });
  }

  placeAnswer(answer) {
    this.caller.emit('answer', { answer });
    if (answer) {
      this.state = states.CONNECTED;
      this.caller.state = states.CONNECTED;
      return;
    }
    this._initState();
  }

  placeCandidate(candidate) {
    let to = this.caller || this.receiver;
    if (to) to.emit('candidate', { candidate });
  }

  leaveCall() {
    let to = this.caller || this.receiver;
    if (to) to.emit('leave');
    to._initState();
    this._initState();
  }

  set caller(caller) {
    this._caller = caller;
  }

  get caller() {
    return this._caller;
  }

  set receiver(receiver) {
    this._receiver = receiver;
  }

  get receiver() {
    return this._receiver;
  }

  set state(state) {
    this._state = state;
  }

  get state() {
    return this._state;
  }

}

module.exports = SignalClient;
