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
  runTransaction,
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
import { logAuditEvent, createAuditContext } from '@/lib/audit';

import { createTaskNotification } from '@/lib/tasks/taskNotificationService';

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
  // rule5-exempt: procurement workflow operation; firestore.rules enforce MANAGE_PROCUREMENT on the affected collections; client-side check is defense-in-depth deferred
  const { db } = getFirebase();

  // Get PO
  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, input.purchaseOrderId));
  if (!poDoc.exists()) {
    throw new Error('Purchase Order not found');
  }

  const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

  const wccNumber = await generateProcurementNumber(PROCUREMENT_NUMBER_CONFIGS.WORK_COMPLETION);
  const now = Timestamp.now();

  // Create WCC — inherit tenantId from the PO so tenant-scoped queries and
  // Firestore rules work correctly (CLAUDE.md rule 1).
  const wccData: Omit<WorkCompletionCertificate, 'id'> = {
    number: wccNumber,
    ...(po.tenantId && { tenantId: po.tenantId }),
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
    ...(input.remarks !== undefined && { remarks: input.remarks }),
    issuedBy: userId,
    issuedByName: userName,
    issuedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const wccRef = await addDoc(collection(db, COLLECTIONS.WORK_COMPLETION_CERTIFICATES), wccData);

  // GAP 1: Notify accounting team to create bill for WCC
  createTaskNotification({
    type: 'actionable',
    category: 'WCC_READY_FOR_BILLING',
    userId: po.createdBy || userId,
    assignedBy: userId,
    assignedByName: userName,
    title: `Create Bill for WCC ${wccNumber} — PO ${po.number}`,
    message: `Work Completion Certificate ${wccNumber} has been issued for PO ${po.number} (${po.vendorName}). Please create a bill in accounting.`,
    entityType: 'WORK_COMPLETION_CERTIFICATE',
    entityId: wccRef.id,
    linkUrl: `/procurement/work-completion/${wccRef.id}`,
    priority: 'HIGH',
    autoCompletable: true,
    projectId: input.projectId,
  }).catch((err) => {
    logger.error('Failed to create WCC billing notification', { error: err, wccId: wccRef.id });
  });

  logger.info('Work Completion Certificate created', { wccId: wccRef.id, wccNumber });

  return wccRef.id;
}

// ============================================================================
// UPDATE WCC (completion flags + remarks)
// ============================================================================

export interface UpdateWCCCompletionInput {
  allItemsDelivered?: boolean;
  allItemsAccepted?: boolean;
  allPaymentsCompleted?: boolean;
  remarks?: string;
}

/**
 * Update a WCC's completion flags (feedback JPniHKT59RWVgksV70iq — e.g. flip
 * "All Payments Completed" to Yes after the final payment). A certificate
 * whose three flags are all true is fully complete and locked — only remarks
 * may change; flags can be set true but never rolled back to false, so the
 * certificate's history stays trustworthy.
 */
export async function updateWCCCompletion(
  wccId: string,
  input: UpdateWCCCompletionInput,
  userId: string,
  userName: string
): Promise<void> {
  // rule5-exempt: procurement workflow operation; firestore.rules enforce MANAGE_PROCUREMENT on the affected collections; client-side check is defense-in-depth deferred
  const { db } = getFirebase();

  const wccRef = doc(db, COLLECTIONS.WORK_COMPLETION_CERTIFICATES, wccId);

  // Validate against the current flags inside a transaction (rule 19) so a
  // concurrent update can't slip past the completion lock.
  const { wcc, nowComplete } = await runTransaction(db, async (tx) => {
    const wccDoc = await tx.get(wccRef);
    if (!wccDoc.exists()) {
      throw new Error('Work Completion Certificate not found');
    }
    const current = wccDoc.data() as WorkCompletionCertificate;

    const wasComplete =
      current.allItemsDelivered && current.allItemsAccepted && current.allPaymentsCompleted;
    if (
      wasComplete &&
      (input.allItemsDelivered !== undefined ||
        input.allItemsAccepted !== undefined ||
        input.allPaymentsCompleted !== undefined)
    ) {
      throw new Error('This certificate is fully complete and its completion flags are locked');
    }
    for (const flag of ['allItemsDelivered', 'allItemsAccepted', 'allPaymentsCompleted'] as const) {
      if (input[flag] === false && current[flag] === true) {
        throw new Error(`${flag} is already confirmed and cannot be reverted to No`);
      }
    }

    tx.update(wccRef, {
      ...(input.allItemsDelivered !== undefined && { allItemsDelivered: input.allItemsDelivered }),
      ...(input.allItemsAccepted !== undefined && { allItemsAccepted: input.allItemsAccepted }),
      ...(input.allPaymentsCompleted !== undefined && {
        allPaymentsCompleted: input.allPaymentsCompleted,
      }),
      ...(input.remarks !== undefined && { remarks: input.remarks }),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return {
      wcc: current,
      nowComplete:
        (input.allItemsDelivered ?? current.allItemsDelivered) &&
        (input.allItemsAccepted ?? current.allItemsAccepted) &&
        (input.allPaymentsCompleted ?? current.allPaymentsCompleted),
    };
  });

  const auditContext = createAuditContext(userId, '', userName);
  logAuditEvent(
    db,
    auditContext,
    nowComplete ? 'WCC_COMPLETED' : 'WCC_UPDATED',
    'WORK_COMPLETION_CERTIFICATE',
    wccId,
    nowComplete
      ? `WCC ${wcc.number} marked fully complete (PO ${wcc.poNumber})`
      : `WCC ${wcc.number} completion status updated (PO ${wcc.poNumber})`,
    {
      entityName: wcc.number,
      metadata: {
        ...input,
        poNumber: wcc.poNumber,
      },
    }
  ).catch((err) => logger.error('Failed to log WCC update audit event', { error: err, wccId }));

  logger.info('WCC completion status updated', { wccId, nowComplete });
}

/**
 * True when every non-deleted vendor bill against the PO is fully paid (and at
 * least one bill exists) — used to suggest/validate "All Payments Completed".
 */
export async function arePOPaymentsComplete(purchaseOrderId: string): Promise<boolean> {
  const { db } = getFirebase();
  const billsSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('type', '==', 'VENDOR_BILL'),
      where('purchaseOrderId', '==', purchaseOrderId)
    )
  );
  const bills = billsSnap.docs.map((d) => d.data()).filter((b) => !b.isDeleted);
  if (bills.length === 0) return false;
  return bills.every((b) => b.paymentStatus === 'PAID');
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
