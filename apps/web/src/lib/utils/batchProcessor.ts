/**
 * Batch Processing Utilities
 *
 * Provides utilities for processing large datasets in chunks to avoid
 * memory issues and provide progress feedback.
 *
 * Use cases:
 * - Bank reconciliation matching
 * - Large report generation
 * - Bulk data exports
 * - Mass document updates
 */

import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'batchProcessor' });

/**
 * Configuration for batch processing
 */
export interface BatchConfig {
  /** Number of items to process per batch (default: 100) */
  batchSize?: number;
  /** Delay between batches in ms (default: 0) */
  delayBetweenBatches?: number;
  /** Whether to stop on first error (default: false) */
  stopOnError?: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: BatchProgress) => void;
}

/**
 * Progress information for batch processing
 */
export interface BatchProgress {
  /** Current batch number (1-indexed) */
  currentBatch: number;
  /** Total number of batches */
  totalBatches: number;
  /** Items processed so far */
  processedCount: number;
  /** Total items to process */
  totalCount: number;
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Time elapsed in ms */
  elapsedMs: number;
  /** Estimated time remaining in ms */
  estimatedRemainingMs: number;
}

/**
 * Result of batch processing
 */
export interface BatchResult<T> {
  /** Successful results */
  results: T[];
  /** Errors that occurred */
  errors: Array<{ index: number; error: Error }>;
  /** Total items processed */
  processedCount: number;
  /** Number of successful items */
  successCount: number;
  /** Number of failed items */
  errorCount: number;
  /** Total processing time in ms */
  totalTimeMs: number;
}

/**
 * Process items in batches with progress tracking
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param config - Batch processing configuration
 * @returns Batch processing result
 *
 * @example
 * ```typescript
 * const result = await processBatch(
 *   transactions,
 *   async (txn) => {
 *     // Process each transaction
 *     return await matchTransaction(txn);
 *   },
 *   {
 *     batchSize: 50,
 *     onProgress: (progress) => console.log(`${progress.percentComplete}% complete`)
 *   }
 * );
 * ```
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  config: BatchConfig = {}
): Promise<BatchResult<R>> {
  const { batchSize = 100, delayBetweenBatches = 0, stopOnError = false, onProgress } = config;

  const startTime = Date.now();
  const results: R[] = [];
  const errors: Array<{ index: number; error: Error }> = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  logger.info('Starting batch processing', { totalItems: items.length, batchSize, totalBatches });

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, items.length);
    const batchItems = items.slice(batchStart, batchEnd);

    // Process batch items
    for (let i = 0; i < batchItems.length; i++) {
      const globalIndex = batchStart + i;
      const item = batchItems[i]!;

      try {
        const result = await processor(item, globalIndex);
        results.push(result);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ index: globalIndex, error: err });

        logger.warn('Batch item processing failed', { index: globalIndex, error: err.message });

        if (stopOnError) {
          logger.error('Stopping batch due to error', { stoppedAt: globalIndex });
          break;
        }
      }
    }

    // Report progress
    if (onProgress) {
      const elapsedMs = Date.now() - startTime;
      const processedCount = batchEnd;
      const percentComplete = (processedCount / items.length) * 100;
      const avgTimePerItem = elapsedMs / processedCount;
      const estimatedRemainingMs = avgTimePerItem * (items.length - processedCount);

      onProgress({
        currentBatch: batchIndex + 1,
        totalBatches,
        processedCount,
        totalCount: items.length,
        percentComplete,
        elapsedMs,
        estimatedRemainingMs,
      });
    }

    // Add delay between batches if configured
    if (delayBetweenBatches > 0 && batchIndex < totalBatches - 1) {
      await sleep(delayBetweenBatches);
    }

    // Stop if error occurred and stopOnError is true
    if (stopOnError && errors.length > 0) {
      break;
    }
  }

  const totalTimeMs = Date.now() - startTime;

  logger.info('Batch processing complete', {
    totalItems: items.length,
    successCount: results.length,
    errorCount: errors.length,
    totalTimeMs,
  });

  return {
    results,
    errors,
    processedCount: results.length + errors.length,
    successCount: results.length,
    errorCount: errors.length,
    totalTimeMs,
  };
}

/**
 * Process items in parallel batches
 *
 * Each batch is processed in parallel (all items in the batch run concurrently),
 * but batches are processed sequentially.
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param config - Batch processing configuration
 */
export async function processParallelBatch<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  config: BatchConfig = {}
): Promise<BatchResult<R>> {
  const { batchSize = 100, delayBetweenBatches = 0, onProgress } = config;

  const startTime = Date.now();
  const results: R[] = [];
  const errors: Array<{ index: number; error: Error }> = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  logger.info('Starting parallel batch processing', {
    totalItems: items.length,
    batchSize,
    totalBatches,
  });

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, items.length);
    const batchItems = items.slice(batchStart, batchEnd);

    // Process all items in the batch concurrently
    const batchPromises = batchItems.map(async (item, localIndex) => {
      const globalIndex = batchStart + localIndex;
      try {
        return {
          success: true as const,
          result: await processor(item, globalIndex),
          index: globalIndex,
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { success: false as const, error: err, index: globalIndex };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Collect results and errors
    for (const result of batchResults) {
      if (result.success) {
        results.push(result.result);
      } else {
        errors.push({ index: result.index, error: result.error });
      }
    }

    // Report progress
    if (onProgress) {
      const elapsedMs = Date.now() - startTime;
      const processedCount = batchEnd;
      const percentComplete = (processedCount / items.length) * 100;
      const avgTimePerItem = elapsedMs / processedCount;
      const estimatedRemainingMs = avgTimePerItem * (items.length - processedCount);

      onProgress({
        currentBatch: batchIndex + 1,
        totalBatches,
        processedCount,
        totalCount: items.length,
        percentComplete,
        elapsedMs,
        estimatedRemainingMs,
      });
    }

    // Add delay between batches if configured
    if (delayBetweenBatches > 0 && batchIndex < totalBatches - 1) {
      await sleep(delayBetweenBatches);
    }
  }

  const totalTimeMs = Date.now() - startTime;

  logger.info('Parallel batch processing complete', {
    totalItems: items.length,
    successCount: results.length,
    errorCount: errors.length,
    totalTimeMs,
  });

  return {
    results,
    errors,
    processedCount: results.length + errors.length,
    successCount: results.length,
    errorCount: errors.length,
    totalTimeMs,
  };
}

/**
 * Chunk an array into smaller arrays of a specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
