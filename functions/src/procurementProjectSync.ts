/**
 * Procurement → Projects Status Sync Cloud Functions
 *
 * Automatically syncs procurement document status changes back to
 * project charter procurement items.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

// Collections
const PROJECTS_COLLECTION = 'projects';
const PURCHASE_ORDERS_COLLECTION = 'purchaseOrders';

/**
 * Charter procurement item status type
 */
type CharterItemStatus =
  | 'PLANNING'
  | 'PR_DRAFTED'
  | 'RFQ_ISSUED'
  | 'PO_PLACED'
  | 'DELIVERED'
  | 'CANCELLED';

/**
 * Map PO status to charter item status
 */
function mapPOStatusToCharterStatus(poStatus: string): CharterItemStatus | null {
  switch (poStatus) {
    case 'ISSUED':
    case 'ACKNOWLEDGED':
    case 'IN_PROGRESS':
      return 'PO_PLACED';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'DELIVERED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return null;
  }
}

/**
 * Update charter procurement item status in project
 */
async function updateCharterItemStatus(
  projectId: string,
  charterItemId: string | undefined,
  linkedField: 'linkedPurchaseRequestId' | 'linkedRFQId' | 'linkedPOId',
  linkedId: string,
  newStatus: CharterItemStatus
): Promise<boolean> {
  try {
    const projectRef = db.collection(PROJECTS_COLLECTION).doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      logger.warn('[updateCharterItemStatus] Project not found', { projectId });
      return false;
    }

    const projectData = projectSnap.data();
    const procurementItems = (projectData?.procurementItems || []) as Array<{
      id: string;
      status: string;
      linkedPurchaseRequestId?: string;
      linkedRFQId?: string;
      linkedPOId?: string;
      [key: string]: unknown;
    }>;

    // Find the charter item by ID or by linked document ID
    let itemIndex = -1;
    if (charterItemId) {
      itemIndex = procurementItems.findIndex((item) => item.id === charterItemId);
    }

    // If not found by charterItemId, search by linked document ID
    if (itemIndex === -1) {
      itemIndex = procurementItems.findIndex((item) => item[linkedField] === linkedId);
    }

    if (itemIndex === -1) {
      logger.info('[updateCharterItemStatus] Charter item not found', {
        projectId,
        charterItemId,
        linkedField,
        linkedId,
      });
      return false;
    }

    const item = procurementItems[itemIndex];
    if (!item) {
      return false;
    }

    // Check if status actually needs updating
    const currentStatus = item.status as CharterItemStatus;
    if (currentStatus === newStatus) {
      logger.debug('[updateCharterItemStatus] Status already up to date', {
        projectId,
        charterItemId: item.id,
        status: newStatus,
      });
      return false;
    }

    // Don't downgrade status (e.g., from DELIVERED back to PO_PLACED)
    const statusPriority: Record<CharterItemStatus, number> = {
      PLANNING: 0,
      PR_DRAFTED: 1,
      RFQ_ISSUED: 2,
      PO_PLACED: 3,
      DELIVERED: 4,
      CANCELLED: 5,
    };

    if (newStatus !== 'CANCELLED' && statusPriority[newStatus] <= statusPriority[currentStatus]) {
      logger.debug('[updateCharterItemStatus] Skipping status downgrade', {
        projectId,
        charterItemId: item.id,
        currentStatus,
        newStatus,
      });
      return false;
    }

    // Update the item
    const updatedItems = [...procurementItems];
    updatedItems[itemIndex] = {
      ...item,
      status: newStatus,
      [linkedField]: linkedId,
    };

    await projectRef.update({
      procurementItems: updatedItems,
      updatedAt: Timestamp.now(),
    });

    logger.info('[updateCharterItemStatus] Updated charter item status', {
      projectId,
      charterItemId: item.id,
      oldStatus: currentStatus,
      newStatus,
      linkedField,
      linkedId,
    });

    return true;
  } catch (error) {
    logger.error('[updateCharterItemStatus] Error:', { projectId, error });
    return false;
  }
}

/**
 * Cloud Function: Sync PO status to charter items
 *
 * When Purchase Order status changes, update the linked charter item status
 */
export const onPOStatusSyncToProject = onDocumentUpdated(
  {
    document: 'purchaseOrders/{poId}',
    region: 'us-central1',
  },
  async (event) => {
    const poId = event.params.poId;

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onPOStatusSyncToProject] Missing before/after data', { poId });
      return;
    }

    // Check if status changed
    if (before.status === after.status) {
      return;
    }

    const newStatus = after.status as string;
    const charterStatus = mapPOStatusToCharterStatus(newStatus);

    if (!charterStatus) {
      logger.debug('[onPOStatusSyncToProject] No charter status mapping for PO status', {
        poId,
        poStatus: newStatus,
      });
      return;
    }

    logger.info('[onPOStatusSyncToProject] PO status changed', {
      poId,
      poNumber: after.number,
      oldStatus: before.status,
      newStatus,
      charterStatus,
    });

    // Get project IDs from PO
    const projectIds = (after.projectIds || []) as string[];
    if (projectIds.length === 0) {
      logger.debug('[onPOStatusSyncToProject] No projectIds on PO', { poId });
      return;
    }

    // Update charter items in each linked project
    for (const projectId of projectIds) {
      try {
        await updateCharterItemStatus(
          projectId,
          after.charterItemId as string | undefined,
          'linkedPOId',
          poId,
          charterStatus
        );
      } catch (error) {
        logger.error('[onPOStatusSyncToProject] Error updating project', {
          poId,
          projectId,
          error,
        });
      }
    }
  }
);

/**
 * Cloud Function: Sync RFQ status to charter items
 *
 * When RFQ is issued, update the linked charter item status to RFQ_ISSUED
 */
export const onRFQStatusSyncToProject = onDocumentUpdated(
  {
    document: 'rfqs/{rfqId}',
    region: 'us-central1',
  },
  async (event) => {
    const rfqId = event.params.rfqId;

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onRFQStatusSyncToProject] Missing before/after data', { rfqId });
      return;
    }

    // Check if status changed to ISSUED
    if (before.status === after.status) {
      return;
    }

    const newStatus = after.status as string;

    // Only sync when RFQ is issued
    if (newStatus !== 'ISSUED') {
      return;
    }

    logger.info('[onRFQStatusSyncToProject] RFQ issued', {
      rfqId,
      rfqNumber: after.number,
      oldStatus: before.status,
      newStatus,
    });

    // Get project IDs from RFQ
    const projectIds = (after.projectIds || []) as string[];
    if (projectIds.length === 0) {
      logger.debug('[onRFQStatusSyncToProject] No projectIds on RFQ', { rfqId });
      return;
    }

    // Update charter items in each linked project
    for (const projectId of projectIds) {
      try {
        await updateCharterItemStatus(
          projectId,
          after.charterItemId as string | undefined,
          'linkedRFQId',
          rfqId,
          'RFQ_ISSUED'
        );
      } catch (error) {
        logger.error('[onRFQStatusSyncToProject] Error updating project', {
          rfqId,
          projectId,
          error,
        });
      }
    }
  }
);

/**
 * Cloud Function: Sync Goods Receipt completion to charter items
 *
 * When Goods Receipt is completed, update charter item to DELIVERED
 */
export const onGoodsReceiptSyncToProject = onDocumentUpdated(
  {
    document: 'goodsReceipts/{grId}',
    region: 'us-central1',
  },
  async (event) => {
    const grId = event.params.grId;

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('[onGoodsReceiptSyncToProject] Missing before/after data', { grId });
      return;
    }

    // Check if status changed to completed
    if (before.status === after.status) {
      return;
    }

    const newStatus = after.status as string;

    // Only sync when GR is marked as completed
    if (newStatus !== 'COMPLETED' && newStatus !== 'VERIFIED') {
      return;
    }

    logger.info('[onGoodsReceiptSyncToProject] GR completed', {
      grId,
      grNumber: after.number,
      oldStatus: before.status,
      newStatus,
    });

    // Get purchase order to find project
    const poId = after.purchaseOrderId as string;
    if (!poId) {
      logger.warn('[onGoodsReceiptSyncToProject] No purchaseOrderId on GR', { grId });
      return;
    }

    // Fetch PO to get projectIds
    const poSnap = await db.collection(PURCHASE_ORDERS_COLLECTION).doc(poId).get();
    if (!poSnap.exists) {
      logger.warn('[onGoodsReceiptSyncToProject] PO not found', { grId, poId });
      return;
    }

    const poData = poSnap.data();
    const projectIds = (poData?.projectIds || []) as string[];

    if (projectIds.length === 0) {
      logger.debug('[onGoodsReceiptSyncToProject] No projectIds on PO', { grId, poId });
      return;
    }

    // Update charter items in each linked project
    for (const projectId of projectIds) {
      try {
        await updateCharterItemStatus(
          projectId,
          poData?.charterItemId as string | undefined,
          'linkedPOId',
          poId,
          'DELIVERED'
        );
      } catch (error) {
        logger.error('[onGoodsReceiptSyncToProject] Error updating project', {
          grId,
          poId,
          projectId,
          error,
        });
      }
    }
  }
);
