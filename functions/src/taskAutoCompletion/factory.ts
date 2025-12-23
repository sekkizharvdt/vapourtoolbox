/**
 * Task Auto-Completion Factory
 *
 * Creates Cloud Functions for auto-completing task notifications
 * when workflow documents transition to terminal states.
 *
 * This factory eliminates code duplication across the various
 * auto-completion functions (PR, PO, Invoice, Document, etc.)
 */

import { onDocumentUpdated, DocumentOptions } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import {
  findTaskNotificationByEntity,
  autoCompleteTask,
  logAutoCompletionEvent,
  TaskNotificationStatus,
} from './helpers';

/**
 * Configuration for a status transition that triggers auto-completion
 */
export interface StatusTransitionConfig {
  /** Source status(es) that must be present before the transition */
  fromStatus: string | string[];
  /** Target status(es) that trigger auto-completion */
  toStatus: string | string[];
  /** Task category to search for (e.g., 'PR_SUBMITTED') */
  taskCategory: string;
  /** Human-readable action description (e.g., 'approved', 'rejected') */
  actionDescription?: string;
}

/**
 * Configuration for creating an auto-completion Cloud Function
 */
export interface AutoCompleteConfig {
  /** Firestore collection path pattern (e.g., 'purchaseRequests/{id}') */
  documentPath: string;
  /** Entity type for task notification lookup (e.g., 'PURCHASE_REQUEST') */
  entityType: string;
  /** Field name for the document number (e.g., 'number', 'invoiceNumber') */
  numberField: string;
  /** Field name for the status field (defaults to 'status') */
  statusField?: string;
  /** Status transitions that trigger auto-completion */
  transitions: StatusTransitionConfig[];
  /** Cloud Function region (defaults to 'us-central1') */
  region?: string;
  /** Function name prefix for logging */
  logPrefix: string;
}

/**
 * Normalize status values to arrays for consistent comparison
 */
function normalizeStatusArray(status: string | string[]): string[] {
  return Array.isArray(status) ? status : [status];
}

/**
 * Create a Cloud Function that auto-completes task notifications
 * when a document's status transitions to a terminal state.
 *
 * @example
 * ```typescript
 * export const onRFQStatusChange = createAutoCompleteFunction({
 *   documentPath: 'rfqs/{rfqId}',
 *   entityType: 'RFQ',
 *   numberField: 'number',
 *   logPrefix: 'onRFQStatusChange',
 *   transitions: [
 *     {
 *       fromStatus: 'PENDING_QUOTES',
 *       toStatus: ['QUOTED', 'CANCELLED'],
 *       taskCategory: 'RFQ_PENDING_QUOTES',
 *     },
 *   ],
 * });
 * ```
 */
export function createAutoCompleteFunction(config: AutoCompleteConfig) {
  const {
    documentPath,
    entityType,
    numberField,
    statusField = 'status',
    transitions,
    region = 'us-central1',
    logPrefix,
  } = config;

  // Extract the parameter name from the document path (e.g., '{prId}' -> 'prId')
  const paramMatch = documentPath.match(/\{(\w+)\}/);
  if (!paramMatch) {
    throw new Error(`Invalid document path: ${documentPath}. Must contain a parameter like {id}`);
  }
  const paramName = paramMatch[1];

  const options: DocumentOptions = {
    document: documentPath,
    region,
  };

  return onDocumentUpdated(options, async (event) => {
    const entityId = event.params[paramName];

    // Get before and after data
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn(`[${logPrefix}] Missing before/after data`, { entityId });
      return;
    }

    // Check if status actually changed
    const oldStatus = before[statusField];
    const newStatus = after[statusField];

    if (oldStatus === newStatus) {
      return;
    }

    const documentNumber = after[numberField] || entityId;

    logger.info(`[${logPrefix}] Status changed`, {
      entityId,
      documentNumber,
      oldStatus,
      newStatus,
    });

    // Check each transition configuration
    for (const transition of transitions) {
      const fromStatuses = normalizeStatusArray(transition.fromStatus);
      const toStatuses = normalizeStatusArray(transition.toStatus);

      // Check if this transition matches
      if (fromStatuses.includes(oldStatus) && toStatuses.includes(newStatus)) {
        try {
          // Find the task notification
          const task = await findTaskNotificationByEntity(
            entityType,
            entityId,
            transition.taskCategory,
            ['pending', 'in_progress'] as TaskNotificationStatus[]
          );

          if (task) {
            // Generate completion reason
            const action =
              transition.actionDescription || newStatus.toLowerCase().replace(/_/g, ' ');
            const reason = `${entityType.replace(/_/g, ' ')} ${documentNumber} was ${action}`;

            await autoCompleteTask(task.id, reason);

            // Log for audit trail
            await logAutoCompletionEvent({
              taskId: task.id,
              entityType,
              entityId,
              triggerEvent: `${entityType}_${newStatus}`,
              completedBy: 'system',
            });

            logger.info(`[${logPrefix}] Auto-completed task`, {
              entityId,
              documentNumber,
              taskId: task.id,
              taskCategory: transition.taskCategory,
              newStatus,
            });
          } else {
            logger.info(`[${logPrefix}] No pending task found for transition`, {
              entityId,
              documentNumber,
              taskCategory: transition.taskCategory,
            });
          }
        } catch (error) {
          logger.error(`[${logPrefix}] Error auto-completing task`, {
            entityId,
            taskCategory: transition.taskCategory,
            error,
          });
          // Don't throw - we don't want to fail the main operation
        }
      }
    }
  });
}

/**
 * Create multiple auto-complete functions for different transitions
 * on the same document type.
 *
 * This is useful when a single document has multiple task types
 * that can be auto-completed at different status transitions.
 */
export function createMultiTransitionAutoCompleteFunction(config: AutoCompleteConfig) {
  return createAutoCompleteFunction(config);
}
