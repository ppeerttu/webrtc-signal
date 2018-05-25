const EventEmitter = require('events');

/**
 * Mocket socket for test.
 */
class MockSocket extends EventEmitter {

  constructor() {
    super();
  }

  /**
   * Mocked disconnect method. NOOP
   * @param {boolean} [mockUnderlyingSocket = false] - Doesn't really do anything
   */
  disconnect(mockUnderlyingSocket = false) {
    // NOOP
    this.connected = false;
  }
};

module.exports = MockSocket;
