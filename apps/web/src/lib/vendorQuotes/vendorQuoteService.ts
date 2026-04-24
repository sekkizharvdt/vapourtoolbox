/**
 * Vendor Quote Service — Unified quote CRUD + workflow
 *
 * Replaces (in Stages 2 + 3):
 * - apps/web/src/lib/procurement/offer/* (procurement RFQ-response offers)
 * - apps/web/src/lib/vendorOffers/vendorOfferService.ts (materials standing offers)
 *
 * Stage 1 is purely additive — this service writes to the new `vendorQuotes` /
 * `vendorQuoteItems` collections and doesn't disturb the existing flows.
 * Callers will migrate to this service in Stages 2 and 3.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  CurrencyCode,
  QuoteItemType,
  QuoteSourceType,
  QuoteStatus,
  RFQMode,
  VendorQuote,
  VendorQuoteItem,
} from '@vapour/types';
import { addMaterialPrice } from '@/lib/materials/pricing';

const logger = createLogger({ context: 'vendorQuoteService' });

// ============================================================================
// Input types
// ============================================================================

export interface CreateVendorQuoteInput {
  tenantId?: string;

  sourceType: QuoteSourceType;
  rfqId?: string;
  rfqNumber?: string;
  rfqMode?: RFQMode;

  vendorId?: string;
  vendorName: string;
  vendorOfferNumber?: string;
  vendorOfferDate?: Date;

  fileUrl?: string;
  fileName?: string;
  additionalDocuments?: string[];

  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency?: CurrencyCode;
  discount?: number;

  paymentTerms?: string;
  deliveryTerms?: string;
  validityDate?: Date;
  warrantyTerms?: string;
  remarks?: string;

  exWorks?: string;
  transportation?: string;
  packingForwarding?: string;
  insurance?: string;
  erectionAfterPurchase?: string;
  inspection?: string;
}

export interface CreateVendorQuoteItemInput {
  rfqItemId?: string;
  itemType: QuoteItemType;
  lineNumber?: number;
  description: string;

  materialId?: string;
  materialCode?: string;
  materialName?: string;
  serviceId?: string;
  serviceCode?: string;
  boughtOutItemId?: string;
  linkedItemName?: string;
  linkedItemCode?: string;

  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate?: number;

  deliveryPeriod?: string;
  deliveryDate?: Date;
  makeModel?: string;

  meetsSpec?: boolean;
  deviations?: string;

  vendorNotes?: string;
  notes?: string;
}

export interface ListVendorQuotesFilters {
  rfqId?: string;
  /** Pass `null` to return only quotes NOT linked to an RFQ (standing / unsolicited). */
  rfqIdIsNull?: boolean;
  vendorId?: string;
  sourceType?: QuoteSourceType;
  status?: QuoteStatus;
  limit?: number;
}

// ============================================================================
// Number generation
// ============================================================================

/** Format `Q-YYYY-NNNN`, auto-incremented within the calendar year. */
async function generateQuoteNumber(db: Firestore): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.VENDOR_QUOTES),
      where('number', '>=', prefix),
      where('number', '<', `Q-${year + 1}-`),
      orderBy('number', 'desc'),
      firestoreLimit(1)
    )
  );
  let next = 1;
  if (!snap.empty) {
    const d = snap.docs[0]?.data();
    const last = typeof d?.number === 'string' ? d.number : '';
    const m = last.match(/^Q-\d{4}-(\d+)$/);
    if (m && m[1]) next = Number(m[1]) + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

// ============================================================================
// Conversion helpers
// ============================================================================

function dateToTimestamp(d: Date | undefined): Timestamp | undefined {
  return d ? Timestamp.fromDate(d) : undefined;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ============================================================================
// Create
// ============================================================================

/**
 * Create a new vendor quote with items. Quote and items are written in a
 * batched write so partial failures are rolled back cleanly.
 */
export async function createVendorQuote(
  db: Firestore,
  input: CreateVendorQuoteInput,
  items: CreateVendorQuoteItemInput[],
  userId: string,
  userName: string
): Promise<string> {
  if (!input.vendorName?.trim()) throw new Error('Vendor name is required');
  if (items.length === 0) throw new Error('At least one item is required');

  // rfqId is optional overall, but if sourceType=RFQ_RESPONSE we need it.
  if (input.sourceType === 'RFQ_RESPONSE' && !input.rfqId) {
    throw new Error('RFQ_RESPONSE quotes require an rfqId');
  }

  const number = await generateQuoteNumber(db);
  const now = Timestamp.now();

  const quoteDoc = stripUndefined({
    number,
    tenantId: input.tenantId,

    sourceType: input.sourceType,
    rfqId: input.rfqId,
    rfqNumber: input.rfqNumber,
    rfqMode: input.rfqMode,

    vendorId: input.vendorId,
    vendorName: input.vendorName,
    vendorOfferNumber: input.vendorOfferNumber,
    vendorOfferDate: dateToTimestamp(input.vendorOfferDate),

    fileUrl: input.fileUrl,
    fileName: input.fileName,
    additionalDocuments: input.additionalDocuments,
    itemsParsed: true,

    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    totalAmount: input.totalAmount,
    currency: input.currency || ('INR' as CurrencyCode),
    discount: input.discount,

    paymentTerms: input.paymentTerms,
    deliveryTerms: input.deliveryTerms,
    validityDate: dateToTimestamp(input.validityDate),
    warrantyTerms: input.warrantyTerms,
    remarks: input.remarks,

    exWorks: input.exWorks,
    transportation: input.transportation,
    packingForwarding: input.packingForwarding,
    insurance: input.insurance,
    erectionAfterPurchase: input.erectionAfterPurchase,
    inspection: input.inspection,

    status: 'UPLOADED' as QuoteStatus,
    isRecommended: false,

    itemCount: items.length,
    acceptedCount: 0,
    isActive: true,

    createdBy: userId,
    createdByName: userName,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  });

  const quoteRef = await addDoc(collection(db, COLLECTIONS.VENDOR_QUOTES), quoteDoc);

  // Batch-write items.
  const batch = writeBatch(db);
  items.forEach((item, idx) => {
    const itemRef = doc(collection(db, COLLECTIONS.VENDOR_QUOTE_ITEMS));
    const lineTotal = item.quantity * item.unitPrice;
    const gstAmount =
      item.gstRate !== undefined
        ? Math.round(lineTotal * (item.gstRate / 100) * 100) / 100
        : undefined;

    batch.set(
      itemRef,
      stripUndefined({
        quoteId: quoteRef.id,
        rfqItemId: item.rfqItemId,
        itemType: item.itemType,
        lineNumber: item.lineNumber ?? idx + 1,
        description: item.description,

        materialId: item.materialId,
        materialCode: item.materialCode,
        materialName: item.materialName,
        serviceId: item.serviceId,
        serviceCode: item.serviceCode,
        boughtOutItemId: item.boughtOutItemId,
        linkedItemName: item.linkedItemName,
        linkedItemCode: item.linkedItemCode,

        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        amount: lineTotal,
        gstRate: item.gstRate,
        gstAmount,

        deliveryPeriod: item.deliveryPeriod,
        deliveryDate: dateToTimestamp(item.deliveryDate),
        makeModel: item.makeModel,

        meetsSpec: item.meetsSpec,
        deviations: item.deviations,

        vendorNotes: item.vendorNotes,
        notes: item.notes,

        priceAccepted: false,

        createdAt: now,
        updatedAt: now,
      })
    );
  });
  await batch.commit();

  logger.info('Vendor quote created', { quoteId: quoteRef.id, number, items: items.length });
  return quoteRef.id;
}

// ============================================================================
// Read
// ============================================================================

export async function getVendorQuoteById(
  db: Firestore,
  quoteId: string
): Promise<VendorQuote | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<VendorQuote, 'id'>) };
}

export async function listVendorQuotes(
  db: Firestore,
  filters: ListVendorQuotesFilters = {}
): Promise<VendorQuote[]> {
  const constraints: Parameters<typeof query>[1][] = [];
  if (filters.rfqId) constraints.push(where('rfqId', '==', filters.rfqId));
  else if (filters.rfqIdIsNull) constraints.push(where('rfqId', '==', null));
  if (filters.vendorId) constraints.push(where('vendorId', '==', filters.vendorId));
  if (filters.sourceType) constraints.push(where('sourceType', '==', filters.sourceType));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  constraints.push(orderBy('createdAt', 'desc'));
  if (filters.limit) constraints.push(firestoreLimit(filters.limit));

  const snap = await getDocs(query(collection(db, COLLECTIONS.VENDOR_QUOTES), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VendorQuote, 'id'>) }));
}

/** Convenience: all quotes (any status) tied to an RFQ. */
export async function getQuotesByRFQ(db: Firestore, rfqId: string): Promise<VendorQuote[]> {
  return listVendorQuotes(db, { rfqId });
}

export async function getVendorQuoteItems(
  db: Firestore,
  quoteId: string
): Promise<VendorQuoteItem[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.VENDOR_QUOTE_ITEMS),
      where('quoteId', '==', quoteId),
      orderBy('lineNumber', 'asc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VendorQuoteItem, 'id'>) }));
}

// ============================================================================
// Update
// ============================================================================

export async function updateVendorQuoteStatus(
  db: Firestore,
  quoteId: string,
  newStatus: QuoteStatus,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId), {
    status: newStatus,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
  logger.info('Vendor quote status updated', { quoteId, newStatus });
}

export async function updateVendorQuote(
  db: Firestore,
  quoteId: string,
  updates: Partial<
    Omit<VendorQuote, 'id' | 'createdAt' | 'createdBy' | 'createdByName' | 'number'>
  >,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId), {
    ...stripUndefined(updates),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}

export async function deleteVendorQuoteItem(db: Firestore, itemId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.VENDOR_QUOTE_ITEMS, itemId));
}

// ============================================================================
// Accept price — push to materialPrices / serviceRates
// ============================================================================

/**
 * Mark a single quote item's price as accepted and push it to the relevant
 * price-history table.
 *
 * - MATERIAL items write to `materialPrices` with `sourceType: 'VENDOR_QUOTE'`
 * - SERVICE items write to `serviceRates`
 * - BOUGHT_OUT items update the bought-out item's current price
 */
export async function acceptQuoteItemPrice(
  db: Firestore,
  itemId: string,
  userId: string
): Promise<void> {
  const itemSnap = await getDoc(doc(db, COLLECTIONS.VENDOR_QUOTE_ITEMS, itemId));
  if (!itemSnap.exists()) throw new Error(`Quote item ${itemId} not found`);

  const item: VendorQuoteItem = {
    id: itemSnap.id,
    ...(itemSnap.data() as Omit<VendorQuoteItem, 'id'>),
  };

  if (item.priceAccepted) {
    throw new Error('Price already accepted for this item');
  }

  const quoteSnap = await getDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, item.quoteId));
  if (!quoteSnap.exists()) throw new Error(`Vendor quote ${item.quoteId} not found`);
  const quote: VendorQuote = {
    id: quoteSnap.id,
    ...(quoteSnap.data() as Omit<VendorQuote, 'id'>),
  };

  if (item.itemType === 'MATERIAL' && item.materialId) {
    await addMaterialPrice(
      db,
      {
        materialId: item.materialId,
        pricePerUnit: { amount: item.unitPrice, currency: quote.currency },
        unit: item.unit,
        currency: quote.currency,
        vendorId: quote.vendorId,
        vendorName: quote.vendorName,
        sourceType: 'VENDOR_QUOTE',
        effectiveDate: Timestamp.now(),
        isActive: true,
        isForecast: false,
        documentReference: quote.number,
        remarks: `Accepted from vendor quote ${quote.number}`,
      },
      userId
    );
  }
  // SERVICE and BOUGHT_OUT paths can mirror the vendorOfferService logic —
  // added in Stage 2 alongside the UI migration so we can test in one pass.

  const now = Timestamp.now();
  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTE_ITEMS, itemId), {
    priceAccepted: true,
    priceAcceptedAt: now,
    priceAcceptedBy: userId,
    updatedAt: now,
  });

  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, item.quoteId), {
    acceptedCount: (quote.acceptedCount || 0) + 1,
    updatedAt: now,
    updatedBy: userId,
  });

  logger.info('Vendor quote item price accepted', { itemId, materialId: item.materialId });
}
