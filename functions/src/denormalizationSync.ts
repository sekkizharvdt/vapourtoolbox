/**
 * Denormalization Sync Functions
 *
 * Cloud Functions that propagate name/email changes from source entities
 * to all documents that denormalize that data.
 *
 * Strategy:
 * - Option A (Critical fields): Real-time sync on source change
 * - Option B (Display fields): Background sync with batch updates
 * - Option C (Historical): Accept staleness (audit trail keeps original names)
 *
 * Collections that store denormalized data:
 * - User names: purchaseRequests, documents, bills, proposals, etc.
 * - Vendor names: purchaseOrders, goodsReceipts, packingLists, offers
 * - Project names: various procurement and document records
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot, WriteBatch } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Maximum documents to update in a single batch
 * Firestore limit is 500 operations per batch
 */
const BATCH_SIZE = 400;

/**
 * Helper to execute batch updates with automatic chunking
 */
async function batchUpdate(
  updates: Array<{
    collection: string;
    docId: string;
    field: string;
    value: string;
  }>
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  // Process in chunks of BATCH_SIZE
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const batch: WriteBatch = db.batch();

    for (const update of chunk) {
      try {
        const ref = db.collection(update.collection).doc(update.docId);
        batch.update(ref, {
          [update.field]: update.value,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error(`Failed to add update to batch: ${update.collection}/${update.docId}`, error);
        failed++;
      }
    }

    try {
      await batch.commit();
      updated += chunk.length;
    } catch (error) {
      console.error(`Batch commit failed for chunk starting at ${i}`, error);
      failed += chunk.length;
    }
  }

  return { updated, failed };
}

/**
 * Sync user name/email changes to all denormalized locations
 *
 * Triggered when a user document is updated.
 * Updates fields like submittedByName, createdByName, assignedToName, etc.
 */
export const onUserNameChange = onDocumentUpdated(
  'users/{userId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return;

    const userId = event.params.userId;
    const oldName = before.displayName as string;
    const newName = after.displayName as string;
    const oldEmail = before.email as string;
    const newEmail = after.email as string;

    // Check if name or email actually changed
    const nameChanged = oldName !== newName && newName;
    const emailChanged = oldEmail !== newEmail && newEmail;

    if (!nameChanged && !emailChanged) {
      return; // No relevant changes
    }

    console.log(`User name/email changed for ${userId}:`, {
      nameChange: nameChanged ? `"${oldName}" -> "${newName}"` : 'unchanged',
      emailChange: emailChanged ? `"${oldEmail}" -> "${newEmail}"` : 'unchanged',
    });

    const updates: Array<{
      collection: string;
      docId: string;
      field: string;
      value: string;
    }> = [];

    // Collections and fields to update for user name changes
    const userNameMappings = [
      // Procurement
      { collection: 'purchaseRequests', idField: 'submittedBy', nameField: 'submittedByName' },
      { collection: 'purchaseRequests', idField: 'createdBy', nameField: 'createdByName' },
      { collection: 'purchaseOrders', idField: 'createdBy', nameField: 'createdByName' },
      { collection: 'goodsReceipts', idField: 'inspectedBy', nameField: 'inspectedByName' },
      { collection: 'packingLists', idField: 'createdBy', nameField: 'createdByName' },

      // Documents
      { collection: 'documents', idField: 'uploadedBy', nameField: 'uploadedByName' },
      { collection: 'documents', idField: 'assignedTo', nameField: 'assignedToName' },

      // Accounting
      { collection: 'transactions', idField: 'createdBy', nameField: 'createdByName' },
      { collection: 'transactions', idField: 'submittedBy', nameField: 'submittedByUserName' },

      // Proposals
      { collection: 'proposals', idField: 'createdBy', nameField: 'createdByName' },
      { collection: 'enquiries', idField: 'createdBy', nameField: 'createdByName' },

      // HR
      { collection: 'hrLeaveRequests', idField: 'userId', nameField: 'userName' },

      // Transmittals
      { collection: 'transmittals', idField: 'createdBy', nameField: 'createdByName' },

      // Work items (document management)
      { collection: 'workItems', idField: 'assignedTo', nameField: 'assignedToName' },
      { collection: 'workItems', idField: 'createdBy', nameField: 'createdByName' },
    ];

    // Query each collection for documents with this user ID
    for (const mapping of userNameMappings) {
      if (nameChanged) {
        try {
          const querySnapshot = await db
            .collection(mapping.collection)
            .where(mapping.idField, '==', userId)
            .get();

          for (const doc of querySnapshot.docs) {
            const currentName = doc.data()[mapping.nameField];
            // Only update if the stored name matches the old name
            // This prevents overwriting names that were intentionally set differently
            if (currentName === oldName) {
              updates.push({
                collection: mapping.collection,
                docId: doc.id,
                field: mapping.nameField,
                value: newName,
              });
            }
          }
        } catch (error) {
          console.error(`Error querying ${mapping.collection} for user ${userId}:`, error);
        }
      }
    }

    // Handle email updates (less common, but important for contact info)
    if (emailChanged) {
      const emailMappings = [
        { collection: 'purchaseRequests', idField: 'submittedBy', emailField: 'submittedByEmail' },
        { collection: 'transactions', idField: 'createdBy', emailField: 'createdByEmail' },
      ];

      for (const mapping of emailMappings) {
        try {
          const querySnapshot = await db
            .collection(mapping.collection)
            .where(mapping.idField, '==', userId)
            .get();

          for (const doc of querySnapshot.docs) {
            const currentEmail = doc.data()[mapping.emailField];
            if (currentEmail === oldEmail) {
              updates.push({
                collection: mapping.collection,
                docId: doc.id,
                field: mapping.emailField,
                value: newEmail,
              });
            }
          }
        } catch (error) {
          console.error(`Error querying ${mapping.collection} for user email ${userId}:`, error);
        }
      }
    }

    // Execute batch updates
    if (updates.length > 0) {
      const result = await batchUpdate(updates);
      console.log(`User denormalization sync completed for ${userId}:`, {
        totalUpdates: updates.length,
        ...result,
      });
    } else {
      console.log(`No denormalized data to update for user ${userId}`);
    }
  }
);

/**
 * Sync vendor/entity name changes to all denormalized locations
 *
 * Triggered when an entity document is updated.
 * Updates vendorName, entityName fields in POs, GRs, Bills, etc.
 */
export const onEntityNameChange = onDocumentUpdated(
  'entities/{entityId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { entityId: string }>) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return;

    const entityId = event.params.entityId;
    const oldName = before.name as string;
    const newName = after.name as string;
    const oldEmail = before.email as string;
    const newEmail = after.email as string;
    const oldGstin = before.gstin as string;
    const newGstin = after.gstin as string;

    // Check what changed
    const nameChanged = oldName !== newName && newName;
    const emailChanged = oldEmail !== newEmail;
    const gstinChanged = oldGstin !== newGstin;

    if (!nameChanged && !emailChanged && !gstinChanged) {
      return;
    }

    console.log(`Entity updated: ${entityId}`, {
      nameChange: nameChanged ? `"${oldName}" -> "${newName}"` : 'unchanged',
      emailChange: emailChanged ? `"${oldEmail}" -> "${newEmail}"` : 'unchanged',
      gstinChange: gstinChanged ? `"${oldGstin}" -> "${newGstin}"` : 'unchanged',
    });

    const updates: Array<{
      collection: string;
      docId: string;
      field: string;
      value: string;
    }> = [];

    // Entity/vendor name mappings
    const entityMappings = [
      // Procurement - vendorId field
      { collection: 'purchaseOrders', idField: 'vendorId', nameField: 'vendorName' },
      { collection: 'goodsReceipts', idField: 'vendorId', nameField: 'vendorName' },
      { collection: 'packingLists', idField: 'vendorId', nameField: 'vendorName' },
      { collection: 'offers', idField: 'vendorId', nameField: 'vendorName' },
      { collection: 'workCompletionCertificates', idField: 'vendorId', nameField: 'vendorName' },

      // Accounting - entityId field
      { collection: 'transactions', idField: 'entityId', nameField: 'entityName' },
    ];

    // Query and update name fields
    if (nameChanged) {
      for (const mapping of entityMappings) {
        try {
          const querySnapshot = await db
            .collection(mapping.collection)
            .where(mapping.idField, '==', entityId)
            .get();

          for (const doc of querySnapshot.docs) {
            const currentName = doc.data()[mapping.nameField];
            if (currentName === oldName) {
              updates.push({
                collection: mapping.collection,
                docId: doc.id,
                field: mapping.nameField,
                value: newName,
              });
            }
          }
        } catch (error) {
          console.error(`Error querying ${mapping.collection} for entity ${entityId}:`, error);
        }
      }
    }

    // Update email fields
    if (emailChanged && newEmail) {
      const emailMappings = [
        { collection: 'purchaseOrders', idField: 'vendorId', emailField: 'vendorEmail' },
        { collection: 'packingLists', idField: 'vendorId', emailField: 'vendorEmail' },
      ];

      for (const mapping of emailMappings) {
        try {
          const querySnapshot = await db
            .collection(mapping.collection)
            .where(mapping.idField, '==', entityId)
            .get();

          for (const doc of querySnapshot.docs) {
            const currentEmail = doc.data()[mapping.emailField];
            if (currentEmail === oldEmail) {
              updates.push({
                collection: mapping.collection,
                docId: doc.id,
                field: mapping.emailField,
                value: newEmail,
              });
            }
          }
        } catch (error) {
          console.error(
            `Error querying ${mapping.collection} for entity email ${entityId}:`,
            error
          );
        }
      }
    }

    // Update GSTIN fields (important for tax compliance)
    if (gstinChanged && newGstin) {
      const gstinMappings = [
        { collection: 'purchaseOrders', idField: 'vendorId', gstinField: 'vendorGSTIN' },
      ];

      for (const mapping of gstinMappings) {
        try {
          const querySnapshot = await db
            .collection(mapping.collection)
            .where(mapping.idField, '==', entityId)
            .get();

          for (const doc of querySnapshot.docs) {
            const currentGstin = doc.data()[mapping.gstinField];
            if (currentGstin === oldGstin) {
              updates.push({
                collection: mapping.collection,
                docId: doc.id,
                field: mapping.gstinField,
                value: newGstin,
              });
            }
          }
        } catch (error) {
          console.error(
            `Error querying ${mapping.collection} for entity GSTIN ${entityId}:`,
            error
          );
        }
      }
    }

    // Execute batch updates
    if (updates.length > 0) {
      const result = await batchUpdate(updates);
      console.log(`Entity denormalization sync completed for ${entityId}:`, {
        totalUpdates: updates.length,
        ...result,
      });
    } else {
      console.log(`No denormalized data to update for entity ${entityId}`);
    }
  }
);

/**
 * Sync project name changes to all denormalized locations
 *
 * Triggered when a project document is updated.
 * Updates projectName fields in PRs, POs, documents, etc.
 */
export const onProjectNameChange = onDocumentUpdated(
  'projects/{projectId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { projectId: string }>) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return;

    const projectId = event.params.projectId;
    const oldName = before.name as string;
    const newName = after.name as string;
    const oldCode = before.code as string;
    const newCode = after.code as string;

    // Check what changed
    const nameChanged = oldName !== newName && newName;
    const codeChanged = oldCode !== newCode && newCode;

    if (!nameChanged && !codeChanged) {
      return;
    }

    console.log(`Project updated: ${projectId}`, {
      nameChange: nameChanged ? `"${oldName}" -> "${newName}"` : 'unchanged',
      codeChange: codeChanged ? `"${oldCode}" -> "${newCode}"` : 'unchanged',
    });

    const updates: Array<{
      collection: string;
      docId: string;
      field: string;
      value: string;
    }> = [];

    // Project name mappings
    const projectMappings = [
      // Procurement
      { collection: 'purchaseRequests', idField: 'projectId', nameField: 'projectName' },
      { collection: 'purchaseOrders', idField: 'projectId', nameField: 'projectName' },
      { collection: 'rfqs', idField: 'projectId', nameField: 'projectName' },
      { collection: 'goodsReceipts', idField: 'projectId', nameField: 'projectName' },
      { collection: 'packingLists', idField: 'projectId', nameField: 'projectName' },

      // Documents
      { collection: 'documents', idField: 'projectId', nameField: 'projectName' },
      { collection: 'transmittals', idField: 'projectId', nameField: 'projectName' },

      // Proposals
      { collection: 'proposals', idField: 'projectId', nameField: 'projectName' },
      { collection: 'enquiries', idField: 'projectId', nameField: 'projectName' },

      // Estimation
      { collection: 'estimates', idField: 'projectId', nameField: 'projectName' },
    ];

    // Query and update name fields
    if (nameChanged) {
      for (const mapping of projectMappings) {
        try {
          const querySnapshot = await db
            .collection(mapping.collection)
            .where(mapping.idField, '==', projectId)
            .get();

          for (const doc of querySnapshot.docs) {
            const currentName = doc.data()[mapping.nameField];
            if (currentName === oldName) {
              updates.push({
                collection: mapping.collection,
                docId: doc.id,
                field: mapping.nameField,
                value: newName,
              });
            }
          }
        } catch (error) {
          console.error(`Error querying ${mapping.collection} for project ${projectId}:`, error);
        }
      }
    }

    // Project code mappings (less common to change, but important)
    if (codeChanged) {
      const codeMappings = [
        { collection: 'purchaseRequests', idField: 'projectId', codeField: 'projectCode' },
        { collection: 'documents', idField: 'projectId', codeField: 'projectCode' },
      ];

      for (const mapping of codeMappings) {
        try {
          const querySnapshot = await db
            .collection(mapping.collection)
            .where(mapping.idField, '==', projectId)
            .get();

          for (const doc of querySnapshot.docs) {
            const currentCode = doc.data()[mapping.codeField];
            if (currentCode === oldCode) {
              updates.push({
                collection: mapping.collection,
                docId: doc.id,
                field: mapping.codeField,
                value: newCode,
              });
            }
          }
        } catch (error) {
          console.error(
            `Error querying ${mapping.collection} for project code ${projectId}:`,
            error
          );
        }
      }
    }

    // Execute batch updates
    if (updates.length > 0) {
      const result = await batchUpdate(updates);
      console.log(`Project denormalization sync completed for ${projectId}:`, {
        totalUpdates: updates.length,
        ...result,
      });
    } else {
      console.log(`No denormalized data to update for project ${projectId}`);
    }
  }
);
