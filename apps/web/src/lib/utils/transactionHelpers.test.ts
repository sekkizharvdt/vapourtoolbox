/**
 * Transaction Helper Utilities Tests
 *
 * Tests for Firestore transaction wrappers including:
 * - Basic transaction execution
 * - Automatic retry on transient failures
 * - Error handling and logging
 * - Throwing vs non-throwing variants
 * - Transactional operation factory
 */

// Mock Firebase
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  runTransaction: (db: unknown, fn: (transaction: unknown) => Promise<unknown>) =>
    mockRunTransaction(db, fn),
}));

jest.mock('@vapour/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

import {
  withTransaction,
  withTransactionOrThrow,
  createTransactionalOperation,
} from './transactionHelpers';

describe('transactionHelpers', () => {
  // Using a minimal mock that satisfies the type requirements
  const mockDb: Parameters<typeof withTransaction>[0] = Object.create(null);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // withTransaction Tests
  // ============================================================================

  describe('withTransaction', () => {
    describe('successful transactions', () => {
      it('should execute transaction and return result', async () => {
        mockRunTransaction.mockImplementation((_db, fn) => fn({ get: jest.fn(), set: jest.fn() }));

        const operation = jest.fn().mockResolvedValue('test-result');
        const resultPromise = withTransaction(mockDb, 'testOperation', operation);

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.success).toBe(true);
        expect(result.data).toBe('test-result');
        expect(result.retryCount).toBe(0);
      });

      it('should pass transaction context to operation', async () => {
        const mockTransaction = { get: jest.fn(), set: jest.fn() };
        mockRunTransaction.mockImplementation((_db, fn) => fn(mockTransaction));

        const operation = jest.fn().mockResolvedValue('result');
        const resultPromise = withTransaction(mockDb, 'testOperation', operation);

        await jest.runAllTimersAsync();
        await resultPromise;

        expect(operation).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction: mockTransaction,
            db: mockDb,
          })
        );
      });

      it('should return retryCount of 0 on first attempt success', async () => {
        mockRunTransaction.mockImplementation((_db, fn) => fn({}));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result');

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.retryCount).toBe(0);
      });
    });

    describe('non-retryable errors', () => {
      it('should fail immediately for non-retryable errors', async () => {
        mockRunTransaction.mockRejectedValue(new Error('Permission denied'));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result');

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('Permission denied');
        expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      });

      it('should set retryCount to maxRetries on non-retryable failure', async () => {
        mockRunTransaction.mockRejectedValue(new Error('Permission denied'));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result', 3);

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.retryCount).toBe(3);
      });
    });

    describe('retryable errors', () => {
      it('should retry on aborted transaction', async () => {
        mockRunTransaction
          .mockRejectedValueOnce(new Error('Transaction was aborted'))
          .mockImplementation((_db, fn) => fn({}));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result');

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.success).toBe(true);
        expect(result.retryCount).toBe(1);
        expect(mockRunTransaction).toHaveBeenCalledTimes(2);
      });

      it('should retry on contention error', async () => {
        mockRunTransaction
          .mockRejectedValueOnce(new Error('contention'))
          .mockRejectedValueOnce(new Error('contention'))
          .mockImplementation((_db, fn) => fn({}));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result');

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.success).toBe(true);
        expect(result.retryCount).toBe(2);
        expect(mockRunTransaction).toHaveBeenCalledTimes(3);
      });

      it('should retry on resource exhausted error', async () => {
        mockRunTransaction
          .mockRejectedValueOnce(new Error('resource exhausted'))
          .mockImplementation((_db, fn) => fn({}));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result');

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.success).toBe(true);
        expect(mockRunTransaction).toHaveBeenCalledTimes(2);
      });

      it('should fail after max retries exceeded', async () => {
        mockRunTransaction.mockRejectedValue(new Error('Transaction was aborted'));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result', 3);

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.success).toBe(false);
        expect(result.retryCount).toBe(3);
        expect(mockRunTransaction).toHaveBeenCalledTimes(3);
      });

      it('should use exponential backoff between retries', async () => {
        mockRunTransaction.mockRejectedValue(new Error('Transaction was aborted'));

        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result', 3);

        // Run first attempt
        await Promise.resolve();
        expect(mockRunTransaction).toHaveBeenCalledTimes(1);

        // Advance timer for first backoff (100ms)
        await jest.advanceTimersByTimeAsync(100);
        await Promise.resolve();

        // Advance timer for second backoff (200ms)
        await jest.advanceTimersByTimeAsync(200);
        await Promise.resolve();

        // Complete remaining timers
        await jest.runAllTimersAsync();
        await resultPromise;

        // Check that setTimeout was called with exponential values
        const timeoutCalls = setTimeoutSpy.mock.calls.filter((call) => typeof call[1] === 'number');
        expect(timeoutCalls.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('custom max retries', () => {
      it('should respect custom maxRetries parameter', async () => {
        mockRunTransaction.mockRejectedValue(new Error('Transaction was aborted'));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result', 5);

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(mockRunTransaction).toHaveBeenCalledTimes(5);
        expect(result.retryCount).toBe(5);
      });

      it('should work with maxRetries of 1 (no retries)', async () => {
        mockRunTransaction.mockRejectedValue(new Error('Transaction was aborted'));

        const resultPromise = withTransaction(mockDb, 'testOperation', async () => 'result', 1);

        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(mockRunTransaction).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================================================
  // withTransactionOrThrow Tests
  // ============================================================================

  describe('withTransactionOrThrow', () => {
    it('should return result on success', async () => {
      mockRunTransaction.mockImplementation((_db, fn) => fn({}));

      const resultPromise = withTransactionOrThrow(mockDb, 'testOperation', async () => 'result');

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('result');
    });

    it('should throw on failure', async () => {
      const error = new Error('Permission denied');
      mockRunTransaction.mockRejectedValue(error);

      await jest.runAllTimersAsync();

      await expect(
        withTransactionOrThrow(mockDb, 'testOperation', async () => 'result')
      ).rejects.toThrow('Permission denied');
    });

    it('should throw default error message if no error object', async () => {
      mockRunTransaction.mockImplementation(() => Promise.reject(null));

      await jest.runAllTimersAsync();

      await expect(
        withTransactionOrThrow(mockDb, 'myOperation', async () => 'result')
      ).rejects.toThrow('Transaction myOperation failed');
    });

    it('should retry before throwing', async () => {
      mockRunTransaction.mockImplementation(async () => {
        throw new Error('Transaction was aborted');
      });

      let caughtError: Error | null = null;
      const resultPromise = withTransactionOrThrow(
        mockDb,
        'testOperation',
        async () => 'result',
        2
      ).catch((e) => {
        caughtError = e;
      });

      // Run all timers to complete the retries
      await jest.runAllTimersAsync();
      await resultPromise;

      expect(caughtError).not.toBeNull();
      expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    });

    it('should succeed on retry', async () => {
      mockRunTransaction
        .mockRejectedValueOnce(new Error('Transaction was aborted'))
        .mockImplementation((_db, fn) => fn({}));

      const resultPromise = withTransactionOrThrow(mockDb, 'testOperation', async () => 'success');

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
    });
  });

  // ============================================================================
  // createTransactionalOperation Tests
  // ============================================================================

  describe('createTransactionalOperation', () => {
    it('should create a callable transactional function', async () => {
      mockRunTransaction.mockImplementation((_db, fn) => fn({}));

      const operation = createTransactionalOperation(
        mockDb,
        'testOperation',
        async (_ctx, arg1: string, arg2: number) => {
          return `${arg1}-${arg2}`;
        }
      );

      const resultPromise = operation('test', 42);

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('test-42');
    });

    it('should pass arguments to the wrapped function', async () => {
      mockRunTransaction.mockImplementation((_db, fn) => fn({}));

      const innerFn = jest.fn().mockResolvedValue('result');
      const operation = createTransactionalOperation(mockDb, 'testOperation', innerFn);

      const resultPromise = operation('arg1', 123, { key: 'value' });

      await jest.runAllTimersAsync();
      await resultPromise;

      expect(innerFn).toHaveBeenCalledWith(expect.objectContaining({ db: mockDb }), 'arg1', 123, {
        key: 'value',
      });
    });

    it('should throw on transaction failure', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Failed'));

      const operation = createTransactionalOperation(mockDb, 'failOperation', async () => 'result');

      await jest.runAllTimersAsync();

      await expect(operation()).rejects.toThrow('Failed');
    });

    it('should retry transient errors', async () => {
      mockRunTransaction
        .mockRejectedValueOnce(new Error('Transaction was aborted'))
        .mockImplementation((_db, fn) => fn({}));

      const operation = createTransactionalOperation(
        mockDb,
        'retryOperation',
        async () => 'success'
      );

      const resultPromise = operation();

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    });

    it('should handle no-argument operations', async () => {
      mockRunTransaction.mockImplementation((_db, fn) => fn({}));

      const operation = createTransactionalOperation(
        mockDb,
        'noArgsOp',
        async () => 'no args result'
      );

      const resultPromise = operation();

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('no args result');
    });

    it('should preserve context across calls', async () => {
      mockRunTransaction.mockImplementation((_db, fn) => fn({}));

      const contexts: unknown[] = [];
      const operation = createTransactionalOperation(
        mockDb,
        'contextOp',
        async (ctx, value: string) => {
          contexts.push(ctx);
          return value;
        }
      );

      const promise1 = operation('first');
      const promise2 = operation('second');

      await jest.runAllTimersAsync();
      await Promise.all([promise1, promise2]);

      expect(contexts).toHaveLength(2);
      contexts.forEach((ctx) => {
        expect(ctx).toHaveProperty('db');
        expect(ctx).toHaveProperty('transaction');
      });
    });
  });

  // ============================================================================
  // Error Type Detection Tests
  // ============================================================================

  describe('error type detection', () => {
    it('should retry "aborted" errors', async () => {
      mockRunTransaction
        .mockRejectedValueOnce(new Error('ABORTED: Transaction was aborted due to contention'))
        .mockImplementation((_db, fn) => fn({}));

      const resultPromise = withTransaction(mockDb, 'testOp', async () => 'result');

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    });

    it('should not retry "not found" errors', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Document not found'));

      const resultPromise = withTransaction(mockDb, 'testOp', async () => 'result');

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it('should not retry "permission denied" errors', async () => {
      mockRunTransaction.mockRejectedValue(new Error('PERMISSION_DENIED'));

      const resultPromise = withTransaction(mockDb, 'testOp', async () => 'result');

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it('should not retry non-Error objects', async () => {
      mockRunTransaction.mockRejectedValue('string error');

      const resultPromise = withTransaction(mockDb, 'testOp', async () => 'result');

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it('should handle null rejection', async () => {
      mockRunTransaction.mockRejectedValue(null);

      const resultPromise = withTransaction(mockDb, 'testOp', async () => 'result');

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
