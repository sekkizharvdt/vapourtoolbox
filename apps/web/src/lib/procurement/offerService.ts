/**
 * Offer Service
 *
 * Handles vendor quotation/offer operations:
 * - Upload offer documents
 * - Create offer with line items
 * - Evaluate offers
 * - Compare offers
 * - Select winning offer
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
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  Offer,
  OfferItem,
  OfferStatus,
  RFQ,
  RFQItem,
  OfferComparisonData,
} from '@vapour/types';
import { incrementOffersReceived, incrementOffersEvaluated } from './rfqService';

// ============================================================================
// OFFER NUMBER GENERATION
// ============================================================================

/**
 * Generate Offer number in format: OFFER/YYYY/MM/XXXX
 */
async function generateOfferNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

  const q = query(
    collection(db, COLLECTIONS.OFFERS),
    where('createdAt', '>=', Timestamp.fromDate(monthStart)),
    where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let sequence = 1;
  if (!snapshot.empty && snapshot.docs[0]) {
    const lastOffer = snapshot.docs[0].data() as Offer;
    const lastNumber = lastOffer.number;
    const parts = lastNumber.split('/');
    const lastSequenceStr = parts[parts.length - 1];
    const lastSequence = parseInt(lastSequenceStr || '0', 10);
    sequence = lastSequence + 1;
  }

  const sequenceStr = String(sequence).padStart(4, '0');
  return `OFFER/${year}/${month}/${sequenceStr}`;
}

// ============================================================================
// CREATE OFFER
// ============================================================================

export interface CreateOfferInput {
  // RFQ reference
  rfqId: string;
  rfqNumber: string;

  // Vendor
  vendorId: string;
  vendorName: string;

  // Vendor offer details
  vendorOfferNumber?: string;
  vendorOfferDate?: Date;

  // Documents
  offerFileUrl: string;
  additionalDocuments?: string[];

  // Financial summary
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency?: string;

  // Terms
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDate?: Date;
  warrantyTerms?: string;
}

export interface CreateOfferItemInput {
  // RFQ item reference
  rfqItemId: string;

  // Item details
  description: string;

  // Quoted quantity and pricing
  quotedQuantity: number;
  unit: string;
  unitPrice: number;

  // Tax
  gstRate?: number;

  // Delivery
  deliveryPeriod?: string;
  deliveryDate?: Date;

  // Make/model offered
  makeModel?: string;

  // Compliance
  meetsSpec: boolean;
  deviations?: string;

  // Notes
  vendorNotes?: string;
}

/**
 * Create a new Offer
 */
export async function createOffer(
  input: CreateOfferInput,
  items: CreateOfferItemInput[],
  userId: string,
  userName: string
): Promise<string> {
  const { db } = getFirebase();

  // Validate input
  if (!input.rfqId?.trim()) {
    throw new Error('RFQ ID is required');
  }

  if (!input.vendorId?.trim()) {
    throw new Error('Vendor ID is required');
  }

  if (!input.vendorName?.trim()) {
    throw new Error('Vendor name is required');
  }

  if (items.length === 0) {
    throw new Error('At least one item is required');
  }

  // Validate amounts are non-negative
  if (input.subtotal < 0 || input.taxAmount < 0 || input.totalAmount < 0) {
    throw new Error('Amounts cannot be negative');
  }

  // Validate items
  items.forEach((item, index) => {
    if (item.quotedQuantity <= 0) {
      throw new Error(`Item ${index + 1}: Quoted quantity must be greater than 0`);
    }
    if (item.unitPrice < 0) {
      throw new Error(`Item ${index + 1}: Unit price cannot be negative`);
    }
  });

  const offerNumber = await generateOfferNumber();
  const now = Timestamp.now();

  // Create offer document
  const offerData: Omit<Offer, 'id'> = {
    number: offerNumber,
    rfqId: input.rfqId,
    rfqNumber: input.rfqNumber,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    vendorOfferNumber: input.vendorOfferNumber,
    vendorOfferDate: input.vendorOfferDate ? Timestamp.fromDate(input.vendorOfferDate) : undefined,
    offerFileUrl: input.offerFileUrl,
    additionalDocuments: input.additionalDocuments || [],
    itemsParsed: items.length > 0,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    totalAmount: input.totalAmount,
    currency: input.currency || 'INR',
    paymentTerms: input.paymentTerms,
    deliveryTerms: input.deliveryTerms,
    validityDate: input.validityDate ? Timestamp.fromDate(input.validityDate) : undefined,
    warrantyTerms: input.warrantyTerms,
    status: 'UPLOADED',
    isRecommended: false,
    uploadedBy: userId,
    uploadedByName: userName,
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const offerRef = await addDoc(collection(db, COLLECTIONS.OFFERS), offerData);

  // Create offer items
  const batch = writeBatch(db);

  items.forEach((item, index) => {
    const amount = item.unitPrice * item.quotedQuantity;
    const gstAmount = item.gstRate ? (amount * item.gstRate) / 100 : 0;

    const itemData: Omit<OfferItem, 'id'> = {
      offerId: offerRef.id,
      rfqItemId: item.rfqItemId,
      lineNumber: index + 1,
      description: item.description,
      quotedQuantity: item.quotedQuantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      amount,
      gstRate: item.gstRate,
      gstAmount,
      deliveryPeriod: item.deliveryPeriod,
      deliveryDate: item.deliveryDate ? Timestamp.fromDate(item.deliveryDate) : undefined,
      makeModel: item.makeModel,
      meetsSpec: item.meetsSpec,
      deviations: item.deviations,
      vendorNotes: item.vendorNotes,
      createdAt: now,
      updatedAt: now,
    };

    const itemRef = doc(collection(db, COLLECTIONS.OFFER_ITEMS));
    batch.set(itemRef, itemData);
  });

  await batch.commit();

  // Update RFQ offers received count
  try {
    await incrementOffersReceived(input.rfqId);
  } catch (err) {
    console.error('[offerService] Failed to increment RFQ offers count:', err);
    // Don't fail offer creation if counter update fails
    // This is a non-critical update that can be manually corrected
  }

  console.warn('[offerService] Offer created:', offerRef.id, offerNumber);

  return offerRef.id;
}

// ============================================================================
// READ OFFER
// ============================================================================

/**
 * Get Offer by ID
 */
export async function getOfferById(offerId: string): Promise<Offer | null> {
  const { db } = getFirebase();

  const offerDoc = await getDoc(doc(db, COLLECTIONS.OFFERS, offerId));

  if (!offerDoc.exists()) {
    return null;
  }

  return { id: offerDoc.id, ...offerDoc.data() } as Offer;
}

/**
 * Get Offer items
 */
export async function getOfferItems(offerId: string): Promise<OfferItem[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.OFFER_ITEMS),
    where('offerId', '==', offerId),
    orderBy('lineNumber', 'asc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as OfferItem[];
}

/**
 * Get all offers for an RFQ
 */
export async function getOffersByRFQ(rfqId: string): Promise<Offer[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.OFFERS),
    where('rfqId', '==', rfqId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Offer[];
}

/**
 * List offers with optional filters
 */
export interface ListOffersFilters {
  rfqId?: string;
  vendorId?: string;
  status?: OfferStatus;
  isRecommended?: boolean;
  limit?: number;
}

export async function listOffers(filters: ListOffersFilters = {}): Promise<Offer[]> {
  const { db } = getFirebase();

  const constraints: QueryConstraint[] = [];

  if (filters.rfqId) {
    constraints.push(where('rfqId', '==', filters.rfqId));
  }

  if (filters.vendorId) {
    constraints.push(where('vendorId', '==', filters.vendorId));
  }

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.isRecommended !== undefined) {
    constraints.push(where('isRecommended', '==', filters.isRecommended));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, COLLECTIONS.OFFERS), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Offer[];
}

// ============================================================================
// UPDATE OFFER
// ============================================================================

export interface UpdateOfferInput {
  vendorOfferNumber?: string;
  vendorOfferDate?: Date;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDate?: Date;
  warrantyTerms?: string;
}

/**
 * Update offer details
 */
export async function updateOffer(
  offerId: string,
  input: UpdateOfferInput,
  _userId: string
): Promise<void> {
  const { db } = getFirebase();

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (input.vendorOfferNumber !== undefined) updateData.vendorOfferNumber = input.vendorOfferNumber;
  if (input.vendorOfferDate !== undefined)
    updateData.vendorOfferDate = Timestamp.fromDate(input.vendorOfferDate);
  if (input.subtotal !== undefined) updateData.subtotal = input.subtotal;
  if (input.taxAmount !== undefined) updateData.taxAmount = input.taxAmount;
  if (input.totalAmount !== undefined) updateData.totalAmount = input.totalAmount;
  if (input.paymentTerms !== undefined) updateData.paymentTerms = input.paymentTerms;
  if (input.deliveryTerms !== undefined) updateData.deliveryTerms = input.deliveryTerms;
  if (input.validityDate !== undefined)
    updateData.validityDate = Timestamp.fromDate(input.validityDate);
  if (input.warrantyTerms !== undefined) updateData.warrantyTerms = input.warrantyTerms;

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), updateData);

  console.warn('[offerService] Offer updated:', offerId);
}

// ============================================================================
// OFFER EVALUATION
// ============================================================================

export interface EvaluateOfferInput {
  evaluationScore?: number; // 0-100
  evaluationNotes?: string;
  isRecommended?: boolean;
  recommendationReason?: string;
  redFlags?: string[];
}

/**
 * Evaluate an offer
 */
export async function evaluateOffer(
  offerId: string,
  input: EvaluateOfferInput,
  userId: string,
  userName: string
): Promise<void> {
  const { db } = getFirebase();

  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  const updateData: Record<string, unknown> = {
    status: 'EVALUATED',
    evaluationScore: input.evaluationScore,
    evaluationNotes: input.evaluationNotes,
    isRecommended: input.isRecommended || false,
    recommendationReason: input.recommendationReason,
    redFlags: input.redFlags || [],
    evaluatedBy: userId,
    evaluatedByName: userName,
    evaluatedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), updateData);

  // Update RFQ offers evaluated count
  try {
    await incrementOffersEvaluated(offer.rfqId);
  } catch (err) {
    console.error('[offerService] Failed to increment RFQ evaluations count:', err);
    // Don't fail offer evaluation if counter update fails
  }

  console.warn('[offerService] Offer evaluated:', offerId);
}

/**
 * Mark offer as recommended
 */
export async function markOfferAsRecommended(
  offerId: string,
  reason: string,
  _userId: string
): Promise<void> {
  const { db } = getFirebase();

  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  // Unmark other offers for this RFQ
  const otherOffers = await getOffersByRFQ(offer.rfqId);
  const batch = writeBatch(db);

  otherOffers.forEach((other) => {
    if (other.id !== offerId && other.isRecommended) {
      batch.update(doc(db, COLLECTIONS.OFFERS, other.id), {
        isRecommended: false,
        updatedAt: Timestamp.now(),
      });
    }
  });

  // Mark this offer as recommended
  batch.update(doc(db, COLLECTIONS.OFFERS, offerId), {
    isRecommended: true,
    recommendationReason: reason,
    updatedAt: Timestamp.now(),
  });

  await batch.commit();

  console.warn('[offerService] Offer marked as recommended:', offerId);
}

/**
 * Select winning offer (changes status to SELECTED)
 */
export async function selectOffer(
  offerId: string,
  userId: string,
  completionNotes?: string
): Promise<void> {
  const { db } = getFirebase();

  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  // Mark other offers as rejected
  const allOffers = await getOffersByRFQ(offer.rfqId);
  const batch = writeBatch(db);

  allOffers.forEach((other) => {
    if (other.id === offerId) {
      batch.update(doc(db, COLLECTIONS.OFFERS, other.id), {
        status: 'SELECTED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    } else if (other.status !== 'WITHDRAWN' && other.status !== 'REJECTED') {
      batch.update(doc(db, COLLECTIONS.OFFERS, other.id), {
        status: 'REJECTED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    }
  });

  // Complete the RFQ with the selected offer
  batch.update(doc(db, COLLECTIONS.RFQS, offer.rfqId), {
    status: 'COMPLETED',
    selectedOfferId: offerId,
    completionNotes: completionNotes || `Offer ${offer.number} selected from ${offer.vendorName}`,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  await batch.commit();

  console.warn('[offerService] Offer selected and RFQ completed:', offerId, offer.rfqId);
}

/**
 * Reject an offer
 */
export async function rejectOffer(offerId: string, reason: string, _userId: string): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), {
    status: 'REJECTED',
    evaluationNotes: reason,
    updatedAt: Timestamp.now(),
  });

  console.warn('[offerService] Offer rejected:', offerId);
}

/**
 * Withdraw an offer
 */
export async function withdrawOffer(
  offerId: string,
  reason: string,
  _userId: string
): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), {
    status: 'WITHDRAWN',
    evaluationNotes: reason,
    updatedAt: Timestamp.now(),
  });

  console.warn('[offerService] Offer withdrawn:', offerId);
}

// ============================================================================
// OFFER COMPARISON
// ============================================================================

/**
 * Get offer comparison data for an RFQ
 */
export async function getOfferComparison(rfqId: string): Promise<OfferComparisonData> {
  const { db } = getFirebase();

  // Get RFQ and all its offers
  const [rfq, offers] = await Promise.all([
    (async () => {
      const rfqDoc = await getDoc(doc(db, COLLECTIONS.RFQS, rfqId));
      return rfqDoc.exists() ? ({ id: rfqDoc.id, ...rfqDoc.data() } as RFQ) : null;
    })(),
    getOffersByRFQ(rfqId),
  ]);

  if (!rfq) {
    throw new Error('RFQ not found');
  }

  // Get all offer items for each offer
  const offersWithItems = await Promise.all(
    offers.map(async (offer) => {
      const items = await getOfferItems(offer.id);
      return { offer, items };
    })
  );

  // Get RFQ items
  const rfqItemsQuery = query(
    collection(db, COLLECTIONS.RFQ_ITEMS),
    where('rfqId', '==', rfqId),
    orderBy('lineNumber', 'asc')
  );
  const rfqItemsSnapshot = await getDocs(rfqItemsQuery);
  const rfqItems = rfqItemsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RFQItem[];

  // Build comparison matrix
  const itemComparisons = rfqItems.map((rfqItem) => {
    const itemOffers = offersWithItems.map(({ offer, items }) => {
      const matchingItem = items.find((item) => item.rfqItemId === rfqItem.id);

      return {
        offerId: offer.id,
        vendorName: offer.vendorName,
        unitPrice: matchingItem?.unitPrice || 0,
        totalPrice: matchingItem?.amount || 0,
        deliveryPeriod: matchingItem?.deliveryPeriod,
        meetsSpec: matchingItem?.meetsSpec || false,
        deviations: matchingItem?.deviations,
        makeModel: matchingItem?.makeModel,
      };
    });

    // Find lowest price
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

  // Calculate totals and stats
  const offerStats = offers.map((offer) => {
    const itemsForOffer = offersWithItems.find((o) => o.offer.id === offer.id)?.items || [];

    const meetsAllSpecs = itemsForOffer.every((item) => item.meetsSpec);
    const hasDeviations = itemsForOffer.some((item) => item.deviations);

    return {
      offerId: offer.id,
      vendorName: offer.vendorName,
      totalAmount: offer.totalAmount,
      meetsAllSpecs,
      hasDeviations,
      isRecommended: offer.isRecommended,
      evaluationScore: offer.evaluationScore,
      redFlags: offer.redFlags,
    };
  });

  // Find lowest total
  const lowestTotal = offerStats.length > 0 ? Math.min(...offerStats.map((s) => s.totalAmount)) : 0;

  return {
    rfq,
    offers,
    itemComparisons,
    offerStats,
    lowestTotal,
  };
}
