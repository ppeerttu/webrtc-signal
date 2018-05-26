const SignalHandler = require('./index');
const SignalClient = require('../SignalClient');
const MockSocket = require('../SignalClient/MockSocket');

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
});
