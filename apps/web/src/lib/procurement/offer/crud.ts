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

const logger = createLogger({ context: 'offerService' });

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

  // Update RFQ offers received count and send task notification
  try {
    await incrementOffersReceived(input.rfqId, input.vendorName);
  } catch (err) {
    console.error('[offerService] Failed to increment RFQ offers count:', err);
    // Don't fail offer creation if counter update fails
    // This is a non-critical update that can be manually corrected
  }

  logger.info('Offer created', { offerId: offerRef.id, offerNumber });

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

  logger.info('Offer updated', { offerId });
}
