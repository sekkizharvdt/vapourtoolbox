/**
 * Charter Procurement Service
 * Manages procurement items in project charters and creates Purchase Requests
 */

import { doc, updateDoc, Timestamp, getDoc, writeBatch, collection } from 'firebase/firestore';
import { getFirebase } from '../firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { removeUndefinedValues } from '@/lib/firebase/typeHelpers';
import type { ProcurementItem, Project } from '@vapour/types';

const logger = createLogger({ context: 'charterProcurementService' });

/**
 * Add procurement item to project charter
 */
export async function addProcurementItem(
  projectId: string,
  item: Omit<ProcurementItem, 'id' | 'status'>,
  userId: string
): Promise<string> {
  const { db } = getFirebase();

  try {
    // Get current project
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentItems = project.procurementItems || [];

    // Generate ID for new item
    const itemId = `PROC-${crypto.randomUUID().slice(0, 8)}`;

    // Create new item with defaults - remove undefined values for Firestore
    const newItem = removeUndefinedValues<ProcurementItem>({
      ...item,
      id: itemId,
      status: 'PLANNING',
    });

    // Add to array
    const updatedItems = [...currentItems, newItem];

    // Update project
    await updateDoc(projectRef, {
      procurementItems: updatedItems,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return itemId;
  } catch (error) {
    logger.error('Failed to add procurement item', { error, projectId });
    throw new Error('Failed to add procurement item');
  }
}

/**
 * Update procurement item in project charter
 */
export async function updateProcurementItem(
  projectId: string,
  itemId: string,
  updates: Partial<ProcurementItem>,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    // Get current project
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentItems = project.procurementItems || [];

    // Find and update item - remove undefined values for Firestore
    const updatedItems = currentItems.map((item) =>
      item.id === itemId ? removeUndefinedValues({ ...item, ...updates }) : item
    );

    // Update project
    await updateDoc(projectRef, {
      procurementItems: updatedItems,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    logger.error('Failed to update procurement item', { error, projectId, itemId });
    throw new Error('Failed to update procurement item');
  }
}

/**
 * Delete procurement item from project charter
 */
export async function deleteProcurementItem(
  projectId: string,
  itemId: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    // Get current project
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentItems = project.procurementItems || [];

    // Filter out deleted item
    const updatedItems = currentItems.filter((item) => item.id !== itemId);

    // Update project
    await updateDoc(projectRef, {
      procurementItems: updatedItems,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    logger.error('Failed to delete procurement item', { error, projectId, itemId });
    throw new Error('Failed to delete procurement item');
  }
}

/**
 * Generate PR number (PR/YYYY/MM/XXXX)
 */
async function generatePRNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Using timestamp-based sequence to ensure uniqueness
  const sequence = String(Date.now()).slice(-4);

  return `PR/${year}/${month}/${sequence}`;
}

/**
 * Create Purchase Request from charter procurement item
 */
export async function createPRFromCharterItem(
  projectId: string,
  projectName: string,
  item: ProcurementItem,
  userId: string,
  userName: string
): Promise<{ prId: string; prNumber: string }> {
  const { db } = getFirebase();

  try {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Generate PR number
    const prNumber = await generatePRNumber();

    // Create PR document
    const prData = {
      number: prNumber,

      // Classification
      type: 'CAPEX' as const,
      category: item.category === 'EQUIPMENT' ? 'EQUIPMENT' : 'MATERIAL',

      // Project linkage
      projectId,
      projectName,

      // Header
      title: `Charter Item: ${item.itemName}`,
      description: item.description || item.itemName,
      priority:
        item.priority === 'CRITICAL' ? 'CRITICAL' : item.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
      requiredBy: item.requiredByDate
        ? (() => {
            const date = item.requiredByDate;
            if (date instanceof Date) {
              return Timestamp.fromDate(date);
            } else if (typeof date === 'object' && 'toDate' in date && date.toDate) {
              return Timestamp.fromDate(date.toDate());
            } else if (typeof date === 'string') {
              return Timestamp.fromDate(new Date(date));
            }
            return undefined;
          })()
        : undefined,

      // Line items
      itemCount: 1,

      // Bulk upload
      isBulkUpload: false,

      // Workflow
      status: 'DRAFT' as const,

      // Submitter
      submittedBy: userId,
      submittedByName: userName,

      // Charter link (custom field)
      charterItemId: item.id,

      // Timestamps
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    const prRef = doc(collection(db, COLLECTIONS.PURCHASE_REQUESTS));
    batch.set(prRef, prData);

    // Create PR item
    const prItemData = {
      purchaseRequestId: prRef.id,

      // Item details
      lineNumber: 1,
      description: item.description || item.itemName,
      specification: item.technicalSpecs || '',

      // Quantity
      quantity: item.quantity,
      unit: item.unit,

      // Material linkage (if applicable)
      materialId: undefined,
      materialCode: undefined,
      materialName: item.itemName,

      // Equipment linkage
      equipmentId: item.equipmentId,
      equipmentCode: item.equipmentCode,
      equipmentName: item.equipmentName,

      // Estimated cost
      estimatedUnitCost: item.estimatedUnitPrice?.amount,
      estimatedTotalCost: item.estimatedTotalPrice?.amount,

      // Technical requirements
      technicalSpec: item.technicalSpecs,
      drawingNumbers: [],
      makeModel: undefined,

      // Delivery
      requiredBy: item.requiredByDate
        ? (() => {
            const date = item.requiredByDate;
            if (date instanceof Date) {
              return Timestamp.fromDate(date);
            } else if (typeof date === 'object' && 'toDate' in date && date.toDate) {
              return Timestamp.fromDate(date.toDate());
            } else if (typeof date === 'string') {
              return Timestamp.fromDate(new Date(date));
            }
            return undefined;
          })()
        : undefined,
      deliveryLocation: undefined,

      // Documents
      attachmentCount: 0,

      // Status
      status: 'PENDING' as const,

      // Timestamps
      createdAt: now,
      updatedAt: now,
    };

    const prItemRef = doc(collection(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS));
    batch.set(prItemRef, prItemData);

    // Update charter item with PR link
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (projectSnap.exists()) {
      const project = projectSnap.data() as Project;
      const currentItems = project.procurementItems || [];

      const updatedItems = currentItems.map((i) =>
        i.id === item.id
          ? {
              ...i,
              linkedPurchaseRequestId: prRef.id,
              status: 'PR_DRAFTED' as const,
            }
          : i
      );

      batch.update(projectRef, {
        procurementItems: updatedItems,
        updatedAt: now,
        updatedBy: userId,
      });
    }

    // Commit batch
    await batch.commit();

    return {
      prId: prRef.id,
      prNumber,
    };
  } catch (error) {
    logger.error('Failed to create PR from charter item', { error, projectId, itemId: item.id });
    throw new Error('Failed to create purchase request');
  }
}

/**
 * Create Purchase Requests from multiple charter items
 * Used for auto-draft on charter approval
 */
export async function createPRsFromCharterItems(
  projectId: string,
  projectName: string,
  items: ProcurementItem[],
  userId: string,
  userName: string
): Promise<{ createdPRs: Array<{ itemId: string; prId: string; prNumber: string }> }> {
  const createdPRs: Array<{ itemId: string; prId: string; prNumber: string }> = [];

  // Create PRs sequentially to avoid race conditions
  for (const item of items) {
    try {
      const result = await createPRFromCharterItem(projectId, projectName, item, userId, userName);
      createdPRs.push({
        itemId: item.id,
        prId: result.prId,
        prNumber: result.prNumber,
      });
    } catch (error) {
      logger.error('Failed to create PR for charter item', { error, projectId, itemId: item.id });
      // Continue with next item even if one fails
    }
  }

  return { createdPRs };
}

/**
 * Update procurement item status when PR/RFQ/PO is updated
 */
export async function syncProcurementItemStatus(
  projectId: string,
  itemId: string,
  status: ProcurementItem['status'],
  linkedId?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentItems = project.procurementItems || [];

    const updatedItems = currentItems.map((item) => {
      if (item.id !== itemId) return item;

      const updated: ProcurementItem = { ...item, status };

      // Update linked IDs based on status
      if (linkedId) {
        if (status === 'RFQ_ISSUED') {
          updated.linkedRFQId = linkedId;
        } else if (status === 'PO_PLACED') {
          updated.linkedPOId = linkedId;
        }
      }

      return updated;
    });

    await updateDoc(projectRef, {
      procurementItems: updatedItems,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error('Failed to sync procurement item status', { error, projectId, itemId, status });
    throw new Error('Failed to sync procurement item status');
  }
}
