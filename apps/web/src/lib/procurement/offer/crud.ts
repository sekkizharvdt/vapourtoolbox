/**
 * Offer CRUD Operations
 *
 * Create, read, and update operations for offers
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
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Offer, OfferItem } from '@vapour/types';
import type { CreateOfferInput, CreateOfferItemInput, UpdateOfferInput } from './types';
import { generateOfferNumber } from './utils';
import { incrementOffersReceived } from '../rfq';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'offerService' });

/**
 * Create a new Offer
 */
export async function createOffer(
  input: CreateOfferInput,
  items: CreateOfferItemInput[],
  userId: string,
  userName: string,
  userEmail?: string
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

  // Create offer document - build with only defined fields to prevent Firestore errors
  const offerData: Record<string, unknown> = {
    // Required fields
    number: offerNumber,
    rfqId: input.rfqId,
    rfqNumber: input.rfqNumber,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    offerFileUrl: input.offerFileUrl,
    additionalDocuments: input.additionalDocuments || [],
    itemsParsed: items.length > 0,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    totalAmount: input.totalAmount,
    currency: input.currency || 'INR',
    status: 'UPLOADED',
    isRecommended: false,
    uploadedBy: userId,
    uploadedByName: userName,
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  // Add optional fields only if they have values (Firestore doesn't accept undefined)
  if (input.paymentTerms) offerData.paymentTerms = input.paymentTerms;
  if (input.deliveryTerms) offerData.deliveryTerms = input.deliveryTerms;
  if (input.vendorOfferNumber) offerData.vendorOfferNumber = input.vendorOfferNumber;
  if (input.vendorOfferDate) offerData.vendorOfferDate = Timestamp.fromDate(input.vendorOfferDate);
  if (input.validityDate) offerData.validityDate = Timestamp.fromDate(input.validityDate);
  if (input.warrantyTerms) offerData.warrantyTerms = input.warrantyTerms;
  if (input.exWorks) offerData.exWorks = input.exWorks;
  if (input.transportation) offerData.transportation = input.transportation;
  if (input.packingForwarding) offerData.packingForwarding = input.packingForwarding;
  if (input.insurance) offerData.insurance = input.insurance;
  if (input.erectionAfterPurchase) offerData.erectionAfterPurchase = input.erectionAfterPurchase;

  const offerRef = await addDoc(collection(db, COLLECTIONS.OFFERS), offerData);

  // Create offer items
  const batch = writeBatch(db);

  items.forEach((item, index) => {
    const amount = item.unitPrice * item.quotedQuantity;
    const gstAmount = item.gstRate ? (amount * item.gstRate) / 100 : 0;

    // Build offer item with only defined fields to prevent Firestore errors
    const itemData: Record<string, unknown> = {
      offerId: offerRef.id,
      rfqItemId: item.rfqItemId,
      lineNumber: index + 1,
      description: item.description,
      quotedQuantity: item.quotedQuantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      amount,
      gstAmount,
      createdAt: now,
      updatedAt: now,
    };

    // Add optional fields only if they have values
    if (item.gstRate !== undefined) itemData.gstRate = item.gstRate;
    if (item.deliveryPeriod) itemData.deliveryPeriod = item.deliveryPeriod;
    if (item.deliveryDate) itemData.deliveryDate = Timestamp.fromDate(item.deliveryDate);
    if (item.makeModel) itemData.makeModel = item.makeModel;
    if (item.meetsSpec !== undefined) itemData.meetsSpec = item.meetsSpec;
    if (item.deviations) itemData.deviations = item.deviations;
    if (item.vendorNotes) itemData.vendorNotes = item.vendorNotes;

    const itemRef = doc(collection(db, COLLECTIONS.OFFER_ITEMS));
    batch.set(itemRef, itemData);
  });

  await batch.commit();

  // Update RFQ offers received count and send task notification
  try {
    await incrementOffersReceived(input.rfqId, input.vendorName);
  } catch (err) {
    logger.error('Failed to increment RFQ offers count', { error: err, rfqId: input.rfqId });
    // Don't fail offer creation if counter update fails
    // This is a non-critical update that can be manually corrected
  }

  logger.info('Offer created', { offerId: offerRef.id, offerNumber });

  // Log audit event (fire-and-forget)
  const auditContext = createAuditContext(userId, userEmail || '', userName);
  logAuditEvent(
    db,
    auditContext,
    'OFFER_CREATED',
    'OFFER',
    offerRef.id,
    `Created offer ${offerNumber} from ${input.vendorName} for RFQ ${input.rfqNumber}`,
    {
      entityName: offerNumber,
      parentEntityType: 'RFQ',
      parentEntityId: input.rfqId,
      metadata: {
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        totalAmount: input.totalAmount,
        currency: input.currency || 'INR',
        itemCount: items.length,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));

  return offerRef.id;
}

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
 * Get offer items for multiple offers in a single batch query (avoid N+1 queries)
 * Uses Firestore 'in' query with batching for offers > 30
 */
export async function getOfferItemsBatch(offerIds: string[]): Promise<Map<string, OfferItem[]>> {
  const { db } = getFirebase();

  if (offerIds.length === 0) {
    return new Map();
  }

  const result = new Map<string, OfferItem[]>();

  // Initialize empty arrays for all offer IDs
  offerIds.forEach((id) => result.set(id, []));

  // Batch query in chunks of 30 (Firestore 'in' limit)
  const batchSize = 30;
  const batches = await Promise.all(
    Array.from({ length: Math.ceil(offerIds.length / batchSize) }, (_, i) => {
      const batchIds = offerIds.slice(i * batchSize, (i + 1) * batchSize);
      return getDocs(
        query(
          collection(db, COLLECTIONS.OFFER_ITEMS),
          where('offerId', 'in', batchIds),
          orderBy('lineNumber', 'asc')
        )
      );
    })
  );

  // Group items by offerId
  for (const snapshot of batches) {
    for (const docSnap of snapshot.docs) {
      const item = { id: docSnap.id, ...docSnap.data() } as OfferItem;
      const items = result.get(item.offerId) || [];
      items.push(item);
      result.set(item.offerId, items);
    }
  }

  return result;
}

/**
 * Update offer details
 */
export async function updateOffer(
  offerId: string,
  input: UpdateOfferInput,
  userId: string,
  userName?: string,
  userEmail?: string
): Promise<void> {
  const { db } = getFirebase();

  // Get existing offer for audit trail
  const existingOffer = await getOfferById(offerId);
  if (!existingOffer) {
    throw new Error('Offer not found');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
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
  if (input.exWorks !== undefined) updateData.exWorks = input.exWorks;
  if (input.transportation !== undefined) updateData.transportation = input.transportation;
  if (input.packingForwarding !== undefined) updateData.packingForwarding = input.packingForwarding;
  if (input.insurance !== undefined) updateData.insurance = input.insurance;
  if (input.erectionAfterPurchase !== undefined)
    updateData.erectionAfterPurchase = input.erectionAfterPurchase;

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), updateData);

  logger.info('Offer updated', { offerId });

  // Log audit event (fire-and-forget)
  const auditContext = createAuditContext(userId, userEmail || '', userName || '');
  logAuditEvent(
    db,
    auditContext,
    'OFFER_UPDATED',
    'OFFER',
    offerId,
    `Updated offer ${existingOffer.number}`,
    {
      entityName: existingOffer.number,
      parentEntityType: 'RFQ',
      parentEntityId: existingOffer.rfqId,
      metadata: {
        updatedFields: Object.keys(input).filter(
          (k) => input[k as keyof UpdateOfferInput] !== undefined
        ),
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}
