/**
 * Work Completion Certificate Service
 *
 * Handles WCC creation and tracking
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { WorkCompletionCertificate, PurchaseOrder } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { generateProcurementNumber, PROCUREMENT_NUMBER_CONFIGS } from './generateProcurementNumber';

const logger = createLogger({ context: 'workCompletionService' });

// ============================================================================
// CREATE WCC
// ============================================================================

export interface CreateWorkCompletionCertificateInput {
  purchaseOrderId: string;
  projectId: string;
  projectName: string;
  workDescription: string;
  completionDate: Date;
  allItemsDelivered: boolean;
  allItemsAccepted: boolean;
  allPaymentsCompleted: boolean;
  certificateText: string;
  remarks?: string;
}

export async function createWorkCompletionCertificate(
  input: CreateWorkCompletionCertificateInput,
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

  const wccNumber = await generateProcurementNumber(PROCUREMENT_NUMBER_CONFIGS.WORK_COMPLETION);
  const now = Timestamp.now();

  // Create WCC
  const wccData: Omit<WorkCompletionCertificate, 'id'> = {
    number: wccNumber,
    purchaseOrderId: input.purchaseOrderId,
    poNumber: po.number,
    vendorId: po.vendorId,
    vendorName: po.vendorName,
    projectId: input.projectId,
    projectName: input.projectName,
    workDescription: input.workDescription,
    completionDate: Timestamp.fromDate(input.completionDate),
    allItemsDelivered: input.allItemsDelivered,
    allItemsAccepted: input.allItemsAccepted,
    allPaymentsCompleted: input.allPaymentsCompleted,
    certificateText: input.certificateText,
    remarks: input.remarks,
    issuedBy: userId,
    issuedByName: userName,
    issuedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const wccRef = await addDoc(collection(db, COLLECTIONS.WORK_COMPLETION_CERTIFICATES), wccData);

  logger.info('Work Completion Certificate created', { wccId: wccRef.id, wccNumber });

  return wccRef.id;
}

// ============================================================================
// READ WCC
// ============================================================================

export async function getWCCById(wccId: string): Promise<WorkCompletionCertificate | null> {
  const { db } = getFirebase();

  const wccDoc = await getDoc(doc(db, COLLECTIONS.WORK_COMPLETION_CERTIFICATES, wccId));

  if (!wccDoc.exists()) {
    return null;
  }

  return { id: wccDoc.id, ...wccDoc.data() } as WorkCompletionCertificate;
}

export async function listWCCs(
  filters: { poId?: string; projectId?: string; limit?: number } = {}
): Promise<WorkCompletionCertificate[]> {
  const { db } = getFirebase();

  const constraints: QueryConstraint[] = [];

  if (filters.poId) {
    constraints.push(where('purchaseOrderId', '==', filters.poId));
  }

  if (filters.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, COLLECTIONS.WORK_COMPLETION_CERTIFICATES), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as WorkCompletionCertificate[];
}
