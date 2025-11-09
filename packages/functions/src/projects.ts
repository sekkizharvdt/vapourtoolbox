/**
 * Project-Related Cloud Functions
 *
 * Handles project lifecycle events:
 * - Auto-create cost centres when projects are created
 * - Sync project changes to related cost centres
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Auto-Create Cost Centre when Project is Created
 *
 * Triggered when a new project document is created in Firestore
 * Automatically creates a corresponding cost centre for accounting tracking
 */
export const onProjectCreated = onDocumentCreated(
  {
    document: 'projects/{projectId}',
    region: 'us-central1',
    memory: '256MiB',
  },
  async (event) => {
    const projectId = event.params.projectId;
    const projectData = event.data?.data();

    if (!projectData) {
      logger.warn('Project data not found', { projectId });
      return;
    }

    logger.info('Project created, auto-creating cost centre', {
      projectId,
      projectCode: projectData.code,
      projectName: projectData.name,
    });

    try {
      const db = admin.firestore();

      // Generate cost centre code from project code
      const costCentreCode = `CC-${projectData.code}`;

      // Check if cost centre already exists (shouldn't happen, but safety check)
      const existingQuery = await db
        .collection('costCentres')
        .where('projectId', '==', projectId)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        logger.warn('Cost centre already exists for this project', { projectId, costCentreCode });
        return;
      }

      // Create cost centre document
      const costCentreRef = db.collection('costCentres').doc();
      const now = admin.firestore.Timestamp.now();

      await costCentreRef.set({
        code: costCentreCode,
        name: projectData.name,
        description: `Cost centre auto-created for project: ${projectData.name}`,
        projectId,

        // Budget tracking fields (from project budget if available)
        budgetAmount: projectData.budget?.estimated?.amount || null,
        budgetCurrency: projectData.budget?.currency || 'INR',
        actualSpent: 0,
        variance: null,

        // Status
        isActive: projectData.status === 'active' || projectData.status === 'in_progress',
        autoCreated: true, // Flag to indicate this was auto-created

        // Timestamps
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        updatedBy: 'system',
      });

      logger.info('Cost centre auto-created successfully', {
        projectId,
        costCentreId: costCentreRef.id,
        costCentreCode,
      });
    } catch (error) {
      logger.error('Error auto-creating cost centre', {
        projectId,
        error,
      });
      // Don't throw - project creation should not fail if cost centre creation fails
      // This is a background operation
    }
  }
);

/**
 * Sync Cost Centre when Project is Updated
 *
 * Triggered when a project document is updated
 * Syncs relevant changes to the corresponding cost centre
 */
export const onProjectUpdated = onDocumentUpdated(
  {
    document: 'projects/{projectId}',
    region: 'us-central1',
    memory: '256MiB',
  },
  async (event) => {
    const projectId = event.params.projectId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      return;
    }

    // Check if relevant fields changed
    const nameChanged = beforeData.name !== afterData.name;
    const statusChanged = beforeData.status !== afterData.status;
    const budgetChanged =
      beforeData.budget?.estimated?.amount !== afterData.budget?.estimated?.amount;

    if (!nameChanged && !statusChanged && !budgetChanged) {
      // No relevant changes
      return;
    }

    logger.info('Project updated, syncing cost centre', {
      projectId,
      nameChanged,
      statusChanged,
      budgetChanged,
    });

    try {
      const db = admin.firestore();

      // Find the cost centre for this project
      const costCentreQuery = await db
        .collection('costCentres')
        .where('projectId', '==', projectId)
        .where('autoCreated', '==', true) // Only sync auto-created cost centres
        .limit(1)
        .get();

      if (costCentreQuery.empty) {
        logger.info('No auto-created cost centre found for this project', { projectId });
        return;
      }

      const costCentreDoc = costCentreQuery.docs[0];
      const updateData: Record<string, unknown> = {
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: 'system',
      };

      // Sync name if changed
      if (nameChanged) {
        updateData.name = afterData.name;
        updateData.description = `Cost centre auto-created for project: ${afterData.name}`;
      }

      // Sync status if changed
      if (statusChanged) {
        updateData.isActive = afterData.status === 'active' || afterData.status === 'in_progress';
      }

      // Sync budget if changed
      if (budgetChanged) {
        updateData.budgetAmount = afterData.budget?.estimated?.amount || null;
        updateData.budgetCurrency = afterData.budget?.currency || 'INR';
      }

      await costCentreDoc.ref.update(updateData);

      logger.info('Cost centre synced successfully', {
        projectId,
        costCentreId: costCentreDoc.id,
        updatedFields: Object.keys(updateData),
      });
    } catch (error) {
      logger.error('Error syncing cost centre', {
        projectId,
        error,
      });
      // Don't throw - project update should not fail if cost centre sync fails
    }
  }
);
