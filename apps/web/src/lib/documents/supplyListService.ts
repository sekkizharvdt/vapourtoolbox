/**
 * Supply List Service
 *
 * Manages supply items linked to master documents
 * Facilitates PR creation from supply lists
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { SupplyItem, SupplyProcurementStatus } from '@vapour/types';

/**
 * Add supply item to master document
 */
export async function addSupplyItem(
  data: Omit<SupplyItem, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>
): Promise<string> {
  const now = Timestamp.now();

  const supplyItemData: Omit<SupplyItem, 'id'> = {
    ...data,
    procurementStatus: data.procurementStatus || 'NOT_INITIATED',
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  const docRef = await addDoc(
    collection(db, 'projects', data.projectId, 'supplyItems'),
    supplyItemData
  );

  // Update master document supply item count
  await incrementSupplyItemCount(data.projectId, data.masterDocumentId);

  return docRef.id;
}

/**
 * Update supply item
 */
export async function updateSupplyItem(
  projectId: string,
  supplyItemId: string,
  updates: Partial<Omit<SupplyItem, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'projects', projectId, 'supplyItems', supplyItemId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Link supply item to purchase request
 */
export async function linkSupplyItemToPR(
  projectId: string,
  supplyItemId: string,
  purchaseRequestId: string,
  purchaseRequestNumber: string
): Promise<void> {
  await updateSupplyItem(projectId, supplyItemId, {
    linkedPurchaseRequestId: purchaseRequestId,
    linkedPurchaseRequestNumber: purchaseRequestNumber,
    procurementStatus: 'PR_CREATED',
  });
}

/**
 * Get supply item by ID
 */
export async function getSupplyItemById(
  projectId: string,
  supplyItemId: string
): Promise<SupplyItem | null> {
  const docRef = doc(db, 'projects', projectId, 'supplyItems', supplyItemId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as SupplyItem;
}

/**
 * Get supply items for a master document
 */
export async function getSupplyItemsByDocument(
  projectId: string,
  masterDocumentId: string
): Promise<SupplyItem[]> {
  const q = query(
    collection(db, 'projects', projectId, 'supplyItems'),
    where('masterDocumentId', '==', masterDocumentId),
    where('isDeleted', '==', false),
    orderBy('createdAt', 'asc')
  );

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SupplyItem[];
}

/**
 * Get supply items by procurement status
 */
export async function getSupplyItemsByStatus(
  projectId: string,
  status: SupplyProcurementStatus
): Promise<SupplyItem[]> {
  const q = query(
    collection(db, 'projects', projectId, 'supplyItems'),
    where('procurementStatus', '==', status),
    where('isDeleted', '==', false),
    orderBy('createdAt', 'asc')
  );

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as SupplyItem[];
}

/**
 * Get all supply items pending PR creation
 */
export async function getSupplyItemsPendingPR(
  projectId: string
): Promise<SupplyItem[]> {
  return await getSupplyItemsByStatus(projectId, 'NOT_INITIATED');
}

/**
 * Soft delete supply item
 */
export async function deleteSupplyItem(
  projectId: string,
  supplyItemId: string
): Promise<void> {
  const item = await getSupplyItemById(projectId, supplyItemId);

  if (!item) {
    throw new Error('Supply item not found');
  }

  await updateSupplyItem(projectId, supplyItemId, {
    isDeleted: true,
  });

  // Decrement master document supply item count
  await decrementSupplyItemCount(projectId, item.masterDocumentId);
}

/**
 * Increment supply item count on master document
 */
async function incrementSupplyItemCount(
  projectId: string,
  masterDocumentId: string
): Promise<void> {
  const docRef = doc(db, 'projects', projectId, 'masterDocuments', masterDocumentId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const currentCount = docSnap.data().supplyItemCount || 0;
    await updateDoc(docRef, {
      hasSupplyList: true,
      supplyItemCount: currentCount + 1,
      updatedAt: Timestamp.now(),
    });
  }
}

/**
 * Decrement supply item count on master document
 */
async function decrementSupplyItemCount(
  projectId: string,
  masterDocumentId: string
): Promise<void> {
  const docRef = doc(db, 'projects', projectId, 'masterDocuments', masterDocumentId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const currentCount = docSnap.data().supplyItemCount || 0;
    const newCount = Math.max(0, currentCount - 1);
    await updateDoc(docRef, {
      hasSupplyList: newCount > 0,
      supplyItemCount: newCount,
      updatedAt: Timestamp.now(),
    });
  }
}

/**
 * Get supply items summary for project
 */
export async function getSupplyItemsSummary(projectId: string): Promise<{
  total: number;
  notInitiated: number;
  prCreated: number;
  rfqIssued: number;
  poPlaced: number;
  delivered: number;
  completed: number;
}> {
  const q = query(
    collection(db, 'projects', projectId, 'supplyItems'),
    where('isDeleted', '==', false)
  );

  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map((doc) => doc.data() as SupplyItem);

  return {
    total: items.length,
    notInitiated: items.filter((i) => i.procurementStatus === 'NOT_INITIATED').length,
    prCreated: items.filter((i) => i.procurementStatus === 'PR_CREATED').length,
    rfqIssued: items.filter((i) => i.procurementStatus === 'RFQ_ISSUED').length,
    poPlaced: items.filter((i) => i.procurementStatus === 'PO_PLACED').length,
    delivered: items.filter((i) => i.procurementStatus === 'DELIVERED').length,
    completed: items.filter((i) => i.procurementStatus === 'COMPLETED').length,
  };
}
