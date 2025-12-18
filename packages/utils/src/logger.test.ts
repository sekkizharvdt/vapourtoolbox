import { logger } from './logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Clean up mocks
    jest.clearAllMocks();
  });

  describe('info', () => {
    it('should log info messages to console', () => {
      consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      const message = 'Test info message';
      const meta = { userId: '123' };

      logger.info(message, meta);

      expect(consoleSpy).toHaveBeenCalled();
      // Since the actual implementation might stringify or format differently,
      // we check if the message is contained in the call
      const callArgs = consoleSpy.mock.calls[0];
      const jsonString = JSON.stringify(callArgs).toLowerCase();
      expect(jsonString).toContain(message.toLowerCase());
    });
  });

  describe('warn', () => {
    it('should log warnings to console', () => {
      consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const message = 'Test warning';

      logger.warn(message);

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      const jsonString = JSON.stringify(callArgs).toLowerCase();
      expect(jsonString).toContain(message.toLowerCase());
    });
  });

  describe('debug', () => {
    it('should log debug messages to console', () => {
      consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      // Force enable debug logging for this test since default minLevel is 'info'
      process.env.LOG_LEVEL = 'debug';
      // We need to re-import or re-instantiate because config is set in constructor
      const { Logger } = require('./logger');
      const debugLogger = new Logger();

      const message = 'Test debug message';
      debugLogger.debug(message);

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      const jsonString = JSON.stringify(callArgs).toLowerCase();
      expect(jsonString).toContain(message.toLowerCase());

      delete process.env.LOG_LEVEL;
    });
  });

  describe('error', () => {
    it('should log errors to console', () => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const message = 'Test error';
      const error = new Error('Something went wrong');

      logger.error(message, error);

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      const jsonString = JSON.stringify(callArgs).toLowerCase();
      expect(jsonString).toContain(message.toLowerCase());
    });
  });

  describe('Factory and Child Loggers', () => {
    it('should create logger with prefix using createLogger', () => {
      consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      const { createLogger } = require('./logger');
      const prefixedLogger = createLogger('TEST');

      prefixedLogger.info('Hello');

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[0]).toContain('[TEST]');
    });

    it('should create child logger with nested prefix', () => {
      consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      const parentLogger = logger.child('PARENT');
      const childLogger = parentLogger.child('CHILD');

      childLogger.info('Hello');

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[0]).toContain('[PARENT:CHILD]');
    });
  });

  describe('Environment Configuration', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
      process.env = ORIGINAL_ENV;
    });

    it('should disable logging in production', () => {
      process.env.NODE_ENV = 'production';
      consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      const { Logger } = require('./logger');
      const prodLogger = new Logger();

      prodLogger.info('Should not log');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should filter logs based on minLevel', () => {
      process.env.LOG_LEVEL = 'warn';
      consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { Logger } = require('./logger');
      const filteredLogger = new Logger();

      filteredLogger.info('Should be filtered'); // info < warn
      filteredLogger.warn('Should be logged'); // warn >= warn

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
