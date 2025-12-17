/**
 * Compensating Transaction Pattern
 *
 * Implements saga-style error recovery for multi-step operations where
 * atomic transactions aren't possible (e.g., combining file uploads with
 * database writes).
 *
 * When an operation fails mid-way, compensation actions are executed in
 * reverse order to undo completed steps.
 *
 * @example
 * ```typescript
 * const saga = new CompensatingSaga();
 *
 * // Step 1: Upload file
 * await saga.execute(
 *   () => uploadFile(file),
 *   (result) => deleteFile(result.path) // Compensation
 * );
 *
 * // Step 2: Create database record
 * await saga.execute(
 *   () => createRecord(data),
 *   (result) => deleteRecord(result.id) // Compensation
 * );
 *
 * // If step 2 fails, step 1's uploaded file is automatically deleted
 * ```
 */

import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'compensatingTransaction' });

/**
 * Result of a compensating transaction step
 */
export interface StepResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * A step in the saga with its compensation action
 */
interface SagaStep<T> {
  name: string;
  result: T;
  compensate: (result: T) => Promise<void>;
  compensationDescription: string;
}

/**
 * Options for saga execution
 */
export interface SagaOptions {
  /** Continue compensation even if some compensations fail */
  continueOnCompensationError?: boolean;
  /** Maximum time to wait for compensation actions (ms) */
  compensationTimeout?: number;
}

/**
 * CompensatingSaga manages multi-step operations with rollback capability
 */
export class CompensatingSaga {
  private steps: SagaStep<unknown>[] = [];
  private sagaId: string;
  private options: SagaOptions;

  constructor(options: SagaOptions = {}) {
    this.sagaId = `saga_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.options = {
      continueOnCompensationError: true,
      compensationTimeout: 30000,
      ...options,
    };
  }

  /**
   * Execute a step and register its compensation action
   *
   * @param name - Human-readable name for the step
   * @param action - The action to execute
   * @param compensate - Action to undo the step if a later step fails
   * @param compensationDescription - Description of what the compensation does
   * @returns Result of the action
   */
  async execute<T>(
    name: string,
    action: () => Promise<T>,
    compensate: (result: T) => Promise<void>,
    compensationDescription: string
  ): Promise<T> {
    logger.info(`Saga ${this.sagaId}: Executing step "${name}"`);

    try {
      const result = await action();

      // Register the step for potential rollback
      this.steps.push({
        name,
        result,
        compensate: compensate as (result: unknown) => Promise<void>,
        compensationDescription,
      });

      logger.info(`Saga ${this.sagaId}: Step "${name}" completed successfully`);
      return result;
    } catch (error) {
      logger.error(`Saga ${this.sagaId}: Step "${name}" failed, initiating compensation`, {
        error,
        completedSteps: this.steps.length,
      });

      // Execute compensation for all completed steps in reverse order
      await this.compensate();

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Execute compensation actions for all completed steps
   */
  async compensate(): Promise<{ success: boolean; errors: Error[] }> {
    const errors: Error[] = [];

    // Execute compensations in reverse order (LIFO)
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i]!;

      logger.info(
        `Saga ${this.sagaId}: Compensating step "${step.name}" - ${step.compensationDescription}`
      );

      try {
        // Add timeout to compensation
        await Promise.race([
          step.compensate(step.result),
          new Promise<void>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Compensation timeout for step "${step.name}"`)),
              this.options.compensationTimeout
            )
          ),
        ]);

        logger.info(`Saga ${this.sagaId}: Compensation for "${step.name}" completed`);
      } catch (compensationError) {
        const error =
          compensationError instanceof Error
            ? compensationError
            : new Error(String(compensationError));

        logger.error(`Saga ${this.sagaId}: Compensation failed for step "${step.name}"`, {
          error,
          compensationDescription: step.compensationDescription,
        });

        errors.push(error);

        if (!this.options.continueOnCompensationError) {
          break;
        }
      }
    }

    // Clear steps after compensation
    this.steps = [];

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Get the number of completed steps
   */
  get completedSteps(): number {
    return this.steps.length;
  }

  /**
   * Get step names for debugging
   */
  get stepNames(): string[] {
    return this.steps.map((s) => s.name);
  }
}

/**
 * Helper to wrap file upload with automatic cleanup on failure
 */
export async function withFileCleanup<T>(
  uploadFn: () => Promise<{ path: string; result: T }>,
  deleteFn: (path: string) => Promise<void>,
  operationFn: (uploadResult: T) => Promise<void>
): Promise<T> {
  const { path, result } = await uploadFn();

  try {
    await operationFn(result);
    return result;
  } catch (error) {
    // Clean up the uploaded file
    try {
      await deleteFn(path);
      logger.info('Cleaned up uploaded file after operation failure', { path });
    } catch (cleanupError) {
      logger.error('Failed to clean up uploaded file', { path, cleanupError });
    }
    throw error;
  }
}

/**
 * Batch file cleanup helper
 *
 * Tracks uploaded files and provides cleanup function for use in catch blocks
 */
export class FileUploadTracker {
  private uploadedPaths: string[] = [];
  private deleteFn: (path: string) => Promise<void>;

  constructor(deleteFn: (path: string) => Promise<void>) {
    this.deleteFn = deleteFn;
  }

  /**
   * Track an uploaded file path
   */
  track(path: string): void {
    this.uploadedPaths.push(path);
  }

  /**
   * Get all tracked paths
   */
  get paths(): string[] {
    return [...this.uploadedPaths];
  }

  /**
   * Clean up all tracked files
   */
  async cleanup(): Promise<{ cleaned: number; failed: number; errors: Error[] }> {
    let cleaned = 0;
    let failed = 0;
    const errors: Error[] = [];

    for (const path of this.uploadedPaths) {
      try {
        await this.deleteFn(path);
        cleaned++;
        logger.info('Cleaned up file', { path });
      } catch (error) {
        failed++;
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        logger.error('Failed to clean up file', { path, error });
      }
    }

    // Clear tracked paths after cleanup
    this.uploadedPaths = [];

    return { cleaned, failed, errors };
  }
}

/**
 * Error class for saga failures with compensation details
 */
export class SagaFailedError extends Error {
  constructor(
    message: string,
    public readonly originalError: Error,
    public readonly compensationErrors: Error[],
    public readonly completedSteps: string[]
  ) {
    super(message);
    this.name = 'SagaFailedError';
  }
}
