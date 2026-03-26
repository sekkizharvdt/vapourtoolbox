/**
 * Vendor Offer Service
 *
 * CRUD operations for vendor offers and their line items.
 * Supports price acceptance to push quoted prices to the material database.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { createLogger } from '@vapour/logger';
import type {
  VendorOffer,
  VendorOfferItem,
  VendorOfferStatus,
  OfferItemType,
  CurrencyCode,
} from '@vapour/types';
import { requirePermission } from '@/lib/auth';
import { addMaterialPrice } from '@/lib/materials/pricing';

const logger = createLogger({ context: 'vendorOfferService' });

// ============================================================================
// Number Generation
// ============================================================================

async function generateOfferNumber(db: Firestore): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VO-${year}-`;

  const q = query(
    collection(db, COLLECTIONS.VENDOR_OFFERS),
    where('offerNumber', '>=', prefix),
    where('offerNumber', '<', `VO-${year + 1}-`),
    orderBy('offerNumber', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let nextNumber = 1;
  if (!snapshot.empty) {
    const docData = snapshot.docs[0]?.data();
    if (docData && typeof docData.offerNumber === 'string') {
      const lastCode = docData.offerNumber;
      const parts = lastCode.split('-');
      if (parts.length >= 3) {
        const lastNumber = parseInt(parts[2] || '0', 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// ============================================================================
// Vendor Offer CRUD
// ============================================================================

export interface CreateVendorOfferInput {
  vendorId?: string;
  vendorName: string;
  offerDate?: Date;
  validityDate?: Date;
  currency?: CurrencyCode;
  remarks?: string;
  fileUrl?: string;
  fileName?: string;
}

export async function createVendorOffer(
  db: Firestore,
  input: CreateVendorOfferInput,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<VendorOffer> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ESTIMATION,
    userId,
    'create vendor offer'
  );

  const offerNumber = await generateOfferNumber(db);
  const now = Timestamp.now();

  const offerData: Record<string, unknown> = {
    offerNumber,
    vendorName: input.vendorName,
    currency: input.currency ?? 'INR',
    totalAmount: 0,
    itemCount: 0,
    acceptedCount: 0,
    status: 'DRAFT',
    isActive: true,
    createdAt: now,
    createdBy: userId,
    createdByName: userName,
    updatedAt: now,
    updatedBy: userId,
    ...(input.vendorId !== undefined && { vendorId: input.vendorId }),
    ...(input.offerDate !== undefined && { offerDate: Timestamp.fromDate(input.offerDate) }),
    ...(input.validityDate !== undefined && {
      validityDate: Timestamp.fromDate(input.validityDate),
    }),
    ...(input.remarks !== undefined && { remarks: input.remarks }),
    ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
    ...(input.fileName !== undefined && { fileName: input.fileName }),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.VENDOR_OFFERS), offerData);

  logger.info('Vendor offer created', { offerId: docRef.id, offerNumber });

  return { id: docRef.id, ...(offerData as Omit<VendorOffer, 'id'>) };
}

export async function getVendorOfferById(
  db: Firestore,
  offerId: string
): Promise<VendorOffer | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.VENDOR_OFFERS, offerId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<VendorOffer, 'id'>) };
}

export interface ListVendorOffersOptions {
  vendorId?: string;
  status?: VendorOfferStatus;
}

export async function listVendorOffers(
  db: Firestore,
  options: ListVendorOffersOptions = {}
): Promise<VendorOffer[]> {
  let q = query(
    collection(db, COLLECTIONS.VENDOR_OFFERS),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );

  if (options.vendorId) {
    q = query(
      collection(db, COLLECTIONS.VENDOR_OFFERS),
      where('isActive', '==', true),
      where('vendorId', '==', options.vendorId),
      orderBy('createdAt', 'desc')
    );
  }

  const snapshot = await getDocs(q);
  let offers = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VendorOffer, 'id'>) }));

  if (options.status) {
    offers = offers.filter((o) => o.status === options.status);
  }

  return offers;
}

export async function updateVendorOffer(
  db: Firestore,
  offerId: string,
  updates: Partial<
    Pick<
      VendorOffer,
      'vendorId' | 'vendorName' | 'remarks' | 'currency' | 'status' | 'fileUrl' | 'fileName'
    >
  > & {
    offerDate?: Date;
    validityDate?: Date;
  },
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ESTIMATION,
    userId,
    'update vendor offer'
  );

  const data: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  if (updates.vendorId !== undefined) data.vendorId = updates.vendorId;
  if (updates.vendorName !== undefined) data.vendorName = updates.vendorName;
  if (updates.remarks !== undefined) data.remarks = updates.remarks;
  if (updates.currency !== undefined) data.currency = updates.currency;
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.fileUrl !== undefined) data.fileUrl = updates.fileUrl;
  if (updates.fileName !== undefined) data.fileName = updates.fileName;
  if (updates.offerDate !== undefined) data.offerDate = Timestamp.fromDate(updates.offerDate);
  if (updates.validityDate !== undefined)
    data.validityDate = Timestamp.fromDate(updates.validityDate);

  await updateDoc(doc(db, COLLECTIONS.VENDOR_OFFERS, offerId), data);

  logger.info('Vendor offer updated', { offerId });
}

export async function deleteVendorOffer(
  db: Firestore,
  offerId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ESTIMATION,
    userId,
    'delete vendor offer'
  );

  await updateDoc(doc(db, COLLECTIONS.VENDOR_OFFERS, offerId), {
    isActive: false,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Vendor offer soft-deleted', { offerId });
}

// ============================================================================
// Vendor Offer Items
// ============================================================================

export interface CreateOfferItemInput {
  itemType: OfferItemType;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate?: number;
  notes?: string;
  materialId?: string;
  serviceId?: string;
  boughtOutItemId?: string;
  linkedItemName?: string;
  linkedItemCode?: string;
}

export async function addOfferItem(
  db: Firestore,
  offerId: string,
  input: CreateOfferItemInput,
  userId: string,
  userPermissions: number
): Promise<VendorOfferItem> {
  requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_ESTIMATION, userId, 'add offer item');

  // Get current item count for line number
  const existingItems = await getOfferItems(db, offerId);
  const lineNumber = existingItems.length + 1;

  const now = Timestamp.now();
  const amount = Math.round(input.quantity * input.unitPrice * 100) / 100;
  const gstAmount = input.gstRate ? Math.round(amount * input.gstRate * 100) / 10000 : undefined;

  const itemData: Record<string, unknown> = {
    offerId,
    lineNumber,
    itemType: input.itemType,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    unitPrice: input.unitPrice,
    amount,
    priceAccepted: false,
    createdAt: now,
    updatedAt: now,
    ...(input.gstRate !== undefined && { gstRate: input.gstRate }),
    ...(gstAmount !== undefined && { gstAmount }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.materialId !== undefined && { materialId: input.materialId }),
    ...(input.serviceId !== undefined && { serviceId: input.serviceId }),
    ...(input.boughtOutItemId !== undefined && { boughtOutItemId: input.boughtOutItemId }),
    ...(input.linkedItemName !== undefined && { linkedItemName: input.linkedItemName }),
    ...(input.linkedItemCode !== undefined && { linkedItemCode: input.linkedItemCode }),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.VENDOR_OFFER_ITEMS), itemData);

  // Update parent offer totals
  await recalculateOfferTotals(db, offerId, userId);

  logger.info('Offer item added', { offerId, itemId: docRef.id });

  return { id: docRef.id, ...(itemData as Omit<VendorOfferItem, 'id'>) };
}

export async function getOfferItems(db: Firestore, offerId: string): Promise<VendorOfferItem[]> {
  const q = query(
    collection(db, COLLECTIONS.VENDOR_OFFER_ITEMS),
    where('offerId', '==', offerId),
    orderBy('lineNumber', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VendorOfferItem, 'id'>) }));
}

export async function updateOfferItem(
  db: Firestore,
  itemId: string,
  updates: Partial<
    Pick<
      VendorOfferItem,
      | 'itemType'
      | 'description'
      | 'quantity'
      | 'unit'
      | 'unitPrice'
      | 'gstRate'
      | 'notes'
      | 'materialId'
      | 'serviceId'
      | 'boughtOutItemId'
      | 'linkedItemName'
      | 'linkedItemCode'
    >
  >,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ESTIMATION,
    userId,
    'update offer item'
  );

  // Read current item to get offerId and compute amount
  const snap = await getDoc(doc(db, COLLECTIONS.VENDOR_OFFER_ITEMS, itemId));
  if (!snap.exists()) throw new Error(`Offer item ${itemId} not found`);
  const current: VendorOfferItem = { id: snap.id, ...(snap.data() as Omit<VendorOfferItem, 'id'>) };

  const data: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (updates.itemType !== undefined) data.itemType = updates.itemType;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.quantity !== undefined) data.quantity = updates.quantity;
  if (updates.unit !== undefined) data.unit = updates.unit;
  if (updates.unitPrice !== undefined) data.unitPrice = updates.unitPrice;
  if (updates.gstRate !== undefined) data.gstRate = updates.gstRate;
  if (updates.notes !== undefined) data.notes = updates.notes;
  if (updates.materialId !== undefined) data.materialId = updates.materialId;
  if (updates.serviceId !== undefined) data.serviceId = updates.serviceId;
  if (updates.boughtOutItemId !== undefined) data.boughtOutItemId = updates.boughtOutItemId;
  if (updates.linkedItemName !== undefined) data.linkedItemName = updates.linkedItemName;
  if (updates.linkedItemCode !== undefined) data.linkedItemCode = updates.linkedItemCode;

  // Recalculate amount if quantity or unitPrice changed
  const qty = updates.quantity ?? current.quantity;
  const price = updates.unitPrice ?? current.unitPrice;
  data.amount = Math.round(qty * price * 100) / 100;

  const gstRate = updates.gstRate ?? current.gstRate;
  if (gstRate) {
    data.gstAmount = Math.round((data.amount as number) * gstRate * 100) / 10000;
  }

  await updateDoc(doc(db, COLLECTIONS.VENDOR_OFFER_ITEMS, itemId), data);
  await recalculateOfferTotals(db, current.offerId, userId);

  logger.info('Offer item updated', { itemId });
}

export async function removeOfferItem(
  db: Firestore,
  itemId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ESTIMATION,
    userId,
    'remove offer item'
  );

  const snap = await getDoc(doc(db, COLLECTIONS.VENDOR_OFFER_ITEMS, itemId));
  if (!snap.exists()) throw new Error(`Offer item ${itemId} not found`);
  const current: VendorOfferItem = { id: snap.id, ...(snap.data() as Omit<VendorOfferItem, 'id'>) };

  await deleteDoc(doc(db, COLLECTIONS.VENDOR_OFFER_ITEMS, itemId));
  await recalculateOfferTotals(db, current.offerId, userId);

  logger.info('Offer item removed', { itemId, offerId: current.offerId });
}

// ============================================================================
// Price Acceptance
// ============================================================================

/**
 * Accept a price from a vendor offer item and push it to the material price database.
 * Only works for items linked to a material. For services and bought-out items,
 * the price is recorded on the offer item only (priceAccepted flag).
 */
export async function acceptPrice(
  db: Firestore,
  itemId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ESTIMATION,
    userId,
    'accept vendor price'
  );

  const itemSnap = await getDoc(doc(db, COLLECTIONS.VENDOR_OFFER_ITEMS, itemId));
  if (!itemSnap.exists()) throw new Error(`Offer item ${itemId} not found`);
  const item: VendorOfferItem = {
    id: itemSnap.id,
    ...(itemSnap.data() as Omit<VendorOfferItem, 'id'>),
  };

  if (item.priceAccepted) {
    throw new Error('Price has already been accepted for this item');
  }

  // Get parent offer for vendor info
  const offerSnap = await getDoc(doc(db, COLLECTIONS.VENDOR_OFFERS, item.offerId));
  if (!offerSnap.exists()) throw new Error(`Vendor offer ${item.offerId} not found`);
  const offer: VendorOffer = { id: offerSnap.id, ...(offerSnap.data() as Omit<VendorOffer, 'id'>) };

  // Push price to material database if linked to a material
  if (item.itemType === 'MATERIAL' && item.materialId) {
    await addMaterialPrice(
      db,
      {
        materialId: item.materialId,
        pricePerUnit: { amount: item.unitPrice, currency: offer.currency },
        unit: item.unit,
        currency: offer.currency,
        vendorId: offer.vendorId,
        vendorName: offer.vendorName,
        sourceType: 'VENDOR_QUOTE',
        effectiveDate: Timestamp.now(),
        isActive: true,
        isForecast: false,
        documentReference: offer.offerNumber,
        remarks: `Accepted from vendor offer ${offer.offerNumber}`,
      },
      userId
    );
  }

  // Mark item as accepted
  const now = Timestamp.now();
  await updateDoc(doc(db, COLLECTIONS.VENDOR_OFFER_ITEMS, itemId), {
    priceAccepted: true,
    priceAcceptedAt: now,
    priceAcceptedBy: userId,
    updatedAt: now,
  });

  // Update parent offer accepted count
  await recalculateOfferTotals(db, item.offerId, userId);

  logger.info('Price accepted from vendor offer', {
    itemId,
    offerId: item.offerId,
    itemType: item.itemType,
    materialId: item.materialId,
  });
}

// ============================================================================
// Internal Helpers
// ============================================================================

async function recalculateOfferTotals(
  db: Firestore,
  offerId: string,
  userId: string
): Promise<void> {
  const items = await getOfferItems(db, offerId);

  const totalAmount = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  const itemCount = items.length;
  const acceptedCount = items.filter((i) => i.priceAccepted).length;

  await updateDoc(doc(db, COLLECTIONS.VENDOR_OFFERS, offerId), {
    totalAmount,
    itemCount,
    acceptedCount,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}
