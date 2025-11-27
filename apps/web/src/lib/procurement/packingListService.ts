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
  runTransaction,
} from 'firebase/firestore';
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

const logger = createLogger({ context: 'packingListService' });

// ============================================================================
// PL NUMBER GENERATION (ATOMIC)
// ============================================================================

/**
 * Generate PL number using atomic transaction
 * Uses a counter document to prevent race conditions
 * Format: PL/YYYY/MM/XXXX
 */
async function generatePLNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const counterKey = `pl-${year}-${month}`;

  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterKey);

  const plNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let sequence = 1;
    if (counterDoc.exists()) {
      const data = counterDoc.data();
      sequence = (data.value || 0) + 1;
      transaction.update(counterRef, {
        value: sequence,
        updatedAt: Timestamp.now(),
      });
    } else {
      // Initialize counter for this month
      transaction.set(counterRef, {
        type: 'packing_list',
        year,
        month: parseInt(month, 10),
        value: sequence,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    const sequenceStr = String(sequence).padStart(4, '0');
    return `PL/${year}/${month}/${sequenceStr}`;
  });

  return plNumber;
}

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
  userName: string
): Promise<string> {
  const { db } = getFirebase();

  // Get PO
  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, input.purchaseOrderId));
  if (!poDoc.exists()) {
    throw new Error('Purchase Order not found');
  }

  const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

  const plNumber = await generatePLNumber();
  const now = Timestamp.now();

  // Create packing list
  const plData: Omit<PackingList, 'id'> = {
    number: plNumber,
    purchaseOrderId: input.purchaseOrderId,
    poNumber: po.number,
    vendorId: po.vendorId,
    vendorName: po.vendorName,
    projectId: input.projectId,
    projectName: input.projectName,
    numberOfPackages: input.numberOfPackages,
    totalWeight: input.totalWeight,
    totalVolume: input.totalVolume,
    shippingMethod: input.shippingMethod,
    shippingCompany: input.shippingCompany,
    trackingNumber: input.trackingNumber,
    estimatedDeliveryDate: input.estimatedDeliveryDate
      ? Timestamp.fromDate(input.estimatedDeliveryDate)
      : undefined,
    deliveryAddress: input.deliveryAddress,
    contactPerson: input.contactPerson,
    contactPhone: input.contactPhone,
    packingInstructions: input.packingInstructions,
    handlingInstructions: input.handlingInstructions,
    status: 'DRAFT',
    createdBy: userId,
    createdByName: userName,
    createdAt: now,
    updatedAt: now,
  };

  const plRef = await addDoc(collection(db, COLLECTIONS.PACKING_LISTS), plData);

  // Create packing list items
  const batch = writeBatch(db);

  // Get PO items to populate descriptions
  const poItemsQuery = query(
    collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
    where('purchaseOrderId', '==', input.purchaseOrderId)
  );
  const poItemsSnapshot = await getDocs(poItemsQuery);
  const poItems = poItemsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PurchaseOrderItem[];

  input.items.forEach((item, index) => {
    const poItem = poItems.find((pi) => pi.id === item.poItemId);

    const plItemData: Omit<PackingListItem, 'id'> = {
      packingListId: plRef.id,
      poItemId: item.poItemId,
      lineNumber: index + 1,
      description: poItem?.description || 'Unknown Item',
      quantity: item.quantity,
      unit: poItem?.unit || '',
      equipmentId: poItem?.equipmentId,
      equipmentCode: poItem?.equipmentCode,
      packageNumber: item.packageNumber,
      weight: item.weight,
      dimensions: item.dimensions,
      createdAt: now,
      updatedAt: now,
    };

    const itemRef = doc(collection(db, COLLECTIONS.PACKING_LIST_ITEMS));
    batch.set(itemRef, plItemData);
  });

  await batch.commit();

  logger.info('Packing List created', { plId: plRef.id, plNumber });

  return plRef.id;
}

// ============================================================================
// UPDATE PACKING LIST
// ============================================================================

export async function updatePackingListStatus(
  plId: string,
  status: PackingListStatus,
  _userId: string
): Promise<void> {
  const { db } = getFirebase();

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === 'SHIPPED') {
    updateData.shippedDate = Timestamp.now();
  } else if (status === 'DELIVERED') {
    updateData.actualDeliveryDate = Timestamp.now();
  }

  await updateDoc(doc(db, COLLECTIONS.PACKING_LISTS, plId), updateData);

  logger.info('Packing List status updated', { plId, status });
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
