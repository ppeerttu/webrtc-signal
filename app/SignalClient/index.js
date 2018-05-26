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

  /**
   * Initialize the state of the client
   */
  _initState() {
    this.state = states.IDLE;
    this.caller = null;
    this.receiver = null;
  }

  /**
   * Place call to the receiver and change states for
   * both this and the receiver accordingly.
   * @param {SignalClient} receiver The receiver of the call
   * @param {Object} offer The WebRTC offer object
   */
  placeCall(receiver, offer) {
    if (
      !receiver
      || !(receiver instanceof SignalClient)
    ) throw new TypeError('Expected to receive an instance of SignalClient but received ' + receiver);

    if (
      !offer
      || typeof offer !== 'object'
    ) throw new TypeError('Expected to receive an instance of object but received ' + offer);

    this.receiver = receiver;
    this.state = states.ALERTING;

    receiver.caller = this;
    receiver.state = states.RINGING;
    receiver.socket.emit('call', {
      username: this.username,
      offer
    });
  }

  /**
   * Place an answer to the caller and change states accordingly.
   * @param {Object|boolean} answer The answer for the call (boolean false acceptable)
   */
  placeAnswer(answer) {
    if (
      (typeof answer === 'boolean' && answer)
      || (typeof answer !== 'boolean' && typeof answer !== 'object')
    ) throw new TypeError(
      'Expected to receive an instance of object or boolean value false' +
      ' but received ' + answer
    );

    if (answer && this.caller && this.caller.socket) {
      this.caller.socket.emit('answer', { answer });
      this.state = states.CONNECTED;
      this.caller.state = states.CONNECTED;
      return;
    }

    this._initState();
    if (this.caller) this.caller._initState();
  }

  /**
   * Send a candidate to the client
   * @param {Object} candidate The WebRTC candidate object
   */
  placeCandidate(candidate) {
    if (typeof candidate !== 'object') throw new TypeError('Expected to receive an object but received ' + candidate);
    let to = this.caller || this.receiver;
    if (to && to.socket) to.socket.emit('candidate', { candidate });
  }

  /**
   * Leave a call and change states for both participants
   * accordingly.
   */
  leaveCall() {
    let to = this.caller || this.receiver;
    if (to) {
      to.socket.emit('leave');
      to._initState();
    }
    this._initState();
  }

  set caller(caller) {
    if (
      !(caller instanceof SignalClient)
      && caller !== null
    ) throw new TypeError('Invalid type!');
    this._caller = caller;
  }

  get caller() {
    return this._caller;
  }

  set receiver(receiver) {
    if (
      !(receiver instanceof SignalClient)
      && receiver !== null
    ) throw new TypeError('Invalid type!');
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
