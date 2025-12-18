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

    describe('error', () => {
        it('should log errors to console', () => {
            consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const message = 'Test error';
            const error = new Error('Something went wrong');

            logger.error(message, { error });

            expect(consoleSpy).toHaveBeenCalled();
            const callArgs = consoleSpy.mock.calls[0];
            const jsonString = JSON.stringify(callArgs).toLowerCase();
            expect(jsonString).toContain(message.toLowerCase());
        });
    });
});
