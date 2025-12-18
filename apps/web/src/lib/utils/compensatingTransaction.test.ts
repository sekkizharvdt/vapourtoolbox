/**
 * Compensating Transaction Tests
 */

import {
  CompensatingSaga,
  SagaFailedError,
  FileUploadTracker,
  withFileCleanup,
} from './compensatingTransaction';

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('CompensatingSaga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute action and register compensation', async () => {
      const saga = new CompensatingSaga();
      const action = jest.fn().mockResolvedValue({ id: 'doc-1' });
      const compensate = jest.fn().mockResolvedValue(undefined);

      const result = await saga.execute('Create document', action, compensate, 'Delete document');

      expect(result).toEqual({ id: 'doc-1' });
      expect(action).toHaveBeenCalledTimes(1);
      expect(saga.completedSteps).toBe(1);
      expect(saga.stepNames).toEqual(['Create document']);
    });

    it('should execute multiple steps in sequence', async () => {
      const saga = new CompensatingSaga();

      await saga.execute(
        'Step 1',
        () => Promise.resolve('result-1'),
        () => Promise.resolve(),
        'Undo step 1'
      );

      await saga.execute(
        'Step 2',
        () => Promise.resolve('result-2'),
        () => Promise.resolve(),
        'Undo step 2'
      );

      expect(saga.completedSteps).toBe(2);
      expect(saga.stepNames).toEqual(['Step 1', 'Step 2']);
    });

    it('should trigger compensation on failure', async () => {
      const saga = new CompensatingSaga();
      const compensate1 = jest.fn().mockResolvedValue(undefined);
      const compensate2 = jest.fn().mockResolvedValue(undefined);

      await saga.execute('Step 1', () => Promise.resolve('a'), compensate1, 'Undo 1');
      await saga.execute('Step 2', () => Promise.resolve('b'), compensate2, 'Undo 2');

      await expect(
        saga.execute(
          'Step 3',
          () => Promise.reject(new Error('Step 3 failed')),
          jest.fn(),
          'Undo 3'
        )
      ).rejects.toThrow('Step 3 failed');

      // Compensations should run in reverse order
      expect(compensate2).toHaveBeenCalled();
      expect(compensate1).toHaveBeenCalled();
      // Step 3 never completed, so no compensation registered for it
    });

    it('should pass result to compensation function', async () => {
      const saga = new CompensatingSaga();
      const compensate = jest.fn().mockResolvedValue(undefined);

      await saga.execute(
        'Upload file',
        () => Promise.resolve({ path: '/uploads/file.pdf' }),
        compensate,
        'Delete file'
      );

      // Simulate failure in next step
      await expect(
        saga.execute(
          'Create record',
          () => Promise.reject(new Error('DB error')),
          jest.fn(),
          'Delete record'
        )
      ).rejects.toThrow('DB error');

      expect(compensate).toHaveBeenCalledWith({ path: '/uploads/file.pdf' });
    });
  });

  describe('compensate', () => {
    it('should execute compensations in reverse order (LIFO)', async () => {
      const saga = new CompensatingSaga();
      const order: number[] = [];

      await saga.execute(
        'Step 1',
        () => Promise.resolve(1),
        async () => {
          order.push(1);
        },
        'Undo 1'
      );
      await saga.execute(
        'Step 2',
        () => Promise.resolve(2),
        async () => {
          order.push(2);
        },
        'Undo 2'
      );
      await saga.execute(
        'Step 3',
        () => Promise.resolve(3),
        async () => {
          order.push(3);
        },
        'Undo 3'
      );

      await saga.compensate();

      expect(order).toEqual([3, 2, 1]);
    });

    it('should continue on compensation error by default', async () => {
      const saga = new CompensatingSaga();

      await saga.execute(
        'Step 1',
        () => Promise.resolve(1),
        () => Promise.resolve(),
        'Undo 1'
      );
      await saga.execute(
        'Step 2',
        () => Promise.resolve(2),
        () => Promise.reject(new Error('Compensation failed')),
        'Undo 2'
      );
      await saga.execute(
        'Step 3',
        () => Promise.resolve(3),
        () => Promise.resolve(),
        'Undo 3'
      );

      const result = await saga.compensate();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toBe('Compensation failed');
    });

    it('should stop on compensation error when configured', async () => {
      const saga = new CompensatingSaga({ continueOnCompensationError: false });
      const compensate1 = jest.fn().mockResolvedValue(undefined);

      await saga.execute('Step 1', () => Promise.resolve(1), compensate1, 'Undo 1');
      await saga.execute(
        'Step 2',
        () => Promise.resolve(2),
        () => Promise.reject(new Error('Compensation failed')),
        'Undo 2'
      );
      await saga.execute(
        'Step 3',
        () => Promise.resolve(3),
        () => Promise.resolve(),
        'Undo 3'
      );

      const result = await saga.compensate();

      // Step 1's compensation should not have been called due to early stop
      expect(compensate1).not.toHaveBeenCalled();
      expect(result.errors).toHaveLength(1);
    });

    it('should clear steps after compensation', async () => {
      const saga = new CompensatingSaga();

      await saga.execute(
        'Step 1',
        () => Promise.resolve(1),
        () => Promise.resolve(),
        'Undo 1'
      );
      expect(saga.completedSteps).toBe(1);

      await saga.compensate();

      expect(saga.completedSteps).toBe(0);
      expect(saga.stepNames).toEqual([]);
    });

    it('should handle compensation timeout', async () => {
      const saga = new CompensatingSaga({ compensationTimeout: 100 });

      await saga.execute(
        'Step 1',
        () => Promise.resolve(1),
        () => new Promise((resolve) => setTimeout(resolve, 500)), // Takes longer than timeout
        'Undo 1'
      );

      const result = await saga.compensate();

      expect(result.success).toBe(false);
      expect(result.errors[0]!.message).toContain('Compensation timeout');
    });
  });

  describe('completedSteps', () => {
    it('should return 0 for new saga', () => {
      const saga = new CompensatingSaga();

      expect(saga.completedSteps).toBe(0);
    });

    it('should track completed steps accurately', async () => {
      const saga = new CompensatingSaga();

      expect(saga.completedSteps).toBe(0);

      await saga.execute(
        'Step 1',
        () => Promise.resolve(1),
        () => Promise.resolve(),
        'Undo 1'
      );
      expect(saga.completedSteps).toBe(1);

      await saga.execute(
        'Step 2',
        () => Promise.resolve(2),
        () => Promise.resolve(),
        'Undo 2'
      );
      expect(saga.completedSteps).toBe(2);
    });
  });

  describe('stepNames', () => {
    it('should return empty array for new saga', () => {
      const saga = new CompensatingSaga();

      expect(saga.stepNames).toEqual([]);
    });

    it('should return step names in order', async () => {
      const saga = new CompensatingSaga();

      await saga.execute(
        'First step',
        () => Promise.resolve(1),
        () => Promise.resolve(),
        'Undo'
      );
      await saga.execute(
        'Second step',
        () => Promise.resolve(2),
        () => Promise.resolve(),
        'Undo'
      );

      expect(saga.stepNames).toEqual(['First step', 'Second step']);
    });
  });
});

describe('withFileCleanup', () => {
  it('should return result on success', async () => {
    const uploadFn = jest
      .fn()
      .mockResolvedValue({ path: '/uploads/file.pdf', result: { url: 'http://...' } });
    const deleteFn = jest.fn();
    const operationFn = jest.fn().mockResolvedValue(undefined);

    const result = await withFileCleanup(uploadFn, deleteFn, operationFn);

    expect(result).toEqual({ url: 'http://...' });
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('should clean up file on operation failure', async () => {
    const uploadFn = jest
      .fn()
      .mockResolvedValue({ path: '/uploads/file.pdf', result: { url: 'http://...' } });
    const deleteFn = jest.fn().mockResolvedValue(undefined);
    const operationFn = jest.fn().mockRejectedValue(new Error('DB write failed'));

    await expect(withFileCleanup(uploadFn, deleteFn, operationFn)).rejects.toThrow(
      'DB write failed'
    );
    expect(deleteFn).toHaveBeenCalledWith('/uploads/file.pdf');
  });

  it('should still throw original error even if cleanup fails', async () => {
    const uploadFn = jest.fn().mockResolvedValue({ path: '/uploads/file.pdf', result: {} });
    const deleteFn = jest.fn().mockRejectedValue(new Error('Delete failed'));
    const operationFn = jest.fn().mockRejectedValue(new Error('Original error'));

    await expect(withFileCleanup(uploadFn, deleteFn, operationFn)).rejects.toThrow(
      'Original error'
    );
    expect(deleteFn).toHaveBeenCalled();
  });
});

describe('FileUploadTracker', () => {
  describe('track', () => {
    it('should track uploaded file paths', () => {
      const deleteFn = jest.fn();
      const tracker = new FileUploadTracker(deleteFn);

      tracker.track('/uploads/file1.pdf');
      tracker.track('/uploads/file2.pdf');

      expect(tracker.paths).toEqual(['/uploads/file1.pdf', '/uploads/file2.pdf']);
    });
  });

  describe('paths', () => {
    it('should return empty array initially', () => {
      const tracker = new FileUploadTracker(jest.fn());

      expect(tracker.paths).toEqual([]);
    });

    it('should return copy of paths (not mutable reference)', () => {
      const tracker = new FileUploadTracker(jest.fn());
      tracker.track('/file1');

      const paths = tracker.paths;
      paths.push('/file2'); // Mutate returned array

      expect(tracker.paths).toEqual(['/file1']); // Original should be unchanged
    });
  });

  describe('cleanup', () => {
    it('should delete all tracked files', async () => {
      const deleteFn = jest.fn().mockResolvedValue(undefined);
      const tracker = new FileUploadTracker(deleteFn);

      tracker.track('/uploads/file1.pdf');
      tracker.track('/uploads/file2.pdf');

      const result = await tracker.cleanup();

      expect(deleteFn).toHaveBeenCalledTimes(2);
      expect(deleteFn).toHaveBeenCalledWith('/uploads/file1.pdf');
      expect(deleteFn).toHaveBeenCalledWith('/uploads/file2.pdf');
      expect(result.cleaned).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should continue cleaning on individual failures', async () => {
      const deleteFn = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);
      const tracker = new FileUploadTracker(deleteFn);

      tracker.track('/file1');
      tracker.track('/file2');
      tracker.track('/file3');

      const result = await tracker.cleanup();

      expect(deleteFn).toHaveBeenCalledTimes(3);
      expect(result.cleaned).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should clear tracked paths after cleanup', async () => {
      const deleteFn = jest.fn().mockResolvedValue(undefined);
      const tracker = new FileUploadTracker(deleteFn);

      tracker.track('/file1');
      await tracker.cleanup();

      expect(tracker.paths).toEqual([]);
    });

    it('should handle non-Error throws', async () => {
      const deleteFn = jest.fn().mockRejectedValue('string error');
      const tracker = new FileUploadTracker(deleteFn);

      tracker.track('/file1');

      const result = await tracker.cleanup();

      expect(result.failed).toBe(1);
      expect(result.errors[0]!.message).toBe('string error');
    });
  });
});

describe('SagaFailedError', () => {
  it('should create error with correct properties', () => {
    const originalError = new Error('Step 3 failed');
    const compensationErrors = [new Error('Cleanup 1 failed'), new Error('Cleanup 2 failed')];

    const error = new SagaFailedError(
      'Saga failed during step 3',
      originalError,
      compensationErrors,
      ['Step 1', 'Step 2']
    );

    expect(error.message).toBe('Saga failed during step 3');
    expect(error.name).toBe('SagaFailedError');
    expect(error.originalError).toBe(originalError);
    expect(error.compensationErrors).toBe(compensationErrors);
    expect(error.completedSteps).toEqual(['Step 1', 'Step 2']);
  });

  it('should be instanceof Error', () => {
    const error = new SagaFailedError('Test', new Error(), [], []);
    expect(error).toBeInstanceOf(Error);
  });
});
