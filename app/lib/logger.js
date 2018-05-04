const winston = require('winston');
const pjson = require('../../package.json');

let instance = null;

/**
 * Represents kind of a singleton pattern.
 * @example
 * const Logger = require('../<path>/logger');
 * const logger = Logger.getInstance();
 * logger.add('info', 'Logger initialized and working now!');
 */
class Logger {

  constructor() {
    const logLevel = process.env.NODE_ENV === 'development' ? 'silly' : 'verbose',
      consoleTransport = new winston.transports.Console({
        timestamp: true,
        level: logLevel
      });

    // No logging in test environment
    if (process.env.NODE_ENV === 'test') {
      this.logger = new (winston.Logger)({ transports: [] });
    } else {
      this.logger = new (winston.Logger)({
        transports: [consoleTransport]
      });
    }

    this.logger.log('warn', `Logger initialized, software version ${pjson.version}, log level ${logLevel}, environment ${process.env.NODE_ENV}`);
  }

  /**
   * Get the Logger instance.
   * @return {Logger} - The singleton Logger instance.
   */
  static getInstance() {
    if (instance === null || !instance.logger) {
      console.warn(new Date().toLocaleDateString(process.env.ZD_LANG, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      }) + ' -- Initializing logger...');
      instance = new Logger();
    }
    return instance;
  }

  /**
   * Log message or HTTP requests.
   * @example
   * logger.add('info', 'Info message');
   * logger.add('silly', { foo: 'bar' });
   * @example
   * logger.add('verbose', '', response);
   * @param {string} logLevel - The level of logging
   * @param {string|Object} message - The message to be logged
   * @param {Object} request - The request object
   */
  add(logLevel, message, request) {
    if (request) {
      let filteredReq = '';
      filteredReq += request.method;
      filteredReq += ' ' + request.url;
      this.logger.log(logLevel,  filteredReq);
    } else {
      this.logger.log(logLevel, message);
    }
  }

  /**
   * The Sequelize needs static method for logging
   * probably due to module caching
   * @param {string} query - The SQL query to be logged
   */
  static logQuery(query) {
    if (!instance) {
      console.warn('Failed to log query: logger not initialized!');
      return;
    }
    instance.logger.log('info', query);
  }

}

module.exports = Logger;
