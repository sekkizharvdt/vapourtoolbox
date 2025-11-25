/**
 * Supply Item Service
 *
 * Handles supply item operations for documents:
 * - Creating supply items
 * - Updating supply item status
 * - Deleting supply items
 * - Procurement integration (when implemented)
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { SupplyItem, SupplyItemType, SupplyProcurementStatus } from '@vapour/types';

/**
 * Create a new supply item
 */
export interface CreateSupplyItemRequest {
  projectId: string;
  masterDocumentId: string;
  documentNumber: string;
  itemName: string;
  description: string;
  itemType: SupplyItemType;
  specification: string;
  drawingReference?: string;
  materialGrade?: string;
  quantity: number;
  unit: string;
  estimatedUnitCost?: number;
  currency?: string;
  requiredByDate?: Date;
  deliveryLocation?: string;
  preferredVendorId?: string;
  preferredVendorName?: string;
  tags?: string[];
  notes?: string;
  createdBy: string;
  createdByName: string;
}

export async function createSupplyItem(
  db: Firestore,
  request: CreateSupplyItemRequest
): Promise<string> {
  // Calculate estimated total cost
  const estimatedTotalCost = request.estimatedUnitCost
    ? request.estimatedUnitCost * request.quantity
    : undefined;

  const supplyItem: Omit<SupplyItem, 'id'> = {
    projectId: request.projectId,
    masterDocumentId: request.masterDocumentId,
    documentNumber: request.documentNumber,

    // Item Details
    itemName: request.itemName,
    description: request.description,
    itemType: request.itemType,

    // Specifications
    specification: request.specification,
    drawingReference: request.drawingReference,
    materialGrade: request.materialGrade,

    // Quantity
    quantity: request.quantity,
    unit: request.unit,

    // Estimated Cost
    estimatedUnitCost: request.estimatedUnitCost,
    estimatedTotalCost,
    currency: request.currency || 'INR',

    // Delivery Requirements
    requiredByDate: request.requiredByDate ? Timestamp.fromDate(request.requiredByDate) : undefined,
    deliveryLocation: request.deliveryLocation,

    // Procurement Linkage
    procurementStatus: 'NOT_INITIATED',

    // Vendor Preference
    preferredVendorId: request.preferredVendorId,
    preferredVendorName: request.preferredVendorName,

    // Tags
    tags: request.tags || [],

    // Notes
    notes: request.notes,

    // Audit
    createdBy: request.createdBy,
    createdByName: request.createdByName,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),

    isDeleted: false,
  };

  const supplyItemsRef = collection(db, 'projects', request.projectId, 'supplyItems');
  const docRef = await addDoc(supplyItemsRef, supplyItem);

  console.log('[SupplyItemService] Created supply item:', docRef.id);
  return docRef.id;
}

/**
 * Update supply item procurement status
 */
export interface UpdateSupplyStatusRequest {
  projectId: string;
  supplyItemId: string;
  procurementStatus: SupplyProcurementStatus;
  linkedPurchaseRequestId?: string;
  linkedPurchaseRequestNumber?: string;
  linkedRFQId?: string;
  linkedPOId?: string;
}

export async function updateSupplyItemStatus(
  db: Firestore,
  request: UpdateSupplyStatusRequest
): Promise<void> {
  const supplyItemRef = doc(db, 'projects', request.projectId, 'supplyItems', request.supplyItemId);

  const updates: Record<string, unknown> = {
    procurementStatus: request.procurementStatus,
    updatedAt: Timestamp.now(),
  };

  if (request.linkedPurchaseRequestId) {
    updates.linkedPurchaseRequestId = request.linkedPurchaseRequestId;
    updates.linkedPurchaseRequestNumber = request.linkedPurchaseRequestNumber;
  }

  if (request.linkedRFQId) {
    updates.linkedRFQId = request.linkedRFQId;
  }

  if (request.linkedPOId) {
    updates.linkedPOId = request.linkedPOId;
  }

  await updateDoc(supplyItemRef, updates);
  console.log(
    '[SupplyItemService] Updated supply item status:',
    request.supplyItemId,
    request.procurementStatus
  );
}

/**
 * Delete a supply item
 */
export async function deleteSupplyItem(
  db: Firestore,
  projectId: string,
  supplyItemId: string
): Promise<void> {
  const supplyItemRef = doc(db, 'projects', projectId, 'supplyItems', supplyItemId);
  await deleteDoc(supplyItemRef);
  console.log('[SupplyItemService] Deleted supply item:', supplyItemId);
}

/**
 * Get supply items for a document
 */
export async function getDocumentSupplyItems(
  db: Firestore,
  projectId: string,
  masterDocumentId: string
): Promise<SupplyItem[]> {
  const supplyItemsRef = collection(db, 'projects', projectId, 'supplyItems');
  const q = query(
    supplyItemsRef,
    where('masterDocumentId', '==', masterDocumentId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const items: SupplyItem[] = [];

  snapshot.forEach((doc) => {
    items.push({ id: doc.id, ...doc.data() } as SupplyItem);
  });

  return items;
}

/**
 * Get supply items by procurement status
 */
export async function getSupplyItemsByStatus(
  db: Firestore,
  projectId: string,
  status: SupplyProcurementStatus
): Promise<SupplyItem[]> {
  const supplyItemsRef = collection(db, 'projects', projectId, 'supplyItems');
  const q = query(
    supplyItemsRef,
    where('procurementStatus', '==', status),
    orderBy('requiredByDate', 'asc')
  );

  const snapshot = await getDocs(q);
  const items: SupplyItem[] = [];

  snapshot.forEach((doc) => {
    items.push({ id: doc.id, ...doc.data() } as SupplyItem);
  });

  return items;
}
