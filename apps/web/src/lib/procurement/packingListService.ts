/**
 * Packing List Service
 *
 * Handles packing list and shipment tracking
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  PackingList,
  PackingListItem,
  PackingListStatus,
  PurchaseOrder,
  PurchaseOrderItem,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { generateProcurementNumber, PROCUREMENT_NUMBER_CONFIGS } from './generateProcurementNumber';

const logger = createLogger({ context: 'packingListService' });

// ============================================================================
// CREATE PACKING LIST
// ============================================================================

export interface CreatePackingListInput {
  purchaseOrderId: string;
  projectId: string;
  projectName: string;
  numberOfPackages: number;
  totalWeight?: number;
  totalVolume?: number;
  shippingMethod?: 'AIR' | 'SEA' | 'ROAD' | 'COURIER';
  shippingCompany?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
  deliveryAddress: string;
  contactPerson?: string;
  contactPhone?: string;
  packingInstructions?: string;
  handlingInstructions?: string;
  items: Array<{
    poItemId: string;
    quantity: number;
    packageNumber: string;
    weight?: number;
    dimensions?: string;
  }>;
}

export async function createPackingList(
  input: CreatePackingListInput,
  userId: string,
  userName: string,
  userEmail?: string
): Promise<string> {
  const { db } = getFirebase();

  // Get PO
  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, input.purchaseOrderId));
  if (!poDoc.exists()) {
    throw new Error('Purchase Order not found');
  }

  const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

  // Validate packing quantities don't exceed PO ordered quantities
  // Fetch PO items and existing packing lists for this PO
  const [poItemsSnap, existingPLs] = await Promise.all([
    getDocs(
      query(
        collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
        where('purchaseOrderId', '==', input.purchaseOrderId)
      )
    ),
    listPackingLists({ purchaseOrderId: input.purchaseOrderId }),
  ]);

  const poItemMap = new Map<string, { quantity: number; description: string }>();
  poItemsSnap.docs.forEach((d) => {
    const data = d.data() as PurchaseOrderItem;
    poItemMap.set(d.id, { quantity: data.quantity, description: data.description });
  });

  // Sum already-packed quantities from existing (non-cancelled) packing lists
  const alreadyPacked = new Map<string, number>();
  const existingPLIds = existingPLs
    .filter((pl) => pl.status !== 'DRAFT' || true) // count all existing PLs
    .map((pl) => pl.id);

  if (existingPLIds.length > 0) {
    // Batch fetch PL items in chunks of 30
    const batchSize = 30;
    for (let i = 0; i < existingPLIds.length; i += batchSize) {
      const chunk = existingPLIds.slice(i, i + batchSize);
      const plItemsSnap = await getDocs(
        query(collection(db, COLLECTIONS.PACKING_LIST_ITEMS), where('packingListId', 'in', chunk))
      );
      plItemsSnap.docs.forEach((d) => {
        const data = d.data();
        const poItemId = data.poItemId as string;
        const qty = (data.quantity as number) || 0;
        alreadyPacked.set(poItemId, (alreadyPacked.get(poItemId) || 0) + qty);
      });
    }
  }

  // Validate each new PL item
  for (const item of input.items) {
    const poItem = poItemMap.get(item.poItemId);
    if (!poItem) {
      throw new Error(`PO item ${item.poItemId} not found`);
    }
    const packed = alreadyPacked.get(item.poItemId) || 0;
    const remaining = poItem.quantity - packed;
    if (item.quantity > remaining) {
      throw new Error(
        `Packing quantity (${item.quantity}) exceeds remaining PO quantity (${remaining}) for "${poItem.description}"`
      );
    }
  }

  const plNumber = await generateProcurementNumber(PROCUREMENT_NUMBER_CONFIGS.PACKING_LIST);
  const now = Timestamp.now();

  // Create packing list - build with only defined fields to prevent Firestore errors
  const plData: Record<string, unknown> = {
    // Required fields
    number: plNumber,
    ...(po.tenantId && { tenantId: po.tenantId }),
    purchaseOrderId: input.purchaseOrderId,
    poNumber: po.number,
    vendorId: po.vendorId,
    vendorName: po.vendorName,
    projectId: input.projectId,
    projectName: input.projectName,
    numberOfPackages: input.numberOfPackages,
    deliveryAddress: input.deliveryAddress,
    status: 'DRAFT',
    createdBy: userId,
    createdByName: userName,
    createdAt: now,
    updatedAt: now,
  };

  // Add optional fields only if they have values
  if (input.totalWeight !== undefined) plData.totalWeight = input.totalWeight;
  if (input.totalVolume !== undefined) plData.totalVolume = input.totalVolume;
  if (input.shippingMethod) plData.shippingMethod = input.shippingMethod;
  if (input.shippingCompany) plData.shippingCompany = input.shippingCompany;
  if (input.trackingNumber) plData.trackingNumber = input.trackingNumber;
  if (input.estimatedDeliveryDate) {
    plData.estimatedDeliveryDate = Timestamp.fromDate(input.estimatedDeliveryDate);
  }
  if (input.contactPerson) plData.contactPerson = input.contactPerson;
  if (input.contactPhone) plData.contactPhone = input.contactPhone;
  if (input.packingInstructions) plData.packingInstructions = input.packingInstructions;
  if (input.handlingInstructions) plData.handlingInstructions = input.handlingInstructions;

  const plRef = await addDoc(collection(db, COLLECTIONS.PACKING_LISTS), plData);

  // Create packing list items (reuse PO items fetched during validation)
  const batch = writeBatch(db);

  const poItems = poItemsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as PurchaseOrderItem[];

  input.items.forEach((item, index) => {
    const poItem = poItems.find((pi) => pi.id === item.poItemId);

    // Build packing list item with only defined fields to prevent Firestore errors
    const plItemData: Record<string, unknown> = {
      packingListId: plRef.id,
      ...(po.tenantId && { tenantId: po.tenantId }),
      poItemId: item.poItemId,
      lineNumber: index + 1,
      description: poItem?.description || 'Unknown Item',
      quantity: item.quantity,
      unit: poItem?.unit || '',
      packageNumber: item.packageNumber,
      createdAt: now,
      updatedAt: now,
    };

    // Add optional fields only if they have values
    if (poItem?.equipmentId) plItemData.equipmentId = poItem.equipmentId;
    if (poItem?.equipmentCode) plItemData.equipmentCode = poItem.equipmentCode;
    if (item.weight !== undefined) plItemData.weight = item.weight;
    if (item.dimensions) plItemData.dimensions = item.dimensions;

    const itemRef = doc(collection(db, COLLECTIONS.PACKING_LIST_ITEMS));
    batch.set(itemRef, plItemData);
  });

  await batch.commit();

  logger.info('Packing List created', { plId: plRef.id, plNumber });

  // Log audit event (fire-and-forget)
  const auditContext = createAuditContext(userId, userEmail || '', userName);
  logAuditEvent(
    db,
    auditContext,
    'PACKING_LIST_CREATED',
    'PACKING_LIST',
    plRef.id,
    `Created packing list ${plNumber} for PO ${po.number}`,
    {
      entityName: plNumber,
      parentEntityType: 'PURCHASE_ORDER',
      parentEntityId: input.purchaseOrderId,
      metadata: {
        poNumber: po.number,
        vendorId: po.vendorId,
        vendorName: po.vendorName,
        numberOfPackages: input.numberOfPackages,
        itemCount: input.items.length,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));

  return plRef.id;
}

// ============================================================================
// UPDATE PACKING LIST
// ============================================================================

export async function updatePackingListStatus(
  plId: string,
  status: PackingListStatus,
  userId: string,
  userName?: string,
  userEmail?: string
): Promise<void> {
  const { db } = getFirebase();

  // Get existing PL for audit trail
  const existingPL = await getPLById(plId);
  if (!existingPL) {
    throw new Error('Packing List not found');
  }

  const previousStatus = existingPL.status;

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  if (status === 'SHIPPED') {
    updateData.shippedDate = Timestamp.now();
  } else if (status === 'DELIVERED') {
    updateData.actualDeliveryDate = Timestamp.now();
  }

  await updateDoc(doc(db, COLLECTIONS.PACKING_LISTS, plId), updateData);

  logger.info('Packing List status updated', { plId, status });

  // Determine audit action based on new status
  type PLAuditAction = 'PACKING_LIST_FINALIZED' | 'PACKING_LIST_SHIPPED' | 'PACKING_LIST_DELIVERED';

  const actionMap: Record<string, PLAuditAction> = {
    FINALIZED: 'PACKING_LIST_FINALIZED',
    SHIPPED: 'PACKING_LIST_SHIPPED',
    DELIVERED: 'PACKING_LIST_DELIVERED',
  };

  const auditAction = actionMap[status];
  if (auditAction) {
    const auditContext = createAuditContext(userId, userEmail || '', userName || '');
    logAuditEvent(
      db,
      auditContext,
      auditAction,
      'PACKING_LIST',
      plId,
      `${status.toLowerCase().charAt(0).toUpperCase() + status.toLowerCase().slice(1)} packing list ${existingPL.number}`,
      {
        entityName: existingPL.number,
        parentEntityType: 'PURCHASE_ORDER',
        parentEntityId: existingPL.purchaseOrderId,
        metadata: {
          previousStatus,
          newStatus: status,
          poNumber: existingPL.poNumber,
          vendorName: existingPL.vendorName,
        },
      }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  }
}

export async function getPLById(plId: string): Promise<PackingList | null> {
  const { db } = getFirebase();

  const plDoc = await getDoc(doc(db, COLLECTIONS.PACKING_LISTS, plId));

  if (!plDoc.exists()) {
    return null;
  }

  return { id: plDoc.id, ...plDoc.data() } as PackingList;
}

export async function getPLItems(plId: string): Promise<PackingListItem[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.PACKING_LIST_ITEMS),
    where('packingListId', '==', plId),
    orderBy('lineNumber', 'asc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PackingListItem[];
}

// ============================================================================
// LIST PACKING LISTS
// ============================================================================

export interface ListPackingListsFilters {
  status?: PackingListStatus;
  purchaseOrderId?: string;
  projectId?: string;
  vendorId?: string;
  limit?: number;
}

export async function listPackingLists(
  filters: ListPackingListsFilters = {}
): Promise<PackingList[]> {
  const { db } = getFirebase();

  const constraints: ReturnType<typeof where>[] = [];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters.purchaseOrderId) {
    constraints.push(where('purchaseOrderId', '==', filters.purchaseOrderId));
  }
  if (filters.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }
  if (filters.vendorId) {
    constraints.push(where('vendorId', '==', filters.vendorId));
  }

  const q = query(
    collection(db, COLLECTIONS.PACKING_LISTS),
    ...constraints,
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PackingList[];
}

// ============================================================================
// LIST PACKING LISTS BY PO
// ============================================================================

export async function getPackingListsByPO(purchaseOrderId: string): Promise<PackingList[]> {
  return listPackingLists({ purchaseOrderId });
}

// ============================================================================
// UPDATE (editable fields on a draft packing list)
// ============================================================================

export interface UpdatePackingListInput {
  numberOfPackages?: number;
  totalWeight?: number;
  totalVolume?: number;
  shippingMethod?: 'AIR' | 'SEA' | 'ROAD' | 'COURIER' | null;
  shippingCompany?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date | null;
  deliveryAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  packingInstructions?: string;
  handlingInstructions?: string;
}

/**
 * Update editable fields on a Draft packing list. Finalized / shipped / delivered
 * PLs are locked — status transitions go through {@link updatePackingListStatus}.
 */
export async function updatePackingList(
  plId: string,
  input: UpdatePackingListInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  const existing = await getPLById(plId);
  if (!existing) throw new Error('Packing List not found');
  if (existing.status !== 'DRAFT') {
    throw new Error(`Cannot edit a ${existing.status.toLowerCase()} packing list`);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  if (input.numberOfPackages !== undefined) updateData.numberOfPackages = input.numberOfPackages;
  if (input.totalWeight !== undefined) updateData.totalWeight = input.totalWeight;
  if (input.totalVolume !== undefined) updateData.totalVolume = input.totalVolume;
  if (input.shippingMethod !== undefined) {
    updateData.shippingMethod = input.shippingMethod || null;
  }
  if (input.shippingCompany !== undefined) updateData.shippingCompany = input.shippingCompany;
  if (input.trackingNumber !== undefined) updateData.trackingNumber = input.trackingNumber;
  if (input.estimatedDeliveryDate !== undefined) {
    updateData.estimatedDeliveryDate = input.estimatedDeliveryDate
      ? Timestamp.fromDate(input.estimatedDeliveryDate)
      : null;
  }
  if (input.deliveryAddress !== undefined) updateData.deliveryAddress = input.deliveryAddress;
  if (input.contactPerson !== undefined) updateData.contactPerson = input.contactPerson;
  if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone;
  if (input.packingInstructions !== undefined) {
    updateData.packingInstructions = input.packingInstructions;
  }
  if (input.handlingInstructions !== undefined) {
    updateData.handlingInstructions = input.handlingInstructions;
  }

  await updateDoc(doc(db, COLLECTIONS.PACKING_LISTS, plId), updateData);
  logger.info('Packing List updated', { plId });
}

// ============================================================================
// VENDOR ATTACHMENTS (vendor's own packing list PDF, shipping docs, etc.)
// ============================================================================

/**
 * Upload a vendor-supplied attachment against a Packing List. Writes to
 * `procurement/packing-lists/{plId}/attachments/{timestamp}_{fileName}` and
 * appends the resulting download URL to the PL document's `attachmentUrls`.
 */
export async function uploadPLAttachment(
  plId: string,
  file: File,
  userId: string
): Promise<{ url: string; fileName: string }> {
  const { db, storage } = getFirebase();

  const existing = await getPLById(plId);
  if (!existing) throw new Error('Packing List not found');

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `procurement/packing-lists/${plId}/attachments/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);

  const nextUrls = [...(existing.attachmentUrls || []), url];
  const nextNames = [...(existing.attachmentFileNames || []), file.name];

  await updateDoc(doc(db, COLLECTIONS.PACKING_LISTS, plId), {
    attachmentUrls: nextUrls,
    attachmentFileNames: nextNames,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('PL attachment uploaded', { plId, fileName: file.name });
  return { url, fileName: file.name };
}

/**
 * Remove a vendor attachment from a Packing List by index. Deletes the storage
 * object too; storage errors are logged but non-fatal so the doc stays clean.
 */
export async function removePLAttachment(
  plId: string,
  index: number,
  userId: string
): Promise<void> {
  const { db, storage } = getFirebase();

  const existing = await getPLById(plId);
  if (!existing) throw new Error('Packing List not found');

  const urls = [...(existing.attachmentUrls || [])];
  const names = [...(existing.attachmentFileNames || [])];

  if (index < 0 || index >= urls.length) {
    throw new Error('Attachment index out of range');
  }

  const [removedUrl] = urls.splice(index, 1);
  names.splice(index, 1);

  // Best-effort storage cleanup — Firebase download URLs aren't valid paths, so
  // we parse the /o/<path> segment to rebuild a storage ref.
  if (removedUrl) {
    try {
      const match = removedUrl.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        const storagePath = decodeURIComponent(match[1]);
        await deleteObject(ref(storage, storagePath));
      }
    } catch (err) {
      logger.warn('Failed to delete storage object for removed PL attachment', {
        plId,
        index,
        error: err,
      });
    }
  }

  await updateDoc(doc(db, COLLECTIONS.PACKING_LISTS, plId), {
    attachmentUrls: urls,
    attachmentFileNames: names,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('PL attachment removed', { plId, index });
}
