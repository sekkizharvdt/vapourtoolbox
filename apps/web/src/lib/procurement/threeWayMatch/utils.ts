/**
 * Three-Way Match Utilities
 *
 * Internal helper functions for document fetching, tolerance checks, and discrepancy creation
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
  Timestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  VendorBill,
  MatchToleranceConfig,
  MatchDiscrepancy,
  DiscrepancyType,
} from '@vapour/types';

/**
 * Fetch a Purchase Order by ID
 */
export async function getPurchaseOrder(db: Firestore, id: string): Promise<PurchaseOrder | null> {
  const docRef = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, id));
  if (!docRef.exists()) return null;
  return { id: docRef.id, ...docRef.data() } as PurchaseOrder;
}

/**
 * Fetch a Goods Receipt by ID
 */
export async function getGoodsReceipt(db: Firestore, id: string): Promise<GoodsReceipt | null> {
  const docRef = await getDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, id));
  if (!docRef.exists()) return null;
  return { id: docRef.id, ...docRef.data() } as GoodsReceipt;
}

/**
 * Fetch a Vendor Bill by ID
 */
export async function getVendorBill(db: Firestore, id: string): Promise<VendorBill | null> {
  const docRef = await getDoc(doc(db, 'transactions', id));
  if (!docRef.exists()) return null;
  return { id: docRef.id, ...docRef.data() } as VendorBill;
}

/**
 * Fetch all Purchase Order Items for a PO
 */
export async function getPurchaseOrderItems(
  db: Firestore,
  poId: string
): Promise<PurchaseOrderItem[]> {
  const itemsRef = collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS);
  const q = query(itemsRef, where('purchaseOrderId', '==', poId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PurchaseOrderItem[];
}

/**
 * Fetch all Goods Receipt Items for a GR
 */
export async function getGoodsReceiptItems(
  db: Firestore,
  grId: string
): Promise<GoodsReceiptItem[]> {
  const itemsRef = collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS);
  const q = query(itemsRef, where('goodsReceiptId', '==', grId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as GoodsReceiptItem[];
}

/**
 * Check if quantity variance is within tolerance
 */
export function checkQuantityTolerance(
  variancePercent: number,
  varianceAbsolute: number,
  config: MatchToleranceConfig | null
): boolean {
  if (!config) return Math.abs(variancePercent) <= 5; // Default 5%

  const withinPercent = Math.abs(variancePercent) <= config.quantityTolerancePercent;

  if (varianceAbsolute > 0 && !config.allowQuantityOverage) return false;
  if (varianceAbsolute < 0 && !config.allowQuantityShortage) return false;

  return withinPercent;
}

/**
 * Check if price variance is within tolerance
 */
export function checkPriceTolerance(
  variancePercent: number,
  varianceAbsolute: number,
  config: MatchToleranceConfig | null
): boolean {
  if (!config) return Math.abs(variancePercent) <= 2; // Default 2%

  const withinPercent = Math.abs(variancePercent) <= config.priceTolerancePercent;

  if (varianceAbsolute > 0 && !config.allowPriceIncrease) return false;
  if (varianceAbsolute < 0 && !config.allowPriceDecrease) return false;

  return withinPercent;
}

/**
 * Check if amount variance is within tolerance
 */
export function checkAmountTolerance(
  varianceAbsolute: number,
  variancePercent: number,
  config: MatchToleranceConfig | null
): boolean {
  if (!config) return Math.abs(variancePercent) <= 5; // Default 5%

  const withinPercent = variancePercent <= config.amountTolerancePercent;
  const withinAbsolute = varianceAbsolute <= config.amountToleranceAbsolute;

  if (config.useAbsoluteOrPercentage === 'ABSOLUTE') return withinAbsolute;
  if (config.useAbsoluteOrPercentage === 'PERCENTAGE') return withinPercent;
  return withinAbsolute || withinPercent; // WHICHEVER_IS_LOWER
}

/**
 * Create a discrepancy record
 */
export function createDiscrepancy(
  threeWayMatchId: string,
  matchLineItemId: string | undefined,
  type: DiscrepancyType,
  severity: MatchDiscrepancy['severity'],
  description: string,
  fieldName: string,
  expectedValue: string | number,
  actualValue: string | number,
  variance: number,
  variancePercent: number | null,
  financialImpact: number,
  affectsPayment: boolean,
  userId: string,
  _userName: string
): Omit<MatchDiscrepancy, 'id'> {
  return {
    threeWayMatchId,
    matchLineItemId,
    discrepancyType: type,
    severity,
    description,
    fieldName,
    expectedValue,
    actualValue,
    variance,
    variancePercentage: variancePercent,
    financialImpact,
    affectsPayment,
    resolved: false,
    requiresApproval: severity === 'CRITICAL' || severity === 'HIGH',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: userId,
    updatedBy: userId,
  };
}
