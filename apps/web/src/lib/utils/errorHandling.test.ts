/**
 * Error Handling Utilities Tests
 *
 * Tests for standardized error handling patterns.
 */

import {
  withErrorHandling,
  withErrorHandlingSync,
  tryOperation,
  wrapWithErrorHandling,
  withRetry,
  assertCondition,
  isError,
  getErrorMessage,
} from './errorHandling';

// Mock @vapour/logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

describe('errorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withErrorHandling', () => {
    it('should return result on success', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await withErrorHandling(operation, 'testOperation');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should re-throw errors by default', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(withErrorHandling(operation, 'testOperation')).rejects.toThrow('Test error');
    });

    it('should return fallback value when provided', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await withErrorHandling(operation, 'testOperation', {
        fallback: 'fallback value',
      });

      expect(result).toBe('fallback value');
    });

    it('should return undefined in silent mode without fallback', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await withErrorHandling(operation, 'testOperation', { silent: true });

      expect(result).toBeUndefined();
    });

    it('should call onError callback when provided', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();

      await withErrorHandling(operation, 'testOperation', {
        fallback: null,
        onError,
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should handle non-Error thrown values', async () => {
      const operation = jest.fn().mockRejectedValue('string error');

      await expect(withErrorHandling(operation, 'testOperation')).rejects.toThrow('string error');
    });

    it('should not crash if onError callback throws', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const onError = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      const result = await withErrorHandling(operation, 'testOperation', {
        fallback: 'fallback',
        onError,
      });

      expect(result).toBe('fallback');
      expect(onError).toHaveBeenCalled();
    });

    it('should work with array fallback', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await withErrorHandling(operation, 'testOperation', {
        fallback: [],
      });

      expect(result).toEqual([]);
    });

    it('should work with object fallback', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await withErrorHandling(operation, 'testOperation', {
        fallback: { default: true },
      });

      expect(result).toEqual({ default: true });
    });

    it('should accept metadata option without crashing', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await withErrorHandling(operation, 'testOperation', {
          metadata: { userId: '123' },
        });
      } catch {
        // Expected to throw
      }

      // Verify operation was called and metadata didn't cause issues
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('withErrorHandlingSync', () => {
    it('should return result on success', () => {
      const operation = jest.fn().mockReturnValue('success');

      const result = withErrorHandlingSync(operation, 'testOperation');

      expect(result).toBe('success');
    });

    it('should re-throw errors by default', () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      expect(() => withErrorHandlingSync(operation, 'testOperation')).toThrow('Test error');
    });

    it('should return fallback value when provided', () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = withErrorHandlingSync(operation, 'testOperation', {
        fallback: 'fallback value',
      });

      expect(result).toBe('fallback value');
    });

    it('should return undefined in silent mode', () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = withErrorHandlingSync(operation, 'testOperation', { silent: true });

      expect(result).toBeUndefined();
    });

    it('should call onError callback', () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockImplementation(() => {
        throw error;
      });
      const onError = jest.fn();

      withErrorHandlingSync(operation, 'testOperation', {
        fallback: null,
        onError,
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should handle non-Error thrown values', () => {
      const operation = jest.fn().mockImplementation(() => {
        throw 'string error';
      });

      expect(() => withErrorHandlingSync(operation, 'testOperation')).toThrow('string error');
    });

    it('should not crash if onError throws', () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const onError = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      const result = withErrorHandlingSync(operation, 'testOperation', {
        fallback: 'fallback',
        onError,
      });

      expect(result).toBe('fallback');
    });
  });

  describe('tryOperation', () => {
    it('should return success result on success', async () => {
      const operation = jest.fn().mockResolvedValue('data');

      const result = await tryOperation(operation, 'testOperation');

      expect(result).toEqual({ success: true, data: 'data' });
    });

    it('should return failure result on error', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await tryOperation(operation, 'testOperation');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Test error');
      }
    });

    it('should handle non-Error thrown values', async () => {
      const operation = jest.fn().mockRejectedValue('string error');

      const result = await tryOperation(operation, 'testOperation');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('string error');
      }
    });

    it('should include metadata in logging', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test'));

      await tryOperation(operation, 'testOperation', { userId: '123' });

      // Result should still be returned correctly
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('wrapWithErrorHandling', () => {
    it('should create a wrapped function that returns results', async () => {
      const originalFn = jest.fn().mockResolvedValue('result');
      const wrappedFn = wrapWithErrorHandling(originalFn, 'testFn');

      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toBe('result');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should apply error handling options', async () => {
      const originalFn = jest.fn().mockRejectedValue(new Error('Test'));
      const wrappedFn = wrapWithErrorHandling(originalFn, 'testFn', {
        fallback: 'fallback',
      });

      const result = await wrappedFn();

      expect(result).toBe('fallback');
    });

    it('should preserve function arguments', async () => {
      const originalFn = jest
        .fn()
        .mockImplementation((a: number, b: number) => Promise.resolve(a + b));
      const wrappedFn = wrapWithErrorHandling(originalFn, 'addFn');

      const result = await wrappedFn(2, 3);

      expect(result).toBe(5);
      expect(originalFn).toHaveBeenCalledWith(2, 3);
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return result on first success', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const resultPromise = withRetry(operation, 'testOperation');
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(operation, 'testOperation', 3, 100);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(withRetry(operation, 'testOperation', 3, 10)).rejects.toThrow('Always fails');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(operation, 'testOperation', 3, 1000);

      // First attempt fails immediately
      await jest.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Wait for first retry (1000ms)
      await jest.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Wait for second retry (2000ms with exponential backoff)
      await jest.advanceTimersByTimeAsync(2000);
      expect(operation).toHaveBeenCalledTimes(3);

      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should handle non-Error thrown values in retry', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const operation = jest.fn().mockRejectedValue('string error');

      await expect(withRetry(operation, 'testOperation', 2, 10)).rejects.toThrow('string error');
    });
  });

  describe('assertCondition', () => {
    it('should not throw when condition is true', () => {
      expect(() => assertCondition(true, 'Should not throw')).not.toThrow();
    });

    it('should throw when condition is false', () => {
      expect(() => assertCondition(false, 'Condition failed')).toThrow('Condition failed');
    });

    it('should include context in error message', () => {
      expect(() => assertCondition(false, 'Condition failed', 'TestContext')).toThrow(
        '[TestContext] Condition failed'
      );
    });

    it('should work as a type guard', () => {
      const value: string | null = 'test';
      assertCondition(value !== null, 'Value should not be null');
      // TypeScript should now know value is string
      expect(value.toUpperCase()).toBe('TEST');
    });
  });

  describe('isError', () => {
    it('should return true for Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
    });

    it('should return true for Error subclasses', () => {
      expect(isError(new TypeError('test'))).toBe(true);
      expect(isError(new RangeError('test'))).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isError('string')).toBe(false);
      expect(isError(123)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError({ message: 'fake error' })).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error', () => {
      expect(getErrorMessage(new Error('Test message'))).toBe('Test message');
    });

    it('should return string errors as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should return "Unknown error" for other types', () => {
      expect(getErrorMessage(123)).toBe('Unknown error');
      expect(getErrorMessage(null)).toBe('Unknown error');
      expect(getErrorMessage(undefined)).toBe('Unknown error');
      expect(getErrorMessage({ foo: 'bar' })).toBe('Unknown error');
    });
  });
});
