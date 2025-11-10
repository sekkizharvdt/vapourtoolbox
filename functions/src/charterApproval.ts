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
  requiredByDate?: any;
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
 * Generate PR number (PR/YYYY/MM/XXXX)
 */
async function generatePRNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // TODO: Implement proper counter logic
  // For now, use timestamp-based number
  const sequence = String(Date.now()).slice(-4);

  return `PR/${year}/${month}/${sequence}`;
}

/**
 * Create PR from charter procurement item
 */
async function createPRFromItem(
  projectId: string,
  projectName: string,
  item: ProcurementItem,
  userId: string,
  userName: string
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
      requiredBy: item.requiredByDate ? Timestamp.fromDate(new Date(item.requiredByDate)) : null,

      // Line items
      itemCount: 1,

      // Workflow
      status: 'DRAFT',

      // Submitter
      submittedBy: userId,
      submittedByName: userName,

      // Charter link
      charterItemId: item.id,

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
      requiredBy: item.requiredByDate ? Timestamp.fromDate(new Date(item.requiredByDate)) : null,
      deliveryLocation: null,

      // Documents
      attachmentCount: 0,

      // Status
      status: 'PENDING',

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
    const procurementItems = (after.procurementItems || []) as ProcurementItem[];
    const approvedBy = after.charter?.authorization?.approvedBy || 'system';
    const approvedByName = 'System'; // TODO: Look up user name from approvedBy UID

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
        approvedByName
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
