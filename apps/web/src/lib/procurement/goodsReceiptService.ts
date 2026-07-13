/**
 * Goods Receipt Service
 *
 * Handles goods inspection and receipt operations
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseOrder,
  PurchaseOrderItem,
  ItemCondition,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';
import { goodsReceiptStateMachine, purchaseOrderStateMachine } from '@/lib/workflow/stateMachines';
import { withIdempotency, generateIdempotencyKey } from '@/lib/utils/idempotencyService';
import { generateProcurementNumber, PROCUREMENT_NUMBER_CONFIGS } from './generateProcurementNumber';

const logger = createLogger({ context: 'goodsReceiptService' });
import {
  createBillFromGoodsReceipt,
  createPaymentFromApprovedReceipt,
} from './accountingIntegration';
import { PERMISSION_FLAGS, PERMISSION_FLAGS_2 } from '@vapour/constants';
import { requirePermission, preventSelfApproval } from '@/lib/auth/authorizationService';
import { getUsersWithPermission } from '@/lib/auth/userLookup';
import { getPLById } from './packingListService';

// ============================================================================
// CREATE GR
// ============================================================================

export interface CreateGoodsReceiptInput {
  purchaseOrderId: string;
  /** A Goods Receipt requires an existing, non-draft Packing List for the PO (rule 23). */
  packingListId: string;
  projectId: string;
  projectName: string;
  inspectionType: 'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY';
  inspectionLocation: string;
  inspectionDate: Date;
  overallNotes?: string;
  items: Array<{
    poItemId: string;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    condition: ItemCondition;
    conditionNotes?: string;
    testingRequired: boolean;
    testingCompleted?: boolean;
    testResult?: 'PASS' | 'FAIL' | 'CONDITIONAL';
    hasIssues: boolean;
    issues?: string[];
  }>;
}

export async function createGoodsReceipt(
  input: CreateGoodsReceiptInput,
  userId: string,
  userName: string,
  userPermissions2?: number
): Promise<string> {
  // rule8-exempt: sets the initial status on a brand-new document — state-machine validation only applies to transitions, not first-write
  // PR-16: Check INSPECT_GOODS permission for GR creation
  if (userPermissions2 !== undefined) {
    requirePermission(
      userPermissions2,
      PERMISSION_FLAGS_2.INSPECT_GOODS,
      userId,
      'create goods receipt'
    );
  }

  const { db } = getFirebase();

  // Generate idempotency key based on PO ID, inspection date, and user
  // This prevents duplicate GR creation from double-clicks or network retries
  const inspectionDateStr = input.inspectionDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const idempotencyKey = generateIdempotencyKey(
    'create-goods-receipt',
    input.purchaseOrderId,
    `${userId}-${inspectionDateStr}`
  );

  return withIdempotency(
    db,
    idempotencyKey,
    'create-goods-receipt',
    async () => {
      // A Goods Receipt requires an existing, finalized (non-draft) Packing
      // List for the PO — vendors ship against a packing list, and creating
      // one is how procurement records shipment details before receipt.
      if (!input.packingListId) {
        throw new Error(
          'A Packing List is required before creating a Goods Receipt. Create and finalize a Packing List for this PO first.'
        );
      }
      const packingList = await getPLById(input.packingListId);
      if (!packingList) {
        throw new Error('Packing List not found');
      }
      if (packingList.purchaseOrderId !== input.purchaseOrderId) {
        throw new Error(
          `Packing List ${packingList.number} does not belong to Purchase Order ${input.purchaseOrderId}`
        );
      }
      if (packingList.status === 'DRAFT') {
        throw new Error(
          `Packing List ${packingList.number} must be finalized before it can be used for a Goods Receipt`
        );
      }

      // Reject negative or all-zero received quantities (a GR must record an
      // actual receipt; over-delivery per item is validated later against
      // live PO item quantities inside the transaction).
      for (const item of input.items) {
        if (item.receivedQuantity < 0) {
          throw new Error(`Received quantity cannot be negative for item ${item.poItemId}`);
        }
      }
      const totalReceivedQuantity = input.items.reduce(
        (sum, item) => sum + item.receivedQuantity,
        0
      );
      if (totalReceivedQuantity <= 0) {
        throw new Error('Received quantity must be greater than zero for at least one item');
      }

      // Generate GR number (uses its own transaction for counter)
      const grNumber = await generateProcurementNumber(PROCUREMENT_NUMBER_CONFIGS.GOODS_RECEIPT);

      // Get PO items outside transaction (read-only, for item descriptions)
      const poItemsQuery = query(
        collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS),
        where('purchaseOrderId', '==', input.purchaseOrderId)
      );
      const poItemsSnapshot = await getDocs(poItemsQuery);
      const poItems = poItemsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as PurchaseOrderItem[];

      // Block GR creation once every PO item has already been fully received
      // (mirrors the equivalent check in packingListService.createPackingList).
      const anyRemaining = poItems.some(
        (poItem) => (poItem.quantity || 0) - (poItem.quantityDelivered || 0) > 0
      );
      if (poItems.length > 0 && !anyRemaining) {
        throw new Error(
          'This Purchase Order has already been fully received — no quantity remains to receive'
        );
      }

      // Calculate derived values
      const allAccepted = input.items.every(
        (item) => item.acceptedQuantity === item.receivedQuantity
      );
      const someRejected = input.items.some((item) => item.rejectedQuantity > 0);
      const hasIssues = input.items.some((item) => item.hasIssues);

      let overallCondition: 'ACCEPTED' | 'CONDITIONALLY_ACCEPTED' | 'REJECTED' = 'ACCEPTED';
      if (someRejected || hasIssues) {
        overallCondition = 'CONDITIONALLY_ACCEPTED';
      }
      if (!allAccepted && input.items.every((item) => item.acceptedQuantity === 0)) {
        overallCondition = 'REJECTED';
      }

      // Execute all writes atomically in a transaction
      const { grId, poNumber, poVendorName, poCreatedBy } = await runTransaction(
        db,
        async (transaction) => {
          const now = Timestamp.now();

          // Read PO within transaction to ensure consistency
          const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, input.purchaseOrderId);
          const poDoc = await transaction.get(poRef);
          if (!poDoc.exists()) {
            throw new Error('Purchase Order not found');
          }
          const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

          // Read current PO item quantities within transaction
          const poItemRefs = input.items.map((item) =>
            doc(db, COLLECTIONS.PURCHASE_ORDER_ITEMS, item.poItemId)
          );
          const poItemDocs = await Promise.all(poItemRefs.map((ref) => transaction.get(ref)));

          // Validate quantities against PO items (prevent over-delivery)
          input.items.forEach((item) => {
            const poItemDoc = poItemDocs.find((d) => d.id === item.poItemId);
            if (poItemDoc?.exists()) {
              const currentPoItem = poItemDoc.data() as PurchaseOrderItem;
              const remainingQuantity =
                (currentPoItem.quantity || 0) - (currentPoItem.quantityDelivered || 0);

              if (item.receivedQuantity > remainingQuantity) {
                throw new Error(
                  `Over-delivery not allowed: item "${currentPoItem.description || item.poItemId}" received ${item.receivedQuantity} but only ${remainingQuantity} remaining`
                );
              }
              if (item.acceptedQuantity > item.receivedQuantity) {
                throw new Error(
                  `Accepted quantity (${item.acceptedQuantity}) cannot exceed received quantity (${item.receivedQuantity}) for item "${currentPoItem.description || item.poItemId}"`
                );
              }
              if (item.rejectedQuantity > item.receivedQuantity) {
                throw new Error(
                  `Rejected quantity (${item.rejectedQuantity}) cannot exceed received quantity (${item.receivedQuantity}) for item "${currentPoItem.description || item.poItemId}"`
                );
              }
            }
          });

          // Create GR document
          const grRef = doc(collection(db, COLLECTIONS.GOODS_RECEIPTS));
          const grData: Omit<GoodsReceipt, 'id'> = {
            number: grNumber,
            purchaseOrderId: input.purchaseOrderId,
            poNumber: po.number,
            packingListId: input.packingListId,
            packingListNumber: packingList.number,
            projectId: input.projectId,
            projectName: input.projectName,
            tenantId: poDoc.data()?.tenantId || '',
            inspectionType: input.inspectionType,
            inspectionLocation: input.inspectionLocation,
            inspectionDate: Timestamp.fromDate(input.inspectionDate),
            overallCondition,
            overallNotes: input.overallNotes,
            hasIssues,
            issuesSummary: hasIssues
              ? input.items
                  .filter((item) => item.hasIssues)
                  .flatMap((item) => item.issues || [])
                  .join('; ')
              : undefined,
            status: 'IN_PROGRESS',
            approvedForPayment: false,
            inspectedBy: userId,
            inspectedByName: userName,
            createdAt: now,
            updatedAt: now,
          };

          // Remove undefined values before sending to Firestore (Firestore doesn't accept undefined)
          const cleanedGrData = Object.fromEntries(
            Object.entries(grData).filter(([, value]) => value !== undefined)
          );
          transaction.set(grRef, cleanedGrData);

          // Create GR items and update PO items atomically
          input.items.forEach((item, index) => {
            const poItem = poItems.find((pi) => pi.id === item.poItemId);
            const poItemDoc = poItemDocs[index];

            // Create GR item
            const grItemRef = doc(collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS));
            const grItemData: Omit<GoodsReceiptItem, 'id'> = {
              goodsReceiptId: grRef.id,
              poItemId: item.poItemId,
              lineNumber: index + 1,
              description: poItem?.description || 'Unknown Item',
              equipmentId: poItem?.equipmentId,
              equipmentCode: poItem?.equipmentCode,
              orderedQuantity: poItem?.quantity || 0,
              receivedQuantity: item.receivedQuantity,
              acceptedQuantity: item.acceptedQuantity,
              rejectedQuantity: item.rejectedQuantity,
              unit: poItem?.unit || '',
              condition: item.condition,
              conditionNotes: item.conditionNotes,
              testingRequired: item.testingRequired,
              testingCompleted: item.testingCompleted || false,
              testResult: item.testResult,
              photoCount: 0,
              hasIssues: item.hasIssues,
              issues: item.issues,
              createdAt: now,
              updatedAt: now,
            };
            // Remove undefined values before sending to Firestore
            const cleanedGrItemData = Object.fromEntries(
              Object.entries(grItemData).filter(([, value]) => value !== undefined)
            );
            transaction.set(grItemRef, cleanedGrItemData);

            // Update PO item quantities (using current values from transaction read)
            if (poItemDoc?.exists()) {
              const currentPoItem = poItemDoc.data() as PurchaseOrderItem;
              const newDelivered = (currentPoItem.quantityDelivered || 0) + item.receivedQuantity;
              const newAccepted = (currentPoItem.quantityAccepted || 0) + item.acceptedQuantity;
              const newRejected = (currentPoItem.quantityRejected || 0) + item.rejectedQuantity;

              let deliveryStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE' = 'PARTIAL';
              if (newDelivered >= (currentPoItem.quantity || 0)) {
                deliveryStatus = 'COMPLETE';
              } else if (newDelivered === 0) {
                deliveryStatus = 'PENDING';
              }

              transaction.update(doc(db, COLLECTIONS.PURCHASE_ORDER_ITEMS, item.poItemId), {
                quantityDelivered: newDelivered,
                quantityAccepted: newAccepted,
                quantityRejected: newRejected,
                deliveryStatus,
                updatedAt: now,
              });
            }
          });

          // GAP 2: Calculate and update PO-level deliveryProgress
          const grItemIds = new Set(input.items.map((i) => i.poItemId));
          let totalOrdered = 0;
          let totalDelivered = 0;

          for (const poItem of poItems) {
            totalOrdered += poItem.quantity || 0;
            if (grItemIds.has(poItem.id)) {
              const grItem = input.items.find((i) => i.poItemId === poItem.id)!;
              const txnPoItemDoc = poItemDocs.find((d) => d.id === poItem.id);
              const currentDelivered = txnPoItemDoc?.exists()
                ? (txnPoItemDoc.data() as PurchaseOrderItem).quantityDelivered || 0
                : poItem.quantityDelivered || 0;
              totalDelivered += currentDelivered + grItem.receivedQuantity;
            } else {
              totalDelivered += poItem.quantityDelivered || 0;
            }
          }

          const deliveryProgress =
            totalOrdered > 0 ? Math.min(100, Math.round((totalDelivered / totalOrdered) * 100)) : 0;

          const poUpdateData: Record<string, unknown> = {
            deliveryProgress,
            updatedAt: now,
          };

          // Auto-advance PO status with delivery progress (feedback
          // i7brfS9rrdfGVxRTHHZu). COMPLETED is a manual action (decision:
          // closure can involve offline steps beyond delivery) — this only
          // ever moves the PO to DELIVERED or IN_PROGRESS, and only when
          // that transition is currently legal (idempotent no-op otherwise).
          const deliveryTarget = deliveryProgress === 100 ? 'DELIVERED' : 'IN_PROGRESS';
          if (purchaseOrderStateMachine.canTransitionTo(po.status, deliveryTarget)) {
            poUpdateData.status = deliveryTarget;
          }

          transaction.update(poRef, poUpdateData);

          return {
            grId: grRef.id,
            poNumber: po.number,
            poVendorName: po.vendorName,
            poCreatedBy: po.createdBy,
          };
        }
      );

      // Audit log outside transaction (non-critical, fire-and-forget)
      const auditContext = createAuditContext(userId, '', userName);
      logAuditEvent(
        db,
        auditContext,
        'GR_CREATED',
        'GOODS_RECEIPT',
        grId,
        `Created Goods Receipt ${grNumber} for PO ${poNumber}`,
        {
          entityName: grNumber,
          metadata: {
            purchaseOrderId: input.purchaseOrderId,
            poNumber,
            vendorName: poVendorName,
            overallCondition,
            itemCount: input.items.length,
            hasIssues,
          },
        }
      ).catch((err) => logger.error('Failed to log audit event', { error: err }));

      // GAP 4: Notify procurement team when GR has rejected items
      if (hasIssues) {
        const rejectedCount = input.items.filter((item) => item.rejectedQuantity > 0).length;
        createTaskNotification({
          type: 'actionable',
          category: 'GR_ITEMS_REJECTED',
          userId: poCreatedBy || userId,
          assignedBy: userId,
          assignedByName: userName,
          title: `Quality issues on GR ${grNumber} — ${rejectedCount} item(s) rejected`,
          message: `Goods Receipt ${grNumber} for PO ${poNumber} has ${rejectedCount} item(s) with quality issues. Review and take action.`,
          entityType: 'GOODS_RECEIPT',
          entityId: grId,
          linkUrl: `/procurement/goods-receipts/${grId}`,
          priority: 'HIGH',
          autoCompletable: false,
          projectId: input.projectId,
        }).catch((err) => {
          logger.error('Failed to create GR rejection notification', { error: err, grId });
        });
      }

      logger.info('Goods Receipt created', { grId, grNumber });

      return grId;
    },
    { userId, metadata: { purchaseOrderId: input.purchaseOrderId, userName } }
  );
}

// ============================================================================
// READ GR
// ============================================================================

export async function getGRById(grId: string): Promise<GoodsReceipt | null> {
  const { db } = getFirebase();

  const grDoc = await getDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, grId));

  if (!grDoc.exists()) {
    return null;
  }

  return { id: grDoc.id, ...grDoc.data() } as GoodsReceipt;
}

export async function getGRItems(grId: string): Promise<GoodsReceiptItem[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS),
    where('goodsReceiptId', '==', grId),
    orderBy('lineNumber', 'asc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GoodsReceiptItem[];
}

// ============================================================================
// GR WORKFLOW
// ============================================================================

export async function completeGR(
  grId: string,
  userId: string,
  userEmail: string,
  userName?: string,
  userPermissions?: number,
  userPermissions2?: number,
  tenantId?: string
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validated the transition
  // PR-16: Use granular APPROVE_GR flag when available, fall back to MANAGE_PROCUREMENT
  if (userPermissions2 !== undefined) {
    requirePermission(
      userPermissions2,
      PERMISSION_FLAGS_2.APPROVE_GR,
      userId,
      'complete goods receipt'
    );
  } else if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'complete goods receipt'
    );
  }

  const { db } = getFirebase();

  const gr = await getGRById(grId);
  if (!gr) {
    throw new Error('Goods Receipt not found');
  }

  // Validate state machine transition
  const transitionResult = goodsReceiptStateMachine.validateTransition(gr.status, 'COMPLETED');
  if (!transitionResult.allowed) {
    throw new Error(transitionResult.reason || `Cannot complete GR with status: ${gr.status}`);
  }

  // Get PO to find creator for task notification
  const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, gr.purchaseOrderId));
  const po = poDoc.exists() ? (poDoc.data() as PurchaseOrder) : null;

  // Atomically update GR status and create bill in a transaction
  // This ensures we don't end up with a completed GR but no bill
  await runTransaction(db, async (transaction) => {
    const now = Timestamp.now();
    const grRef = doc(db, COLLECTIONS.GOODS_RECEIPTS, grId);

    // Re-read GR within transaction to ensure consistency
    const grDocInTxn = await transaction.get(grRef);
    if (!grDocInTxn.exists()) {
      throw new Error('Goods Receipt not found');
    }

    const grInTxn = { id: grDocInTxn.id, ...grDocInTxn.data() } as GoodsReceipt;

    // Re-validate state machine transition within transaction
    const txnTransitionResult = goodsReceiptStateMachine.validateTransition(
      grInTxn.status,
      'COMPLETED'
    );
    if (!txnTransitionResult.allowed) {
      throw new Error(
        txnTransitionResult.reason || `Cannot complete GR with status: ${grInTxn.status}`
      );
    }

    // Check if bill already exists
    if (grInTxn.paymentRequestId) {
      // Bill already exists, just mark GR as complete
      transaction.update(grRef, {
        status: 'COMPLETED',
        updatedAt: now,
      });
      return;
    }

    // Mark GR as completed
    transaction.update(grRef, {
      status: 'COMPLETED',
      updatedAt: now,
    });

    // Note: Bill creation involves complex GL entry generation that reads from
    // chart of accounts. We call it after the transaction for now, but link it
    // back. A future enhancement could make this fully transactional.
  });

  // Create bill after GR is marked complete (required by createBillFromGoodsReceipt)
  // Refetch GR to get updated status
  const updatedGR = await getGRById(grId);
  if (updatedGR && !updatedGR.paymentRequestId) {
    try {
      await createBillFromGoodsReceipt(db, updatedGR, userId, userEmail, tenantId);
    } catch (err) {
      // Graceful degrade (rule 27): GR completion stands even if the bill
      // auto-draft fails — but tell the user instead of only logging (known-gaps 2.3).
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn('Error creating bill from GR (can be created manually)', { error: err, grId });
      try {
        await createTaskNotification({
          type: 'actionable',
          category: 'ACCOUNTING_HANDOFF_FAILED',
          userId,
          assignedBy: userId,
          title: `Vendor bill for GR ${gr.number} failed to draft`,
          message: `The automatic vendor bill for goods receipt ${gr.number} (PO ${gr.poNumber}) could not be created — create it manually in Accounting. Error: ${errorMessage}`,
          entityType: 'GOODS_RECEIPT',
          entityId: grId,
          linkUrl: `/procurement/goods-receipts/${grId}`,
          priority: 'HIGH',
          projectId: gr.projectId,
        });
      } catch (notifErr) {
        // Last resort: the notification write itself failed; the warn log above remains.
        logger.error('Failed to create ACCOUNTING_HANDOFF_FAILED notification', {
          grId,
          error: notifErr,
        });
      }
    }
  }

  // GAP 5: Create three-way match notification when GR + bill exist
  const grAfterBill = await getGRById(grId);
  if (grAfterBill?.paymentRequestId && po?.createdBy) {
    createTaskNotification({
      type: 'actionable',
      category: 'THREE_WAY_MATCH_READY',
      userId: po.createdBy,
      assignedBy: userId,
      assignedByName: userName || userEmail,
      title: `Run Three-Way Match for PO ${gr.poNumber}`,
      message: `GR ${gr.number} is complete and bill created for PO ${gr.poNumber}. Verify the three-way match (PO vs GR vs Bill).`,
      entityType: 'PURCHASE_ORDER',
      entityId: gr.purchaseOrderId,
      linkUrl: `/procurement/pos/${gr.purchaseOrderId}`,
      priority: 'MEDIUM',
      autoCompletable: false,
      projectId: gr.projectId,
    }).catch((err) => {
      logger.error('Failed to create three-way match notification', { error: err, grId });
    });
  }

  // Audit log outside transaction (non-critical)
  const auditContext = createAuditContext(userId, '', userName || userEmail);
  logAuditEvent(
    db,
    auditContext,
    'GR_COMPLETED',
    'GOODS_RECEIPT',
    grId,
    `Completed Goods Receipt ${gr.number}`,
    {
      entityName: gr.number,
      metadata: {
        poNumber: gr.poNumber,
        overallCondition: gr.overallCondition,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));

  // Notify accounting users to clear the GR for payment (non-critical).
  // Routed by permission, not to the PO creator — payment clearance is an
  // accounting action (MANAGE_ACCOUNTING), and procurement's signal is the
  // GR completion itself.
  getUsersWithPermission(db, tenantId || 'default-entity', PERMISSION_FLAGS.MANAGE_ACCOUNTING)
    .then((accountingUserIds) => {
      if (accountingUserIds.length === 0) {
        logger.warn('No accounting users found to notify for GR payment clearance', { grId });
        return;
      }
      return Promise.all(
        accountingUserIds.map((accountingUserId) =>
          createTaskNotification({
            type: 'actionable',
            category: 'GR_READY_FOR_PAYMENT',
            userId: accountingUserId,
            assignedBy: userId,
            assignedByName: userName || userEmail,
            title: `Clear Payment for GR ${gr.number}`,
            message: `Goods Receipt ${gr.number} for PO ${gr.poNumber} (${po?.vendorName || 'vendor'}) is complete. Please review and clear it for payment.`,
            entityType: 'GOODS_RECEIPT',
            entityId: grId,
            linkUrl: `/procurement/goods-receipts/${grId}`,
            priority: gr.overallCondition === 'ACCEPTED' ? 'MEDIUM' : 'HIGH',
            autoCompletable: true,
            projectId: gr.projectId,
          })
        )
      );
    })
    .catch((err) => {
      logger.error('Failed to create GR payment clearance tasks', { error: err, grId });
    });

  logger.info('Goods Receipt completed', { grId });
}

export async function approveGRForPayment(
  grId: string,
  bankAccountId: string,
  userId: string,
  userEmail: string,
  userName?: string,
  userPermissions?: number
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validated the transition; firestore.rules + caller-side state machine cover the safety check
  // Authorization check (PR-1): payment approval requires accounting permission
  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_ACCOUNTING,
      userId,
      'approve GR for payment'
    );
  }

  const { db } = getFirebase();

  // PR-9: Validate bank account exists and is a bank account
  const bankAccountRef = doc(db, COLLECTIONS.ACCOUNTS, bankAccountId);
  const bankAccountDoc = await getDoc(bankAccountRef);
  if (!bankAccountDoc.exists()) {
    throw new Error('Bank account not found');
  }
  const bankAccountData = bankAccountDoc.data();
  if (!bankAccountData?.isBankAccount) {
    throw new Error('Selected account is not a bank account');
  }

  // Atomically approve GR for payment
  // This prevents race conditions where multiple users try to approve
  const gr = await runTransaction(db, async (transaction) => {
    const now = Timestamp.now();
    const grRef = doc(db, COLLECTIONS.GOODS_RECEIPTS, grId);

    const grDoc = await transaction.get(grRef);
    if (!grDoc.exists()) {
      throw new Error('Goods Receipt not found');
    }

    const grData = { id: grDoc.id, ...grDoc.data() } as GoodsReceipt;

    // Validation checks within transaction
    if (grData.status !== 'COMPLETED') {
      throw new Error('Goods Receipt must be completed before approving payment');
    }

    if (grData.approvedForPayment) {
      throw new Error('Goods Receipt is already approved for payment');
    }

    if (!grData.paymentRequestId) {
      throw new Error('No bill found for this Goods Receipt. Create bill first.');
    }

    // Prevent self-approval — payment approver must differ from GR inspector.
    if (grData.inspectedBy) {
      preventSelfApproval(userId, grData.inspectedBy, 'approve GR for payment');
    }

    // Update GR atomically
    transaction.update(grRef, {
      approvedForPayment: true,
      paymentApprovedBy: userId,
      paymentApprovedAt: now,
      updatedAt: now,
    });

    return grData;
  });

  await logAuditEvent(
    db,
    createAuditContext(userId, userEmail || '', userName || ''),
    'GR_PAYMENT_APPROVED',
    'GOODS_RECEIPT',
    grId,
    `GR ${gr.number || grId} approved for payment from bank account ${bankAccountId}`,
    {
      entityName: gr.number,
      severity: 'WARNING',
      metadata: {
        bankAccountId,
        purchaseOrderId: gr.purchaseOrderId,
        inspectedBy: gr.inspectedBy,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));

  // Create payment after GR approval is persisted
  // Note: Payment involves GL entries and bill updates - complex but handled by paymentHelpers
  try {
    // Refetch GR with updated approval status
    const updatedGR = await getGRById(grId);
    if (updatedGR) {
      await createPaymentFromApprovedReceipt(db, updatedGR, bankAccountId, userId, userEmail);
    }
  } catch (err) {
    // Graceful degrade (rule 27): the payment clearance stands even if the
    // payment auto-draft fails — but tell the user instead of only logging
    // (known-gaps 2.3).
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn('Error creating payment from GR (can be created manually)', { error: err, grId });
    try {
      await createTaskNotification({
        type: 'actionable',
        category: 'ACCOUNTING_HANDOFF_FAILED',
        userId,
        assignedBy: userId,
        title: `Vendor payment for GR ${gr.number} failed to draft`,
        message: `The automatic vendor payment for goods receipt ${gr.number} (PO ${gr.poNumber}) could not be created — create it manually in Accounting. Error: ${errorMessage}`,
        entityType: 'GOODS_RECEIPT',
        entityId: grId,
        linkUrl: `/procurement/goods-receipts/${grId}`,
        priority: 'HIGH',
        projectId: gr.projectId,
      });
    } catch (notifErr) {
      // Last resort: the notification write itself failed; the warn log above remains.
      logger.error('Failed to create ACCOUNTING_HANDOFF_FAILED notification', {
        grId,
        error: notifErr,
      });
    }
  }

  // Complete every GR_READY_FOR_PAYMENT task copy (non-critical) — the
  // clearance task fans out to all accounting users, so one user acting
  // must close the others' copies too.
  import('@/lib/tasks/taskNotificationService')
    .then(async ({ findTaskNotificationsByEntity, completeActionableTask }) => {
      const tasks = await findTaskNotificationsByEntity(
        'GOODS_RECEIPT',
        grId,
        'GR_READY_FOR_PAYMENT',
        ['pending', 'in_progress']
      );
      await Promise.all(tasks.map((task) => completeActionableTask(task.id, userId, true)));
    })
    .catch((err) => {
      logger.error('Failed to complete GR payment clearance tasks', { error: err, grId });
    });

  // Create informational notification for the inspector (non-critical)
  if (gr.inspectedBy && gr.inspectedBy !== userId) {
    createTaskNotification({
      type: 'informational',
      category: 'GR_PAYMENT_APPROVED',
      userId: gr.inspectedBy,
      assignedBy: userId,
      assignedByName: userName || userEmail,
      title: `Payment Cleared for GR ${gr.number}`,
      message: `Goods Receipt ${gr.number} (PO ${gr.poNumber}) has been cleared for payment. Vendor payment will be processed.`,
      entityType: 'GOODS_RECEIPT',
      entityId: grId,
      linkUrl: `/procurement/goods-receipts/${grId}`,
      priority: 'LOW',
      projectId: gr.projectId,
    }).catch((err) => {
      logger.error('Failed to create GR payment approved notification', { error: err, grId });
    });
  }

  logger.info('Goods Receipt approved for payment', { grId });
}

// ============================================================================
// LIST GOODS RECEIPTS
// ============================================================================

export interface ListGoodsReceiptsFilters {
  tenantId?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ISSUES_FOUND';
  purchaseOrderId?: string;
  projectId?: string;
  approvedForPayment?: boolean;
}

export async function listGoodsReceipts(
  filters: ListGoodsReceiptsFilters = {}
): Promise<GoodsReceipt[]> {
  const { db } = getFirebase();

  const constraints: ReturnType<typeof where>[] = [];

  if (filters.tenantId) {
    constraints.push(where('tenantId', '==', filters.tenantId));
  }
  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters.purchaseOrderId) {
    constraints.push(where('purchaseOrderId', '==', filters.purchaseOrderId));
  }
  if (filters.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }
  if (filters.approvedForPayment !== undefined) {
    constraints.push(where('approvedForPayment', '==', filters.approvedForPayment));
  }

  const q = query(
    collection(db, COLLECTIONS.GOODS_RECEIPTS),
    ...constraints,
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GoodsReceipt[];
}

export async function getGoodsReceiptsByPO(purchaseOrderId: string): Promise<GoodsReceipt[]> {
  return listGoodsReceipts({ purchaseOrderId });
}

// ============================================================================
// UPDATE GR METADATA (editable while GR is not COMPLETED)
// ============================================================================

export interface UpdateGoodsReceiptMetadataInput {
  inspectionType?: 'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY';
  inspectionLocation?: string;
  inspectionDate?: Date;
  overallNotes?: string;
  issuesSummary?: string;
}

/**
 * Update overall inspection metadata on a GR that hasn't been finalised yet
 * (status PENDING, IN_PROGRESS, or ISSUES_FOUND). Per-item quantities and PO
 * delivery counts are NOT touched — those stay locked once the GR is created
 * to keep the PO → GR chain consistent. Users edit line-item details before
 * finalisation by deleting the GR and re-creating, or through the existing
 * completeGR workflow.
 */
export async function updateGoodsReceiptMetadata(
  grId: string,
  input: UpdateGoodsReceiptMetadataInput,
  userId: string
): Promise<void> {
  // rule8-exempt: status comparison filters / branches on existing state to compute a derived value (no write to the status field) — not a state-machine transition
  // rule5-exempt: procurement workflow operation; firestore.rules enforce MANAGE_PROCUREMENT on the affected collections; client-side check is defense-in-depth deferred
  const { db } = getFirebase();

  const gr = await getGRById(grId);
  if (!gr) throw new Error('Goods Receipt not found');
  if (gr.status === 'COMPLETED') {
    throw new Error('Cannot edit a completed Goods Receipt');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  if (input.inspectionType !== undefined) updateData.inspectionType = input.inspectionType;
  if (input.inspectionLocation !== undefined)
    updateData.inspectionLocation = input.inspectionLocation;
  if (input.inspectionDate !== undefined) {
    updateData.inspectionDate = Timestamp.fromDate(input.inspectionDate);
  }
  if (input.overallNotes !== undefined) updateData.overallNotes = input.overallNotes;
  if (input.issuesSummary !== undefined) updateData.issuesSummary = input.issuesSummary;

  await updateDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, grId), updateData);
}
