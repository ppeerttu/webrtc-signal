const SignalClient = require('./index');
const MockSocket = require('./MockSocket');
const states = require('./states');


describe('SignalClient', () => {
  describe('constructor', () => {

    test('Should throw an error with invalid parameters', () => {
      expect(() => {
        new SignalClient();
      }).toThrow();

      expect(() => {
        new SignalClient({}, 123);
      }).toThrow();

      expect(() => {
        new SignalClient('foo');
      }).toThrow();
    });

    test('Should not throw an error with valid parameters', () => {
      let socket;
      expect(() => {
        socket = new SignalClient({}, 'testUser');
      }).not.toThrow();
      expect(socket.state).toBe(states.IDLE);
      expect(socket.caller).toBe(null);
      expect(socket.receiver).toBe(null);
    });

  });

  describe('placeCall', () => {
    let caller, receiver;

    beforeAll(() => {
      caller = new SignalClient(new MockSocket(), 'caller');
      receiver = new SignalClient(new MockSocket(), 'receiver');
      receiver.socket.emit = jest.fn();
    });

    test('Should throw an error when receiving invalid parameters', () => {
      expect(() => {
        caller.placeCall({}, {});
      }).toThrow();
      expect(() => {
        caller.placeCall(new MockSocket(), {});
      }).toThrow();
      expect(() => {
        caller.placeCall(receiver, 'offer');
      }).toThrow();
    });

    test('Should set the states and caller/receiver linking', () => {
      let offer = { foo: 'bar' };
      caller.placeCall(receiver, offer);

      expect(caller.state).toBe(states.ALERTING);
      expect(receiver.state).toBe(states.RINGING);
      expect(caller.receiver).toBe(receiver);
      expect(receiver.caller).toBe(caller);
      expect(receiver.socket.emit).toHaveBeenCalledTimes(1);
      expect(receiver.socket.emit)
        .toHaveBeenCalledWith('call', {
          username: caller.username,
          offer
        });
    });
  });

  describe('placeAnswer', () => {
    let caller, receiver;

    beforeAll(() => {
      caller = new SignalClient(new MockSocket(), 'caller');
      receiver = new SignalClient(new MockSocket(), 'receiver');
      caller._initState = jest.fn();
      receiver._initState = jest.fn();
      caller.socket.emit = jest.fn();
    });

    test('Should throw an error when receiving invalid parameters', () => {
      expect(() => {
        receiver.placeAnswer(true);
      }).toThrow();

      expect(() => {
        receiver.placeAnswer('232');
      }).toThrow();

      expect(() => {
        receiver.placeAnswer(329932);
      }).toThrow();

      expect(() => {
        receiver.placeAnswer();
      }).toThrow();
    });

    test('Should call _initState if no caller specified', () => {
      receiver.placeAnswer({});
      expect(receiver._initState).toHaveBeenCalledTimes(1);
    });

    test('Should call _initState if receiving false as an answer', () => {
      receiver.caller = caller;
      receiver.placeAnswer(false);

      expect(caller._initState).toHaveBeenCalledTimes(1);
      expect(receiver._initState).toHaveBeenCalledTimes(2);
    });

    test('Should change the states for participants into CONNECTED', () => {
      const answer = { type: 'answer', udf: {} };
      receiver.placeAnswer(answer);

      expect(caller.state).toBe(states.CONNECTED);
      expect(receiver.state).toBe(states.CONNECTED);
      expect(caller.socket.emit).toHaveBeenCalledTimes(1);
      expect(caller.socket.emit).toHaveBeenCalledWith('answer', { answer });
    });

  });

  describe('placeCandidate', () => {
    let caller, receiver;

    beforeAll(() => {
      caller = new SignalClient(new MockSocket(), 'caller');
      receiver = new SignalClient(new MockSocket(), 'receiver');
      caller.socket.emit = jest.fn();
      receiver.socket.emit = jest.fn();
    });

    test('Should throw an error with invalid parameters', () => {
      expect(() => {
        caller.placeCandidate();
      }).toThrow();

      expect(() => {
        caller.placeCandidate('foo');
      }).toThrow();

      expect(() => {
        caller.placeCandidate(true);
      }).toThrow();

      expect(() => {
        caller.placeCandidate(123);
      }).toThrow();
    });

    test('Should not throw an error when no caller/receiver specified', () => {
      expect(() => {
        caller.placeCandidate({});
      }).not.toThrow();
    });

    test('Should emit the candidate to the caller/receiver if it is specified', () => {
      caller.receiver = receiver;
      receiver.caller = caller;
      const candidateA = { foo: 'A' };
      const candidateB = { bar: 'B' };

      caller.placeCandidate(candidateA);
      expect(receiver.socket.emit).toHaveBeenCalledTimes(1);
      expect(receiver.socket.emit).toHaveBeenCalledWith('candidate', { candidate: candidateA });

      receiver.placeCandidate(candidateB);
      expect(caller.socket.emit).toHaveBeenCalledTimes(1);
      expect(caller.socket.emit).toHaveBeenCalledWith('candidate', { candidate: candidateB });
    });
  });
});
