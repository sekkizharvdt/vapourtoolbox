/**
 * Document Auto-Completion Cloud Functions
 *
 * Automatically completes document-related tasks when:
 * - Documents are submitted for review
 * - Documents are approved
 * - Documents are accepted by client
 */

import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import {
  findTaskNotificationByEntity,
  findAllTaskNotificationsByEntity,
  autoCompleteTask,
  autoCompleteTasksBatch,
  logAutoCompletionEvent,
} from './helpers';

/**
 * Triggered when a Document is updated
 * Auto-completes various document tasks based on workflow state changes
 */
export const onDocumentStatusChange = onDocumentUpdated(
  {
    document: 'documents/{documentId}',
    region: 'us-central1',
  },
  async (event) => {
    const documentId = event.params.documentId;

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onDocumentStatusChange] Missing before/after data', { documentId });
      return;
    }

    const documentNumber = after.documentNumber || after.name || documentId;

    // Check for status changes
    const oldStatus = before.status;
    const newStatus = after.status;

    // Check for PM approval
    const wasPMApproved = !before.pmApprovedAt && after.pmApprovedAt;

    // Check for client approval
    const wasClientApproved = !before.clientApprovedAt && after.clientApprovedAt;

    // Check for client acceptance
    const wasClientAccepted = !before.clientAcceptedAt && after.clientAcceptedAt;

    // Auto-complete DOCUMENT_ASSIGNED when document is submitted for review
    if (oldStatus !== 'SUBMITTED' && newStatus === 'SUBMITTED') {
      try {
        const assignedTask = await findTaskNotificationByEntity(
          'DOCUMENT',
          documentId,
          'DOCUMENT_ASSIGNED',
          ['pending', 'in_progress']
        );

        if (assignedTask) {
          const reason = `Document ${documentNumber} was submitted for review`;

          await autoCompleteTask(assignedTask.id, reason);

          await logAutoCompletionEvent({
            taskId: assignedTask.id,
            entityType: 'DOCUMENT',
            entityId: documentId,
            triggerEvent: 'DOCUMENT_SUBMITTED',
            completedBy: 'system',
          });

          logger.info('[onDocumentStatusChange] Auto-completed document assignment task', {
            documentId,
            documentNumber,
            taskId: assignedTask.id,
          });
        }
      } catch (error) {
        logger.error('[onDocumentStatusChange] Error auto-completing assignment task', {
          documentId,
          error,
        });
      }
    }

    // Auto-complete DOCUMENT_INTERNAL_REVIEW when PM approves
    if (wasPMApproved) {
      try {
        const reviewTask = await findTaskNotificationByEntity(
          'DOCUMENT',
          documentId,
          'DOCUMENT_INTERNAL_REVIEW',
          ['pending', 'in_progress']
        );

        if (reviewTask) {
          const reason = `Document ${documentNumber} was approved by PM for client submission`;

          await autoCompleteTask(reviewTask.id, reason);

          await logAutoCompletionEvent({
            taskId: reviewTask.id,
            entityType: 'DOCUMENT',
            entityId: documentId,
            triggerEvent: 'DOCUMENT_PM_APPROVED',
            completedBy: 'system',
          });

          logger.info('[onDocumentStatusChange] Auto-completed PM review task', {
            documentId,
            documentNumber,
            taskId: reviewTask.id,
          });
        }
      } catch (error) {
        logger.error('[onDocumentStatusChange] Error auto-completing PM review task', {
          documentId,
          error,
        });
      }
    }

    // Auto-complete DOCUMENT_CLIENT_COMMENTED when comments are resolved
    if (oldStatus === 'COMMENTS_PENDING' && newStatus === 'COMMENTS_RESOLVED') {
      try {
        const commentTask = await findTaskNotificationByEntity(
          'DOCUMENT',
          documentId,
          'DOCUMENT_CLIENT_COMMENTED',
          ['pending', 'in_progress']
        );

        if (commentTask) {
          const reason = `Client comments on ${documentNumber} were resolved`;

          await autoCompleteTask(commentTask.id, reason);

          await logAutoCompletionEvent({
            taskId: commentTask.id,
            entityType: 'DOCUMENT',
            entityId: documentId,
            triggerEvent: 'COMMENTS_RESOLVED',
            completedBy: 'system',
          });

          logger.info('[onDocumentStatusChange] Auto-completed comment resolution task', {
            documentId,
            documentNumber,
            taskId: commentTask.id,
          });
        }
      } catch (error) {
        logger.error('[onDocumentStatusChange] Error auto-completing comment task', {
          documentId,
          error,
        });
      }
    }

    // Auto-complete all pending document tasks when client approves
    if (wasClientApproved) {
      try {
        const pendingTasks = await findAllTaskNotificationsByEntity(
          'DOCUMENT',
          documentId,
          undefined, // All categories
          ['pending', 'in_progress']
        );

        if (pendingTasks.length > 0) {
          const taskIds = pendingTasks.map((t) => t.id);
          const reason = `Document ${documentNumber} was approved by client`;

          const result = await autoCompleteTasksBatch(taskIds, reason);

          // Log each completion
          for (const task of pendingTasks) {
            await logAutoCompletionEvent({
              taskId: task.id,
              entityType: 'DOCUMENT',
              entityId: documentId,
              triggerEvent: 'DOCUMENT_CLIENT_APPROVED',
              completedBy: 'system',
            });
          }

          logger.info('[onDocumentStatusChange] Auto-completed tasks on client approval', {
            documentId,
            documentNumber,
            result,
          });
        }
      } catch (error) {
        logger.error('[onDocumentStatusChange] Error auto-completing on client approval', {
          documentId,
          error,
        });
      }
    }

    // Auto-complete remaining tasks when client accepts (final)
    if (wasClientAccepted) {
      try {
        const remainingTasks = await findAllTaskNotificationsByEntity(
          'DOCUMENT',
          documentId,
          undefined,
          ['pending', 'in_progress']
        );

        if (remainingTasks.length > 0) {
          const taskIds = remainingTasks.map((t) => t.id);
          const reason = `Document ${documentNumber} was accepted by client (final)`;

          const result = await autoCompleteTasksBatch(taskIds, reason);

          logger.info('[onDocumentStatusChange] Auto-completed tasks on client acceptance', {
            documentId,
            documentNumber,
            result,
          });
        }
      } catch (error) {
        logger.error('[onDocumentStatusChange] Error auto-completing on client acceptance', {
          documentId,
          error,
        });
      }
    }
  }
);

/**
 * Triggered when a Document Submission is created
 * Auto-completes DOCUMENT_SUBMISSION_REQUIRED tasks
 */
export const onDocumentSubmissionCreated = onDocumentCreated(
  {
    document: 'documentSubmissions/{submissionId}',
    region: 'us-central1',
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    const data = event.data?.data();

    if (!data) {
      logger.warn('[onDocumentSubmissionCreated] Missing data', { submissionId });
      return;
    }

    const documentId = data.documentId;
    if (!documentId) {
      logger.warn('[onDocumentSubmissionCreated] Missing documentId', { submissionId });
      return;
    }

    try {
      const submissionTask = await findTaskNotificationByEntity(
        'DOCUMENT',
        documentId,
        'DOCUMENT_SUBMISSION_REQUIRED',
        ['pending', 'in_progress']
      );

      if (submissionTask) {
        const reason = `Document submission ${data.submissionNumber || submissionId} was created`;

        await autoCompleteTask(submissionTask.id, reason);

        await logAutoCompletionEvent({
          taskId: submissionTask.id,
          entityType: 'DOCUMENT',
          entityId: documentId,
          triggerEvent: 'SUBMISSION_CREATED',
          completedBy: 'system',
        });

        logger.info('[onDocumentSubmissionCreated] Auto-completed submission required task', {
          submissionId,
          documentId,
          taskId: submissionTask.id,
        });
      }
    } catch (error) {
      logger.error('[onDocumentSubmissionCreated] Error auto-completing task', {
        submissionId,
        documentId,
        error,
      });
    }
  }
);
