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
  limit,
  Timestamp,
  writeBatch,
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

// ============================================================================
// PL NUMBER GENERATION
// ============================================================================

async function generatePLNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

  const q = query(
    collection(db, COLLECTIONS.PACKING_LISTS),
    where('createdAt', '>=', Timestamp.fromDate(monthStart)),
    where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let sequence = 1;
  if (!snapshot.empty && snapshot.docs[0]) {
    const lastPL = snapshot.docs[0].data() as PackingList;
    const lastNumber = lastPL.number;
    const parts = lastNumber.split('/');
    const lastSequenceStr = parts[parts.length - 1];
    const lastSequence = parseInt(lastSequenceStr || '0', 10);
    sequence = lastSequence + 1;
  }

  const sequenceStr = String(sequence).padStart(4, '0');
  return `PL/${year}/${month}/${sequenceStr}`;
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

  console.warn('[packingListService] Packing List created:', plRef.id, plNumber);

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

  console.warn('[packingListService] Packing List status updated:', plId, status);
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
