const SignalHandler = require('./index');
const SignalClient = require('../SignalClient');
const MockSocket = require('../SignalClient/MockSocket');
const errors = require('./errors');
const states = require('../SignalClient/states');

describe('SignalHandler', () => {

  describe('constructor', () => {
    test('Should throw an error when no parameters received', () => {
      expect(() => {
        new SignalHandler();
      }).toThrow();
    });

    test('Should not throw an error when an object given as a parameter', () => {
      expect(() => {
        new SignalHandler({});
      }).not.toThrow();
    });
  });

  describe('getClientBySocketId', () => {
    let handler;
    beforeAll(() => {
      handler = new SignalHandler({});
    });

    test('Should return null when no socket found with given id', () => {
      expect(handler.getClientBySocketId('23919')).toBe(null);
    });

    test('Should return the client with given id', () => {
      const id = '4321234';
      const client = new SignalClient(new MockSocket(id), 'tester');
      handler.clients.push(client);
      handler.clients.push(new SignalClient(new MockSocket('0988'), 'testclient'));
      handler.clients.push(new SignalClient(new MockSocket('8022'), 'testerClient'));

      expect(handler.getClientBySocketId(id)).toBe(client);
    });
  });

  describe('getClientByUsername', () => {
    let handler;
    beforeAll(() => {
      handler = new SignalHandler({});
    });

    test('Should return null when no socket found with given id', () => {
      handler.clients.push(new SignalClient(new MockSocket('0988'), 'testclient'));
      handler.clients.push(new SignalClient(new MockSocket('8022'), 'testerClient'));

      expect(handler.getClientByUsername('tester')).toBe(null);
    });

    test('Should return the client with given id', () => {
      const username = 'tester';
      const client = new SignalClient(new MockSocket('23232'), username);
      handler.clients.push(client);

      expect(handler.getClientByUsername(username)).toBe(client);
    });
  });

  describe('broadcastClientsOnline', () => {
    test('Should broadcast available clients to every client', () => {
      const handler = new SignalHandler({});
      for (let i = 10; i > 0; i--) {
        handler.clients.push(new SignalClient(new MockSocket(`id-${i}`), `user-${i}`));
      }
      handler.clients.map(x => x.socket.emit = jest.fn());

      handler.broadcastClientsOnline();
      handler.clients.map(x => {
        expect(x.socket.emit).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('manageCall', () => {
    let handler;
    beforeEach(() => {
      handler = new SignalHandler({});
      handler.clients.push(new SignalClient(new MockSocket('1'), 'Foo'));
      handler.clients.push(new SignalClient(new MockSocket('2'), 'Bar'));
      handler.clients.push(new SignalClient(new MockSocket('3'), 'Biz'));
    });

    test('Should not proceed if receiving invalid data', () => {
      handler.getClientByUsername = jest.fn(); // This func will get called if proceeded

      handler.manageCall(handler.clients[0], {});
      handler.manageCall(handler.clients[0], { username: { foo: 'bar' }, offer: {} });
      handler.manageCall(handler.clients[0], { username: 123, offer: {} });
      handler.manageCall(handler.clients[0], { username: true, offer: {} });
      handler.manageCall(handler.clients[0], { username: 'jskds', offer: true });
      handler.manageCall(handler.clients[0], { username: 'oskdos', offer: 'etekos' });
      expect(handler.getClientByUsername).toHaveBeenCalledTimes(0);

      handler.manageCall(handler.clients[0], { username: 'FooBar', offer: {} });
      expect(handler.getClientByUsername).toHaveBeenCalledTimes(1);
    });

    test('Should emit service error if receiver not found', () => {
      const client = handler.clients[0];
      client.socket.emit = jest.fn();
      handler.broadcastClientsOnline = jest.fn();
      handler.manageCall(handler.clients[0], { username: 'NotFound', offer: {} });

      expect(handler.broadcastClientsOnline).toHaveBeenCalledTimes(1);
      expect(client.socket.emit).toHaveBeenCalledTimes(1);
      expect(client.socket.emit).toHaveBeenCalledWith('service_error', {
        type: errors.RECEIVER_NOT_FOUND
      });
    });

    test('Should emit service error if receiver not available', () => {
      const client = handler.clients[0];
      handler.clients[1].state = states.ALERTING;
      client.socket.emit = jest.fn();
      handler.broadcastClientsOnline = jest.fn();
      handler.manageCall(handler.clients[0], { username: 'Bar', offer: {} });

      expect(handler.broadcastClientsOnline).toHaveBeenCalledTimes(1);
      expect(client.socket.emit).toHaveBeenCalledTimes(1);
      expect(client.socket.emit).toHaveBeenCalledWith('service_error', {
        type: errors.RECEIVER_UNAVAILABLE
      });
    });

    test('Should call placeCall for the caller client if receiver abailable', () => {
      const client = handler.clients[0];
      client.placeCall = jest.fn();
      handler.broadcastClientsOnline = jest.fn();
      handler.manageCall(client, { username: 'Bar', offer: {} });

      expect(client.placeCall).toHaveBeenCalledTimes(1);
      expect(client.placeCall).toHaveBeenCalledWith(handler.clients[1], {});
      expect(handler.broadcastClientsOnline).toHaveBeenCalledTimes(1);
    });

  });

  describe('manageAnswer', () => {
    let handler;
    beforeEach(() => {
      handler = new SignalHandler({});
      handler.clients.push(new SignalClient(new MockSocket('1'), 'Foo'));
      handler.clients.push(new SignalClient(new MockSocket('2'), 'Bar'));
      handler.clients.push(new SignalClient(new MockSocket('3'), 'Biz'));
    });

    test('Should not proceed if receiving invalid data', () => {
      const client = handler.clients[0];
      client.placeAnswer = jest.fn(); // This func will get called if proceeded
      handler.broadcastClientsOnline = jest.fn();

      handler.manageAnswer(client, null);
      handler.manageAnswer(client, { answer: true });
      handler.manageAnswer(client, { answer: 'etekos' });
      expect(client.placeAnswer).toHaveBeenCalledTimes(0);

      handler.manageAnswer(client, { answer: {} });
      handler.manageAnswer(client, { answer: false });

      expect(client.placeAnswer).toHaveBeenCalledTimes(2);
      expect(handler.broadcastClientsOnline).toHaveBeenCalledTimes(2);
    });

    test('Should emit service info if no receiver found', () => {
      const client = handler.clients[0];
      client.socket.emit = jest.fn();
      client._initState = jest.fn();
      handler.broadcastClientsOnline = jest.fn();
      handler.manageAnswer(client, { answer: {} });

      expect(handler.broadcastClientsOnline).toHaveBeenCalledTimes(1);
      expect(client.socket.emit).toHaveBeenCalledTimes(1);
      expect(client._initState).toHaveBeenCalledTimes(1);
      expect(client.socket.emit).toHaveBeenCalledWith('service_error', {
        type: errors.RECEIVER_NOT_FOUND
      });
    });

    test('Should not emit service info if receiver found', () => {
      const caller = handler.clients[0];
      const receiver = handler.clients[1];

      caller.receiver = receiver;
      receiver.caller = caller;

      handler.broadcastClientsOnline = jest.fn();
      receiver.socket.emit = jest.fn();
      caller.socket.emit = jest.fn();
      handler.manageAnswer(receiver, { answer: {} });

      expect(caller.socket.emit).toHaveBeenCalledTimes(1);
      expect(caller.socket.emit).toHaveBeenCalledWith('answer', { answer: {} });
      expect(caller.state).toBe(states.CONNECTED);
      expect(receiver.state).toBe(states.CONNECTED);
      expect(handler.broadcastClientsOnline).toHaveBeenCalledTimes(1);
      expect(receiver.socket.emit).toHaveBeenCalledTimes(0);
    });
  });

  describe('manageCandidate', () => {
    let handler, client;
    beforeAll(() => {
      handler = new SignalHandler({});
      client = new SignalClient(new MockSocket('20'), 'Foo');
    });

    test('Should not proceed if receiving invalid candidate', () => {
      client.placeCandidate = jest.fn();

      handler.manageCandidate(client, { candidate: 'fifjkif' });
      handler.manageCandidate(client, { candidate: true });
      handler.manageCandidate(client, { candidate: 1323 });
      handler.manageCandidate(client, { candidate: null});
      handler.manageCandidate(client, null);

      expect(client.placeCandidate).toHaveBeenCalledTimes(0);

      handler.manageCandidate(client, { candidate: {} });

      expect(client.placeCandidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('prepareClientDisconnect', () => {
    let handler;
    beforeEach(() => {
      handler = new SignalHandler({});
      handler.clients.push(new SignalClient(new MockSocket('1'), 'Foo'));
      handler.clients.push(new SignalClient(new MockSocket('2'), 'Bar'));
      handler.clients.push(new SignalClient(new MockSocket('3'), 'Biz'));
    });

    test('Should call SignalClient.leaveCall if client is in call', () => {
      const client = handler.clients[0];
      client.leaveCall = jest.fn();
      client.state = states.RINGING;
      handler.prepareClientDisconnect(client, 'Client disconnect');

      expect(client.leaveCall).toHaveBeenCalledTimes(1);
    });

    test('Should remove the client from clients list', () => {
      expect(handler.clients.length).toBe(3);
      handler.prepareClientDisconnect(handler.clients[0], 'Client disconnect');
      expect(handler.clients.length).toBe(2);
    });
  });
});
