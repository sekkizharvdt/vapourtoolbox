/**
 * Vendor Quote Workflow & Evaluation
 *
 * Lifecycle operations (select, reject, withdraw) and evaluation (score,
 * recommend, comparison) for vendor quotes.
 *
 * Ported from lib/procurement/offer/{workflow.ts, evaluation.ts} as part of
 * the offers → vendorQuotes unification.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { createLogger } from '@vapour/logger';
import type { CurrencyCode, RFQ, RFQItem, VendorQuote, VendorQuoteItem } from '@vapour/types';
import { requirePermission } from '@/lib/auth';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { offerStateMachine, rfqStateMachine } from '@/lib/workflow/stateMachines';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { recordProcurementPrices } from '@/lib/materials/pricing';
import { incrementOffersEvaluated } from '@/lib/procurement/rfq';
import { getQuotesByRFQ, getVendorQuoteById, getVendorQuoteItems } from './vendorQuoteService';

const logger = createLogger({ context: 'vendorQuoteWorkflow' });

// ============================================================================
// Evaluation input
// ============================================================================

export interface EvaluateVendorQuoteInput {
  evaluationScore?: number; // 0-100
  evaluationNotes?: string;
  isRecommended?: boolean;
  recommendationReason?: string;
  redFlags?: string[];
}

// ============================================================================
// Comparison data (returned by getVendorQuoteComparison)
// ============================================================================

export interface VendorQuoteItemComparison {
  rfqItemId: string;
  description: string;
  quantity: number;
  unit: string;
  offers: Array<{
    quoteId: string;
    vendorName: string;
    unitPrice: number;
    totalPrice: number;
    deliveryPeriod?: string;
    meetsSpec: boolean;
    deviations?: string;
    makeModel?: string;
  }>;
  lowestPrice: number;
}

export interface VendorQuoteComparisonStat {
  quoteId: string;
  vendorName: string;
  totalAmount: number;
  meetsAllSpecs: boolean;
  hasDeviations: boolean;
  isRecommended: boolean;
  evaluationScore?: number;
  redFlags?: string[];
}

export interface VendorQuoteComparisonData {
  rfq: RFQ | null;
  quotes: VendorQuote[];
  itemComparisons: VendorQuoteItemComparison[];
  quoteStats: VendorQuoteComparisonStat[];
  lowestTotal: number;
}

// ============================================================================
// Select — winning quote from an RFQ
// ============================================================================

/**
 * Mark a quote as SELECTED and all other live quotes for the same RFQ as
 * REJECTED. Also moves the RFQ to COMPLETED (unless it's already PO_PROCESSED).
 */
export async function selectVendorQuote(
  db: Firestore,
  quoteId: string,
  userId: string,
  userPermissions: number,
  userName?: string,
  userEmail?: string,
  completionNotes?: string
): Promise<void> {
  requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT, userId, 'select quote');

  const quote = await getVendorQuoteById(db, quoteId);
  if (!quote) throw new Error('Quote not found');
  if (!quote.rfqId) throw new Error('Only RFQ-linked quotes can be selected');

  const transition = offerStateMachine.validateTransition(quote.status, 'SELECTED');
  if (!transition.allowed) {
    throw new Error(transition.reason || `Cannot select quote with status: ${quote.status}`);
  }

  const siblings = await getQuotesByRFQ(db, quote.rfqId);
  const batch = writeBatch(db);
  const rejectedIds: string[] = [];
  const now = Timestamp.now();

  siblings.forEach((other) => {
    if (other.id === quoteId) {
      batch.update(doc(db, COLLECTIONS.VENDOR_QUOTES, other.id), {
        status: 'SELECTED',
        updatedAt: now,
        updatedBy: userId,
      });
    } else if (other.status !== 'WITHDRAWN' && other.status !== 'REJECTED') {
      batch.update(doc(db, COLLECTIONS.VENDOR_QUOTES, other.id), {
        status: 'REJECTED',
        updatedAt: now,
        updatedBy: userId,
      });
      rejectedIds.push(other.id);
    }
  });

  // Complete the RFQ — unless it's already on the PO path.
  const rfqRef = doc(db, COLLECTIONS.RFQS, quote.rfqId);
  const rfqSnap = await getDoc(rfqRef);
  const rfqStatus = rfqSnap.data()?.status;
  if (rfqStatus !== 'PO_PROCESSED') {
    requireValidTransition(rfqStateMachine, rfqStatus, 'COMPLETED', 'RFQ');
    batch.update(rfqRef, {
      status: 'COMPLETED',
      selectedOfferId: quoteId,
      completionNotes: completionNotes || `Quote ${quote.number} selected from ${quote.vendorName}`,
      completedAt: now,
      updatedAt: now,
      updatedBy: userId,
    });
  }

  await batch.commit();

  logger.info('Vendor quote selected and RFQ completed', { quoteId, rfqId: quote.rfqId });

  // Audit (fire-and-forget)
  const auditContext = createAuditContext(userId, userEmail || '', userName || '');
  logAuditEvent(
    db,
    auditContext,
    'OFFER_SELECTED',
    'OFFER',
    quoteId,
    `Selected quote ${quote.number} from ${quote.vendorName} for RFQ ${quote.rfqNumber ?? quote.rfqId}`,
    {
      entityName: quote.number,
      parentEntityType: 'RFQ',
      parentEntityId: quote.rfqId,
      metadata: {
        vendorId: quote.vendorId,
        vendorName: quote.vendorName,
        totalAmount: quote.totalAmount,
        rfqNumber: quote.rfqNumber,
        rejectedOfferCount: rejectedIds.length,
        completionNotes,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}

// ============================================================================
// Reject / Withdraw
// ============================================================================

export async function rejectVendorQuote(
  db: Firestore,
  quoteId: string,
  reason: string,
  userId: string,
  userPermissions: number,
  userName?: string,
  userEmail?: string
): Promise<void> {
  requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT, userId, 'reject quote');

  const quote = await getVendorQuoteById(db, quoteId);
  if (!quote) throw new Error('Quote not found');

  const transition = offerStateMachine.validateTransition(quote.status, 'REJECTED');
  if (!transition.allowed) {
    throw new Error(transition.reason || `Cannot reject quote with status: ${quote.status}`);
  }

  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId), {
    status: 'REJECTED',
    evaluationNotes: reason,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Vendor quote rejected', { quoteId });

  const auditContext = createAuditContext(userId, userEmail || '', userName || '');
  logAuditEvent(
    db,
    auditContext,
    'OFFER_REJECTED',
    'OFFER',
    quoteId,
    `Rejected quote ${quote.number} from ${quote.vendorName}`,
    {
      entityName: quote.number,
      parentEntityType: 'RFQ',
      parentEntityId: quote.rfqId,
      metadata: {
        vendorId: quote.vendorId,
        vendorName: quote.vendorName,
        rejectionReason: reason,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}

export async function withdrawVendorQuote(
  db: Firestore,
  quoteId: string,
  reason: string,
  userId: string,
  userPermissions: number,
  userName?: string,
  userEmail?: string
): Promise<void> {
  requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT, userId, 'withdraw quote');

  const quote = await getVendorQuoteById(db, quoteId);
  if (!quote) throw new Error('Quote not found');

  const transition = offerStateMachine.validateTransition(quote.status, 'WITHDRAWN');
  if (!transition.allowed) {
    throw new Error(transition.reason || `Cannot withdraw quote with status: ${quote.status}`);
  }

  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId), {
    status: 'WITHDRAWN',
    evaluationNotes: reason,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Vendor quote withdrawn', { quoteId });

  const auditContext = createAuditContext(userId, userEmail || '', userName || '');
  logAuditEvent(
    db,
    auditContext,
    'OFFER_WITHDRAWN',
    'OFFER',
    quoteId,
    `Withdrew quote ${quote.number} from ${quote.vendorName}`,
    {
      entityName: quote.number,
      parentEntityType: 'RFQ',
      parentEntityId: quote.rfqId,
      metadata: {
        vendorId: quote.vendorId,
        vendorName: quote.vendorName,
        withdrawalReason: reason,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}

// ============================================================================
// Evaluate / Recommend
// ============================================================================

export async function evaluateVendorQuote(
  db: Firestore,
  quoteId: string,
  input: EvaluateVendorQuoteInput,
  userId: string,
  userName: string
): Promise<void> {
  const quote = await getVendorQuoteById(db, quoteId);
  if (!quote) throw new Error('Quote not found');

  const updateData: Record<string, unknown> = {
    status: 'EVALUATED',
    evaluationScore: input.evaluationScore,
    isRecommended: input.isRecommended || false,
    redFlags: input.redFlags || [],
    evaluatedBy: userId,
    evaluatedByName: userName,
    evaluatedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  if (input.evaluationNotes !== undefined) updateData.evaluationNotes = input.evaluationNotes;
  if (input.recommendationReason !== undefined) {
    updateData.recommendationReason = input.recommendationReason;
  }

  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId), updateData);

  // Update RFQ evaluated counter (tolerant — don't fail the evaluation if this breaks).
  if (quote.rfqId) {
    try {
      await incrementOffersEvaluated(quote.rfqId);
    } catch (err) {
      logger.error('Failed to increment RFQ evaluations count', {
        rfqId: quote.rfqId,
        error: err,
      });
    }
  }

  // Record budgetary prices to the material database (fire-and-forget).
  // Only meaningful for quotes with a linked vendor entity — unsolicited
  // / offline quotes from un-registered vendors skip the price feedback loop.
  if (quote.vendorId) {
    const linkedVendorId = quote.vendorId;
    getVendorQuoteItems(db, quoteId)
      .then((items) =>
        recordProcurementPrices(
          db,
          items.map((i) => ({ materialId: i.materialId, unitPrice: i.unitPrice, unit: i.unit })),
          linkedVendorId,
          quote.vendorName,
          `${quote.number} (${quote.vendorName})`,
          (quote.currency as CurrencyCode) || 'INR',
          'budgetary',
          userId
        )
      )
      .catch((err) => logger.error('Failed to record budgetary prices', { quoteId, error: err }));
  }

  logger.info('Vendor quote evaluated', { quoteId });
}

export async function markVendorQuoteAsRecommended(
  db: Firestore,
  quoteId: string,
  reason: string,
  userId: string
): Promise<void> {
  const quote = await getVendorQuoteById(db, quoteId);
  if (!quote) throw new Error('Quote not found');
  if (!quote.rfqId) {
    throw new Error('Recommendation only applies to RFQ-linked quotes');
  }

  const siblings = await getQuotesByRFQ(db, quote.rfqId);
  const batch = writeBatch(db);
  const now = Timestamp.now();

  siblings.forEach((other) => {
    if (other.id !== quoteId && other.isRecommended) {
      batch.update(doc(db, COLLECTIONS.VENDOR_QUOTES, other.id), {
        isRecommended: false,
        updatedAt: now,
        updatedBy: userId,
      });
    }
  });

  batch.update(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId), {
    isRecommended: true,
    recommendationReason: reason,
    updatedAt: now,
    updatedBy: userId,
  });

  await batch.commit();
  logger.info('Vendor quote marked as recommended', { quoteId });
}

// ============================================================================
// Comparison
// ============================================================================

async function getVendorQuoteItemsBatch(
  db: Firestore,
  quoteIds: string[]
): Promise<Map<string, VendorQuoteItem[]>> {
  const map = new Map<string, VendorQuoteItem[]>();
  // Firestore `in` filter allows max 30 values per query in the latest SDK,
  // but to keep this safe we batch by 10.
  const chunkSize = 10;
  for (let i = 0; i < quoteIds.length; i += chunkSize) {
    const chunk = quoteIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.VENDOR_QUOTE_ITEMS),
        where('quoteId', 'in', chunk),
        orderBy('lineNumber', 'asc')
      )
    );
    snap.docs.forEach((d) => {
      const item: VendorQuoteItem = {
        id: d.id,
        ...(d.data() as Omit<VendorQuoteItem, 'id'>),
      };
      const bucket = map.get(item.quoteId) ?? [];
      bucket.push(item);
      map.set(item.quoteId, bucket);
    });
  }
  return map;
}

export async function getVendorQuoteComparison(
  db: Firestore,
  rfqId: string
): Promise<VendorQuoteComparisonData> {
  const [rfq, quotes] = await Promise.all([
    (async () => {
      const snap = await getDoc(doc(db, COLLECTIONS.RFQS, rfqId));
      if (!snap.exists()) return null;
      const rfqDoc: RFQ = { id: snap.id, ...(snap.data() as Omit<RFQ, 'id'>) };
      return rfqDoc;
    })(),
    getQuotesByRFQ(db, rfqId),
  ]);

  if (!rfq) throw new Error('RFQ not found');

  const itemsMap = await getVendorQuoteItemsBatch(
    db,
    quotes.map((q) => q.id)
  );

  const quotesWithItems = quotes.map((quote) => ({
    quote,
    items: itemsMap.get(quote.id) || [],
  }));

  // Fetch RFQ line items for the comparison rows.
  const rfqItemsSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.RFQ_ITEMS),
      where('rfqId', '==', rfqId),
      orderBy('lineNumber', 'asc')
    )
  );
  const rfqItems = rfqItemsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as RFQItem[];

  const itemComparisons: VendorQuoteItemComparison[] = rfqItems.map((rfqItem) => {
    const itemOffers = quotesWithItems.map(({ quote, items }) => {
      const match = items.find((i) => i.rfqItemId === rfqItem.id);
      return {
        quoteId: quote.id,
        vendorName: quote.vendorName,
        unitPrice: match?.unitPrice || 0,
        totalPrice: match?.amount || 0,
        deliveryPeriod: match?.deliveryPeriod,
        meetsSpec: match?.meetsSpec || false,
        deviations: match?.deviations,
        makeModel: match?.makeModel,
      };
    });

    const validPrices = itemOffers.filter((o) => o.unitPrice > 0).map((o) => o.unitPrice);
    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

    return {
      rfqItemId: rfqItem.id,
      description: rfqItem.description,
      quantity: rfqItem.quantity,
      unit: rfqItem.unit,
      offers: itemOffers,
      lowestPrice,
    };
  });

  const quoteStats: VendorQuoteComparisonStat[] = quotes.map((quote) => {
    const items = quotesWithItems.find((q) => q.quote.id === quote.id)?.items || [];
    return {
      quoteId: quote.id,
      vendorName: quote.vendorName,
      totalAmount: quote.totalAmount,
      meetsAllSpecs: items.every((i) => i.meetsSpec),
      hasDeviations: items.some((i) => !!i.deviations),
      isRecommended: quote.isRecommended,
      evaluationScore: quote.evaluationScore,
      redFlags: quote.redFlags,
    };
  });

  const lowestTotal = quoteStats.length > 0 ? Math.min(...quoteStats.map((s) => s.totalAmount)) : 0;

  return {
    rfq,
    quotes,
    itemComparisons,
    quoteStats,
    lowestTotal,
  };
}
