/**
 * Charter Approval Cloud Functions
 * Automatically creates Purchase Requests when project charter is approved
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

interface ProcurementItem {
  id: string;
  itemName: string;
  description: string;
  category: 'RAW_MATERIAL' | 'COMPONENT' | 'EQUIPMENT' | 'SERVICE' | 'OTHER';
  quantity: number;
  unit: string;
  estimatedUnitPrice?: {
    amount: number;
    currency: string;
  };
  estimatedTotalPrice?: {
    amount: number;
    currency: string;
  };
  requiredByDate?: Timestamp;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PLANNING' | 'PR_DRAFTED' | 'RFQ_ISSUED' | 'PO_PLACED' | 'DELIVERED' | 'CANCELLED';
  linkedPurchaseRequestId?: string;
  linkedRFQId?: string;
  linkedPOId?: string;
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;
  technicalSpecs?: string;
  notes?: string;
}

/**
 * Generate PR number (PR/YYYY/XXXX) using an atomic transaction on the SAME
 * `counters/pr-{year}` document that the client-side generator uses
 * (apps/web/src/lib/procurement/purchaseRequest/utils.ts — known-gaps 2.4),
 * so auto-drafted charter PRs share one sequence with user-created PRs.
 * Keep counter key and format in sync with that file.
 */
async function generatePRNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const counterRef = db.collection('counters').doc(`pr-${year}`);

  return db.runTransaction(async (tx) => {
    const counterDoc = await tx.get(counterRef);

    let sequence: number;
    if (counterDoc.exists) {
      sequence = (counterDoc.data()?.value || 0) + 1;
      tx.update(counterRef, { value: sequence, updatedAt: Timestamp.now() });
    } else {
      // First use this year and the client hasn't created the counter either:
      // seed from the most recently created PR so the sequence continues.
      // (Admin SDK transactions allow queries, unlike the client SDK.)
      const yearStart = Timestamp.fromDate(new Date(year, 0, 1));
      const lastPRSnap = await tx.get(
        db
          .collection('purchaseRequests')
          .where('createdAt', '>=', yearStart)
          .orderBy('createdAt', 'desc')
          .limit(1)
      );
      const lastNumber = lastPRSnap.docs[0]?.data()?.number as string | undefined;
      // Last segment works for both old (PR/YYYY/MM/XXXX) and new (PR/YYYY/XXXX) formats
      const parts = typeof lastNumber === 'string' ? lastNumber.split('/') : [];
      const seed = parseInt(parts[parts.length - 1] || '', 10);
      sequence = (isNaN(seed) ? 0 : seed) + 1;
      tx.set(counterRef, {
        type: 'purchase_request',
        year,
        value: sequence,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    return `PR/${year}/${String(sequence).padStart(4, '0')}`;
  });
}

/**
 * Create PR from charter procurement item
 */
async function createPRFromItem(
  projectId: string,
  projectName: string,
  item: ProcurementItem,
  userId: string,
  userName: string,
  tenantId: string | undefined
): Promise<{ prId: string; prNumber: string } | null> {
  try {
    const batch = db.batch();
    const now = Timestamp.now();

    // Generate PR number
    const prNumber = await generatePRNumber();

    // Create PR document
    const prRef = db.collection('purchaseRequests').doc();
    const prData = {
      number: prNumber,

      // Classification
      type: 'CAPEX',
      category: item.category === 'EQUIPMENT' ? 'EQUIPMENT' : 'MATERIAL',

      // Project linkage
      projectId,
      projectName,

      // Header
      title: `Charter: ${item.itemName}`,
      description: item.description || item.itemName,
      priority: item.priority === 'CRITICAL' || item.priority === 'HIGH' ? item.priority : 'MEDIUM',
      requiredBy: item.requiredByDate || null,

      // Line items
      itemCount: 1,

      // Workflow
      status: 'DRAFT',

      // Submitter
      submittedBy: userId,
      submittedByName: userName,

      // Charter link
      charterItemId: item.id,

      // Tenant
      ...(tenantId && { tenantId }),

      // Timestamps
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    batch.set(prRef, prData);

    // Create PR item
    const prItemRef = db.collection('purchaseRequestItems').doc();
    const prItemData = {
      purchaseRequestId: prRef.id,

      // Item details
      lineNumber: 1,
      description: item.description || item.itemName,
      specification: item.technicalSpecs || '',

      // Quantity
      quantity: item.quantity,
      unit: item.unit,

      // Material linkage
      materialId: null,
      materialCode: null,
      materialName: item.itemName,

      // Equipment linkage
      equipmentId: item.equipmentId || null,
      equipmentCode: item.equipmentCode || null,
      equipmentName: item.equipmentName || null,

      // Estimated cost
      estimatedUnitCost: item.estimatedUnitPrice?.amount || null,
      estimatedTotalCost: item.estimatedTotalPrice?.amount || null,

      // Technical requirements
      technicalSpec: item.technicalSpecs || null,
      drawingNumbers: [],
      makeModel: null,

      // Delivery
      requiredBy: item.requiredByDate || null,
      deliveryLocation: null,

      // Documents
      attachmentCount: 0,

      // Status
      status: 'PENDING',

      // Tenant
      ...(tenantId && { tenantId }),

      // Timestamps
      createdAt: now,
      updatedAt: now,
    };

    batch.set(prItemRef, prItemData);

    // Commit batch
    await batch.commit();

    logger.info(`Created PR ${prNumber} for charter item ${item.id}`);

    return {
      prId: prRef.id,
      prNumber,
    };
  } catch (error) {
    logger.error(`Error creating PR for item ${item.id}:`, error);
    return null;
  }
}

/**
 * Triggered when project is updated
 * Detects charter approval and auto-creates PRs
 */
export const onCharterApproved = onDocumentUpdated(
  { document: 'projects/{projectId}' },
  async (event) => {
    const projectId = event.params.projectId;

    // Get before and after data
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn(`[onCharterApproved] Missing before/after data for project ${projectId}`);
      return;
    }

    // Check if charter was just approved
    const wasApproved =
      after.charter?.authorization?.approvalStatus === 'APPROVED' &&
      before.charter?.authorization?.approvalStatus !== 'APPROVED';

    if (!wasApproved) {
      // Not a charter approval event, skip
      return;
    }

    logger.info(`[onCharterApproved] Charter approved for project ${projectId}`);

    const projectName = after.name || projectId;
    const tenantId = (after.tenantId as string) || 'default-entity';
    const procurementItems = (after.procurementItems || []) as ProcurementItem[];
    const approvedBy = after.charter?.authorization?.approvedBy || 'system';

    // Attribute the auto-drafted PRs to the approving user, not 'System'
    let approvedByName = 'System';
    if (approvedBy !== 'system') {
      try {
        const userSnap = await db.collection('users').doc(approvedBy).get();
        const userData = userSnap.data();
        approvedByName =
          (userData?.displayName as string) || (userData?.email as string) || approvedBy;
      } catch (error) {
        // Degrade gracefully: PR creation must not fail on a name lookup
        logger.warn(`[onCharterApproved] Failed to look up approver name for ${approvedBy}`, error);
      }
    }

    // Filter HIGH and CRITICAL priority items that haven't been drafted yet
    const itemsToDraft = procurementItems.filter(
      (item: ProcurementItem) =>
        (item.priority === 'HIGH' || item.priority === 'CRITICAL') &&
        item.status === 'PLANNING' &&
        !item.linkedPurchaseRequestId
    );

    if (itemsToDraft.length === 0) {
      logger.info(`[onCharterApproved] No HIGH/CRITICAL items to draft for project ${projectId}`);
      return;
    }

    logger.info(`[onCharterApproved] Creating ${itemsToDraft.length} PRs for project ${projectId}`);

    // Create PRs for each item
    const results: Array<{ itemId: string; prId: string; prNumber: string }> = [];

    for (const item of itemsToDraft) {
      const result = await createPRFromItem(
        projectId,
        projectName,
        item,
        approvedBy,
        approvedByName,
        tenantId
      );

      if (result) {
        results.push({
          itemId: item.id,
          prId: result.prId,
          prNumber: result.prNumber,
        });
      }
    }

    // Update project with linked PR IDs
    if (results.length > 0) {
      const updatedItems = procurementItems.map((item: ProcurementItem) => {
        const match = results.find((r) => r.itemId === item.id);
        if (match) {
          return {
            ...item,
            linkedPurchaseRequestId: match.prId,
            status: 'PR_DRAFTED',
          };
        }
        return item;
      });

      await db.collection('projects').doc(projectId).update({
        procurementItems: updatedItems,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(
        `[onCharterApproved] Successfully created ${results.length} PRs for project ${projectId}`
      );
    }
  }
);
