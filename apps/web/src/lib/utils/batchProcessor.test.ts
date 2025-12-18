/**
 * Batch Processor Tests
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import {
  processBatch,
  processParallelBatch,
  chunkArray,
  type BatchProgress,
} from './batchProcessor';

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('batchProcessor', () => {
  describe('processBatch', () => {
    it('should process all items', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => item * 2);

      const result = await processBatch(items, processor);

      expect(result.results).toEqual([2, 4, 6, 8, 10]);
      expect(result.successCount).toBe(5);
      expect(result.errorCount).toBe(0);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it('should pass correct index to processor', async () => {
      const items = ['a', 'b', 'c'];
      const indices: number[] = [];
      const processor = jest.fn().mockImplementation(async (_item: string, index: number) => {
        indices.push(index);
        return index;
      });

      await processBatch(items, processor);

      expect(indices).toEqual([0, 1, 2]);
    });

    it('should handle empty array', async () => {
      const result = await processBatch([], async () => 'result');

      expect(result.results).toEqual([]);
      expect(result.processedCount).toBe(0);
      expect(result.successCount).toBe(0);
    });

    it('should respect batchSize', async () => {
      const items = [1, 2, 3, 4, 5];
      const batchNumbers: number[] = [];
      const onProgress = jest.fn().mockImplementation((progress: BatchProgress) => {
        batchNumbers.push(progress.currentBatch);
      });

      await processBatch(items, async (item) => item, { batchSize: 2, onProgress });

      expect(batchNumbers).toContain(1);
      expect(batchNumbers).toContain(2);
      expect(batchNumbers).toContain(3); // 5 items / 2 batch size = 3 batches
    });

    it('should collect errors without stopping by default', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item === 3) throw new Error('Item 3 failed');
        return item;
      });

      const result = await processBatch(items, processor);

      expect(result.successCount).toBe(4);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0]?.index).toBe(2);
      expect(result.errors[0]?.error.message).toBe('Item 3 failed');
    });

    it('should stop on error when stopOnError is true', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item === 3) throw new Error('Item 3 failed');
        return item;
      });

      const result = await processBatch(items, processor, { stopOnError: true });

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(processor).toHaveBeenCalledTimes(3); // Stopped after error
    });

    it('should report progress', async () => {
      const items = [1, 2, 3, 4];
      const progressReports: BatchProgress[] = [];
      const onProgress = jest.fn().mockImplementation((progress: BatchProgress) => {
        progressReports.push({ ...progress });
      });

      await processBatch(items, async (item) => item, { batchSize: 2, onProgress });

      expect(progressReports).toHaveLength(2);
      expect(progressReports[0]?.currentBatch).toBe(1);
      expect(progressReports[0]?.totalBatches).toBe(2);
      expect(progressReports[0]?.percentComplete).toBe(50);
      expect(progressReports[1]?.percentComplete).toBe(100);
    });

    it('should include timing information', async () => {
      const items = [1, 2, 3];

      const result = await processBatch(items, async (item) => item);

      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle delay between batches', async () => {
      const items = [1, 2, 3, 4];
      const startTime = Date.now();

      await processBatch(items, async (item) => item, {
        batchSize: 2,
        delayBetweenBatches: 50,
      });

      const elapsed = Date.now() - startTime;
      // With 2 batches and 50ms delay between them, should take at least 50ms
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some timing tolerance
    });

    it('should handle non-Error thrown values', async () => {
      const items = [1];
      const processor = jest.fn().mockImplementation(async () => {
        throw 'string error';
      });

      const result = await processBatch(items, processor);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0]?.error.message).toBe('string error');
    });
  });

  describe('processParallelBatch', () => {
    it('should process all items', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => item * 2);

      const result = await processParallelBatch(items, processor);

      expect(result.results).toHaveLength(5);
      expect(result.successCount).toBe(5);
      expect(result.errorCount).toBe(0);
    });

    it('should process items in parallel within batch', async () => {
      const items = [1, 2, 3, 4];
      const startTimes: number[] = [];

      const processor = jest.fn().mockImplementation(async (_item: number, index: number) => {
        startTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 50));
        return index;
      });

      await processParallelBatch(items, processor, { batchSize: 4 });

      // All items should start at roughly the same time (parallel)
      const timeDiffs = startTimes.map((t) => t - startTimes[0]!);
      expect(timeDiffs.every((diff) => diff < 20)).toBe(true);
    });

    it('should collect errors without stopping', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item === 3) throw new Error('Item 3 failed');
        return item;
      });

      const result = await processParallelBatch(items, processor);

      expect(result.successCount).toBe(4);
      expect(result.errorCount).toBe(1);
    });

    it('should report progress after each batch', async () => {
      const items = [1, 2, 3, 4];
      const progressReports: BatchProgress[] = [];
      const onProgress = jest.fn().mockImplementation((progress: BatchProgress) => {
        progressReports.push({ ...progress });
      });

      await processParallelBatch(items, async (item) => item, { batchSize: 2, onProgress });

      expect(progressReports).toHaveLength(2);
      expect(progressReports[1]?.percentComplete).toBe(100);
    });

    it('should handle empty array', async () => {
      const result = await processParallelBatch([], async () => 'result');

      expect(result.results).toEqual([]);
      expect(result.processedCount).toBe(0);
    });
  });

  describe('chunkArray', () => {
    it('should chunk array into equal parts', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const chunks = chunkArray(array, 2);

      expect(chunks).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
    });

    it('should handle uneven chunks', () => {
      const array = [1, 2, 3, 4, 5];
      const chunks = chunkArray(array, 2);

      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle chunk size larger than array', () => {
      const array = [1, 2, 3];
      const chunks = chunkArray(array, 10);

      expect(chunks).toEqual([[1, 2, 3]]);
    });

    it('should handle empty array', () => {
      const chunks = chunkArray([], 5);

      expect(chunks).toEqual([]);
    });

    it('should handle chunk size of 1', () => {
      const array = [1, 2, 3];
      const chunks = chunkArray(array, 1);

      expect(chunks).toEqual([[1], [2], [3]]);
    });
  });

  describe('BatchResult structure', () => {
    it('should include all required fields', async () => {
      const items = [1, 2, 3];
      const result = await processBatch(items, async (item) => item);

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('processedCount');
      expect(result).toHaveProperty('successCount');
      expect(result).toHaveProperty('errorCount');
      expect(result).toHaveProperty('totalTimeMs');
    });

    it('should have consistent counts', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        if (item % 2 === 0) throw new Error('Even number');
        return item;
      });

      const result = await processBatch(items, processor);

      expect(result.processedCount).toBe(result.successCount + result.errorCount);
      expect(result.results.length).toBe(result.successCount);
      expect(result.errors.length).toBe(result.errorCount);
    });
  });

  describe('BatchProgress structure', () => {
    it('should include all required fields', async () => {
      let capturedProgress: BatchProgress | null = null;
      const onProgress = (progress: BatchProgress) => {
        capturedProgress = progress;
      };

      await processBatch([1, 2, 3], async (item) => item, { onProgress });

      expect(capturedProgress).toHaveProperty('currentBatch');
      expect(capturedProgress).toHaveProperty('totalBatches');
      expect(capturedProgress).toHaveProperty('processedCount');
      expect(capturedProgress).toHaveProperty('totalCount');
      expect(capturedProgress).toHaveProperty('percentComplete');
      expect(capturedProgress).toHaveProperty('elapsedMs');
      expect(capturedProgress).toHaveProperty('estimatedRemainingMs');
    });

    it('should estimate remaining time', async () => {
      const items = Array.from({ length: 100 }, (_, i) => i);
      let midProgress: BatchProgress | null = null;

      const onProgress = (progress: BatchProgress) => {
        if (progress.currentBatch === 5) {
          midProgress = progress;
        }
      };

      await processBatch(
        items,
        async (item) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return item;
        },
        { batchSize: 10, onProgress }
      );

      expect(midProgress).not.toBeNull();
      expect((midProgress as unknown as BatchProgress).estimatedRemainingMs).toBeGreaterThan(0);
    });
  });
});
