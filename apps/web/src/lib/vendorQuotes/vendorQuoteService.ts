/**
 * Vendor Quote Service — Unified quote CRUD + workflow
 *
 * Replaces (in Stages 2 + 3):
 * - apps/web/src/lib/procurement/offer/* (procurement RFQ-response offers)
 * - apps/web/src/lib/vendorOffers/vendorOfferService.ts (materials standing offers)
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
import { PERMISSION_FLAGS } from '@vapour/constants';
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
import { requirePermission } from '@/lib/auth';
import { addMaterialPrice } from '@/lib/materials/pricing';
import { updateBoughtOutItem } from '@/lib/boughtOut/boughtOutService';

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

  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
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
  /** Pass `true` to return only quotes NOT linked to an RFQ (standing / unsolicited). */
  rfqIdIsNull?: boolean;
  vendorId?: string;
  sourceType?: QuoteSourceType;
  status?: QuoteStatus;
  /** Filter out archived / inactive quotes. Defaults to true. */
  activeOnly?: boolean;
  limit?: number;
}

// ============================================================================
// Helpers
// ============================================================================

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

function roundToPaisa(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================================
// Create
// ============================================================================

/**
 * Create a new vendor quote. Items may be supplied up-front (batched write)
 * or added later via `addVendorQuoteItem()` for the DRAFT-first pattern.
 */
export async function createVendorQuote(
  db: Firestore,
  input: CreateVendorQuoteInput,
  items: CreateVendorQuoteItemInput[],
  userId: string,
  userName: string,
  userPermissions: number
): Promise<string> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'create vendor quote'
  );

  if (!input.vendorName?.trim()) throw new Error('Vendor name is required');
  if (input.sourceType === 'RFQ_RESPONSE' && !input.rfqId) {
    throw new Error('RFQ_RESPONSE quotes require an rfqId');
  }

  const number = await generateQuoteNumber(db);
  const now = Timestamp.now();

  // If items were supplied, use their subtotal. Otherwise start at zero (DRAFT).
  const subtotal = input.subtotal ?? items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount =
    input.taxAmount ??
    items.reduce((s, i) => s + (i.gstRate ? i.quantity * i.unitPrice * (i.gstRate / 100) : 0), 0);
  const totalAmount = input.totalAmount ?? subtotal + taxAmount;

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
    itemsParsed: items.length > 0,

    subtotal: roundToPaisa(subtotal),
    taxAmount: roundToPaisa(taxAmount),
    totalAmount: roundToPaisa(totalAmount),
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

    status: (items.length > 0 ? 'UPLOADED' : 'DRAFT') as QuoteStatus,
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

  if (items.length > 0) {
    const batch = writeBatch(db);
    items.forEach((item, idx) => {
      const itemRef = doc(collection(db, COLLECTIONS.VENDOR_QUOTE_ITEMS));
      const amount = roundToPaisa(item.quantity * item.unitPrice);
      const gstAmount =
        item.gstRate !== undefined ? roundToPaisa(amount * (item.gstRate / 100)) : undefined;

      batch.set(
        itemRef,
        stripUndefined({
          quoteId: quoteRef.id,
          tenantId: input.tenantId,
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
          amount,
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
  }

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
  let quotes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VendorQuote, 'id'>) }));

  // `isActive` filter is a secondary filter rather than a query constraint so
  // we don't need a composite index for every filter permutation.
  if (filters.activeOnly !== false) {
    quotes = quotes.filter((q) => q.isActive !== false);
  }
  return quotes;
}

/** Convenience: all quotes tied to an RFQ (RFQ responses + offline-linked). */
export async function getQuotesByRFQ(db: Firestore, rfqId: string): Promise<VendorQuote[]> {
  return listVendorQuotes(db, { rfqId, activeOnly: false });
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
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'update vendor quote status'
  );
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
    Pick<
      VendorQuote,
      | 'vendorId'
      | 'vendorName'
      | 'vendorOfferNumber'
      | 'remarks'
      | 'currency'
      | 'status'
      | 'fileUrl'
      | 'fileName'
      | 'paymentTerms'
      | 'deliveryTerms'
      | 'warrantyTerms'
      | 'exWorks'
      | 'transportation'
      | 'packingForwarding'
      | 'insurance'
      | 'erectionAfterPurchase'
      | 'inspection'
      | 'discount'
      | 'evaluationScore'
      | 'evaluationNotes'
      | 'isRecommended'
      | 'recommendationReason'
      | 'redFlags'
      | 'isActive'
    >
  > & {
    vendorOfferDate?: Date;
    validityDate?: Date;
  },
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'update vendor quote'
  );

  const data: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    if (k === 'vendorOfferDate' || k === 'validityDate') {
      data[k] = v instanceof Date ? Timestamp.fromDate(v) : v;
    } else {
      data[k] = v;
    }
  }
  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId), data);
}

// ============================================================================
// Item CRUD
// ============================================================================

export async function addVendorQuoteItem(
  db: Firestore,
  quoteId: string,
  input: CreateVendorQuoteItemInput,
  userId: string,
  userPermissions: number
): Promise<VendorQuoteItem> {
  requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT, userId, 'add quote item');

  // Inherit tenantId from parent quote for tenant-scoped Firestore rules.
  const parentSnap = await getDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId));
  if (!parentSnap.exists()) throw new Error(`Vendor quote ${quoteId} not found`);
  const parentTenantId = parentSnap.data()?.tenantId as string | undefined;

  const existing = await getVendorQuoteItems(db, quoteId);
  const lineNumber = input.lineNumber ?? existing.length + 1;
  const amount = roundToPaisa(input.quantity * input.unitPrice);
  const gstAmount =
    input.gstRate !== undefined ? roundToPaisa(amount * (input.gstRate / 100)) : undefined;
  const now = Timestamp.now();

  const itemData = stripUndefined({
    quoteId,
    tenantId: parentTenantId,
    rfqItemId: input.rfqItemId,
    itemType: input.itemType,
    lineNumber,
    description: input.description,

    materialId: input.materialId,
    materialCode: input.materialCode,
    materialName: input.materialName,
    serviceId: input.serviceId,
    serviceCode: input.serviceCode,
    boughtOutItemId: input.boughtOutItemId,
    linkedItemName: input.linkedItemName,
    linkedItemCode: input.linkedItemCode,

    quantity: input.quantity,
    unit: input.unit,
    unitPrice: input.unitPrice,
    amount,
    gstRate: input.gstRate,
    gstAmount,

    deliveryPeriod: input.deliveryPeriod,
    deliveryDate: dateToTimestamp(input.deliveryDate),
    makeModel: input.makeModel,

    meetsSpec: input.meetsSpec,
    deviations: input.deviations,

    vendorNotes: input.vendorNotes,
    notes: input.notes,

    priceAccepted: false,

    createdAt: now,
    updatedAt: now,
  });

  const ref = await addDoc(collection(db, COLLECTIONS.VENDOR_QUOTE_ITEMS), itemData);
  await recalculateQuoteTotals(db, quoteId, userId);

  logger.info('Quote item added', { quoteId, itemId: ref.id });
  return { id: ref.id, ...(itemData as Omit<VendorQuoteItem, 'id'>) };
}

export async function updateVendorQuoteItem(
  db: Firestore,
  itemId: string,
  updates: Partial<
    Pick<
      VendorQuoteItem,
      | 'itemType'
      | 'description'
      | 'quantity'
      | 'unit'
      | 'unitPrice'
      | 'gstRate'
      | 'notes'
      | 'vendorNotes'
      | 'materialId'
      | 'materialCode'
      | 'materialName'
      | 'serviceId'
      | 'serviceCode'
      | 'boughtOutItemId'
      | 'linkedItemName'
      | 'linkedItemCode'
      | 'makeModel'
      | 'meetsSpec'
      | 'deviations'
    >
  >,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'update quote item'
  );

  const snap = await getDoc(doc(db, COLLECTIONS.VENDOR_QUOTE_ITEMS, itemId));
  if (!snap.exists()) throw new Error(`Quote item ${itemId} not found`);
  const current: VendorQuoteItem = {
    id: snap.id,
    ...(snap.data() as Omit<VendorQuoteItem, 'id'>),
  };

  const data: Record<string, unknown> = { updatedAt: Timestamp.now() };
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) data[k] = v;
  }

  const qty = updates.quantity ?? current.quantity;
  const price = updates.unitPrice ?? current.unitPrice;
  data.amount = roundToPaisa(qty * price);

  const gstRate = updates.gstRate ?? current.gstRate;
  if (gstRate) {
    data.gstAmount = roundToPaisa((data.amount as number) * (gstRate / 100));
  }

  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTE_ITEMS, itemId), data);
  await recalculateQuoteTotals(db, current.quoteId, userId);
}

export async function removeVendorQuoteItem(
  db: Firestore,
  itemId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'remove quote item'
  );

  const snap = await getDoc(doc(db, COLLECTIONS.VENDOR_QUOTE_ITEMS, itemId));
  if (!snap.exists()) throw new Error(`Quote item ${itemId} not found`);
  const current: VendorQuoteItem = {
    id: snap.id,
    ...(snap.data() as Omit<VendorQuoteItem, 'id'>),
  };

  await deleteDoc(doc(db, COLLECTIONS.VENDOR_QUOTE_ITEMS, itemId));
  await recalculateQuoteTotals(db, current.quoteId, userId);
  logger.info('Quote item removed', { itemId, quoteId: current.quoteId });
}

// ============================================================================
// Accept price — push to materialPrices / serviceRates / bought-out pricing
// ============================================================================

export async function acceptQuoteItemPrice(
  db: Firestore,
  itemId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'accept quote item price'
  );

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

  const now = Timestamp.now();

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
        effectiveDate: now,
        isActive: true,
        isForecast: false,
        documentReference: quote.number,
        remarks: `Accepted from vendor quote ${quote.number}`,
      },
      userId
    );
  } else if (item.itemType === 'SERVICE' && item.serviceId) {
    await addDoc(
      collection(db, COLLECTIONS.SERVICE_RATES),
      stripUndefined({
        tenantId: quote.tenantId,
        serviceId: item.serviceId,
        rateValue: item.unitPrice,
        currency: quote.currency,
        effectiveDate: now,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      })
    );
    logger.info('Service rate recorded from quote', {
      serviceId: item.serviceId,
      quoteNumber: quote.number,
    });
  } else if (item.itemType === 'BOUGHT_OUT' && item.boughtOutItemId) {
    await updateBoughtOutItem(
      db,
      item.boughtOutItemId,
      {
        pricing: {
          listPrice: { amount: item.unitPrice, currency: quote.currency },
          currency: quote.currency,
          ...(quote.vendorId ? { vendorId: quote.vendorId } : {}),
        },
      },
      userId
    );
    logger.info('Bought-out item price updated from quote', {
      boughtOutItemId: item.boughtOutItemId,
      quoteNumber: quote.number,
    });
  }

  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTE_ITEMS, itemId), {
    priceAccepted: true,
    priceAcceptedAt: now,
    priceAcceptedBy: userId,
    updatedAt: now,
  });

  await recalculateQuoteTotals(db, item.quoteId, userId);

  logger.info('Vendor quote item price accepted', {
    itemId,
    quoteId: item.quoteId,
    itemType: item.itemType,
  });
}

// ============================================================================
// Internal helpers
// ============================================================================

async function recalculateQuoteTotals(
  db: Firestore,
  quoteId: string,
  userId: string
): Promise<void> {
  const items = await getVendorQuoteItems(db, quoteId);
  const subtotal = roundToPaisa(items.reduce((s, i) => s + i.amount, 0));
  const taxAmount = roundToPaisa(items.reduce((s, i) => s + (i.gstAmount || 0), 0));
  const totalAmount = roundToPaisa(subtotal + taxAmount);
  const itemCount = items.length;
  const acceptedCount = items.filter((i) => i.priceAccepted).length;

  await updateDoc(doc(db, COLLECTIONS.VENDOR_QUOTES, quoteId), {
    subtotal,
    taxAmount,
    totalAmount,
    itemCount,
    acceptedCount,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}
