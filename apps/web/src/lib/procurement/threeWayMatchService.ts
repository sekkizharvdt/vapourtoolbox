/**
 * Three-Way Match Service
 *
 * Implements automated matching of Purchase Orders, Goods Receipts, and Vendor Invoices.
 * Validates quantities, prices, and amounts to prevent payment errors and fraud.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Firestore,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  ThreeWayMatch,
  MatchLineItem,
  MatchDiscrepancy,
  MatchToleranceConfig,
  DiscrepancyType,
} from '@vapour/types';
import type { VendorBill } from '@vapour/types';

const logger = createLogger({ context: 'threeWayMatchService' });

/**
 * Perform 3-way match between PO, GR, and Vendor Invoice
 */
export async function performThreeWayMatch(
  db: Firestore,
  purchaseOrderId: string,
  goodsReceiptId: string,
  vendorBillId: string,
  userId: string,
  userName: string,
  matchType: 'AUTOMATIC' | 'MANUAL' | 'SYSTEM_ASSISTED' = 'AUTOMATIC'
): Promise<string> {
  try {
    // Fetch all required documents
    const [po, gr, vendorBill, toleranceConfig] = await Promise.all([
      getPurchaseOrder(db, purchaseOrderId),
      getGoodsReceipt(db, goodsReceiptId),
      getVendorBill(db, vendorBillId),
      getDefaultToleranceConfig(db),
    ]);

    // Fetch line items
    const [poItems, grItems] = await Promise.all([
      getPurchaseOrderItems(db, purchaseOrderId),
      getGoodsReceiptItems(db, goodsReceiptId),
    ]);

    // Validate documents
    if (!po || !gr || !vendorBill) {
      throw new Error('One or more required documents not found');
    }

    // Verify they all match (same PO, vendor, etc.)
    if (gr.purchaseOrderId !== purchaseOrderId) {
      throw new Error('Goods Receipt does not match the Purchase Order');
    }

    if (vendorBill.entityId !== po.vendorId) {
      throw new Error('Vendor Bill is from a different vendor than the Purchase Order');
    }

    // Perform line-level matching
    const matchLineItems: Omit<MatchLineItem, 'id'>[] = [];
    const discrepancies: Omit<MatchDiscrepancy, 'id'>[] = [];

    let matchedLines = 0;
    let unmatchedLines = 0;

    // Match invoice lines with PO and GR items
    vendorBill.lineItems.forEach((invoiceLine, index) => {
      // Find corresponding PO item (match by description or item ID)
      const poItem = poItems.find(
        (item) =>
          item.description.toLowerCase().includes(invoiceLine.description.toLowerCase()) ||
          invoiceLine.description.toLowerCase().includes(item.description.toLowerCase())
      );

      // Find corresponding GR item
      const grItem = grItems.find((item) => item.poItemId === poItem?.id);

      if (!poItem || !grItem) {
        unmatchedLines++;
        // Create discrepancy for missing PO/GR item
        discrepancies.push(
          createDiscrepancy(
            '', // Will be set after match creation
            undefined,
            poItem ? 'ITEM_NOT_RECEIVED' : 'ITEM_NOT_ORDERED',
            'CRITICAL',
            `Item "${invoiceLine.description}" ${poItem ? 'was not received' : 'is not on the purchase order'}`,
            'lineItem',
            '',
            invoiceLine.description,
            invoiceLine.amount,
            null,
            invoiceLine.amount,
            true,
            userId,
            userName
          )
        );
        return;
      }

      // Calculate variances
      const qtyVariance = invoiceLine.quantity - grItem.receivedQuantity;
      const qtyVariancePercent =
        grItem.receivedQuantity > 0 ? (qtyVariance / grItem.receivedQuantity) * 100 : 0;

      const priceVariance = invoiceLine.unitPrice - poItem.unitPrice;
      const priceVariancePercent =
        poItem.unitPrice > 0 ? (priceVariance / poItem.unitPrice) * 100 : 0;

      const poLineTotal = poItem.quantity * poItem.unitPrice;
      const grLineTotal = grItem.receivedQuantity * poItem.unitPrice;
      const invoiceLineTotal = invoiceLine.amount;
      const amountVariance = invoiceLineTotal - grLineTotal;
      const amountVariancePercent = grLineTotal > 0 ? (amountVariance / grLineTotal) * 100 : 0;

      // Check tolerances
      const qtyWithinTolerance = checkQuantityTolerance(
        qtyVariancePercent,
        qtyVariance,
        toleranceConfig
      );
      const priceWithinTolerance = checkPriceTolerance(
        priceVariancePercent,
        priceVariance,
        toleranceConfig
      );
      const amountWithinTolerance = checkAmountTolerance(
        Math.abs(amountVariance),
        Math.abs(amountVariancePercent),
        toleranceConfig
      );

      const lineWithinTolerance =
        qtyWithinTolerance && priceWithinTolerance && amountWithinTolerance;

      // Determine line status
      let lineStatus: MatchLineItem['lineStatus'];
      if (qtyVariance === 0 && priceVariance === 0 && amountVariance === 0) {
        lineStatus = 'MATCHED';
        matchedLines++;
      } else if (lineWithinTolerance) {
        lineStatus = 'VARIANCE_WITHIN_TOLERANCE';
        matchedLines++;
      } else {
        lineStatus = 'VARIANCE_EXCEEDS_TOLERANCE';
        unmatchedLines++;
      }

      // Create match line item
      const matchLineItem: Omit<MatchLineItem, 'id'> = {
        threeWayMatchId: '', // Will be set after match creation
        lineNumber: index + 1,
        description: invoiceLine.description,
        poItemId: poItem.id,
        grItemId: grItem.id,
        invoiceLineItemId: invoiceLine.id,
        orderedQuantity: poItem.quantity,
        receivedQuantity: grItem.receivedQuantity,
        invoicedQuantity: invoiceLine.quantity,
        acceptedQuantity: grItem.acceptedQuantity,
        quantityMatched: Math.abs(qtyVariance) < 0.01,
        quantityVariance: qtyVariance,
        quantityVariancePercentage: qtyVariancePercent,
        unit: poItem.unit,
        poUnitPrice: poItem.unitPrice,
        invoiceUnitPrice: invoiceLine.unitPrice,
        priceMatched: Math.abs(priceVariance) < 0.01,
        priceVariance,
        priceVariancePercentage: priceVariancePercent,
        poLineTotal,
        grLineTotal,
        invoiceLineTotal,
        amountMatched: Math.abs(amountVariance) < 0.01,
        amountVariance,
        amountVariancePercentage: amountVariancePercent,
        poTaxRate: invoiceLine.gstRate,
        invoiceTaxRate: invoiceLine.gstRate,
        poTaxAmount: invoiceLine.gstAmount || 0,
        invoiceTaxAmount: invoiceLine.gstAmount || 0,
        taxMatched: true,
        taxVariance: 0,
        lineStatus,
        withinTolerance: lineWithinTolerance,
        hasDiscrepancy: !lineWithinTolerance,
        discrepancyTypes: [],
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      };

      // Create line-level discrepancies
      if (!qtyWithinTolerance && Math.abs(qtyVariance) > 0.01) {
        matchLineItem.discrepancyTypes.push('QUANTITY_MISMATCH');
        discrepancies.push(
          createDiscrepancy(
            '',
            undefined,
            'QUANTITY_MISMATCH',
            Math.abs(qtyVariancePercent) > 10 ? 'HIGH' : 'MEDIUM',
            `Quantity variance: ${qtyVariance.toFixed(2)} ${poItem.unit} (${qtyVariancePercent.toFixed(1)}%)`,
            'quantity',
            grItem.receivedQuantity.toString(),
            invoiceLine.quantity.toString(),
            qtyVariance,
            qtyVariancePercent,
            Math.abs(amountVariance),
            Math.abs(qtyVariancePercent) > 10,
            userId,
            userName
          )
        );
      }

      if (!priceWithinTolerance && Math.abs(priceVariance) > 0.01) {
        matchLineItem.discrepancyTypes.push('PRICE_MISMATCH');
        discrepancies.push(
          createDiscrepancy(
            '',
            undefined,
            'PRICE_MISMATCH',
            Math.abs(priceVariancePercent) > 5 ? 'HIGH' : 'MEDIUM',
            `Unit price variance: ₹${priceVariance.toFixed(2)} (${priceVariancePercent.toFixed(1)}%)`,
            'unitPrice',
            poItem.unitPrice.toString(),
            invoiceLine.unitPrice.toString(),
            priceVariance,
            priceVariancePercent,
            Math.abs(amountVariance),
            Math.abs(priceVariancePercent) > 5,
            userId,
            userName
          )
        );
      }

      if (!amountWithinTolerance && Math.abs(amountVariance) > 0.01) {
        matchLineItem.discrepancyTypes.push('AMOUNT_MISMATCH');
      }

      matchLineItems.push(matchLineItem);
    });

    // Calculate overall match percentage
    const totalLines = matchLineItems.length;
    const overallMatchPercentage = totalLines > 0 ? (matchedLines / totalLines) * 100 : 0;

    // Calculate financial summary
    const poAmount = po.grandTotal;
    // Calculate GR amount using PO unit prices
    const grAmount = grItems.reduce((sum, grItem) => {
      const poItem = poItems.find((po) => po.id === grItem.poItemId);
      const unitPrice = poItem?.unitPrice || 0;
      return sum + grItem.receivedQuantity * unitPrice;
    }, 0);
    const invoiceAmount = vendorBill.totalAmount;
    const variance = invoiceAmount - grAmount;
    const variancePercentage = grAmount > 0 ? (variance / grAmount) * 100 : 0;

    // Determine overall status
    const withinTolerance = checkAmountTolerance(
      Math.abs(variance),
      Math.abs(variancePercentage),
      toleranceConfig
    );

    let status: ThreeWayMatch['status'];
    if (discrepancies.length === 0 && matchedLines === totalLines) {
      status = 'MATCHED';
    } else if (withinTolerance && unmatchedLines === 0) {
      status = 'PARTIALLY_MATCHED';
    } else if (discrepancies.some((d) => d.severity === 'CRITICAL')) {
      status = 'NOT_MATCHED';
    } else {
      status = 'PENDING_REVIEW';
    }

    const requiresApproval = Boolean(
      !withinTolerance ||
        discrepancies.length > 0 ||
        (toleranceConfig &&
          !toleranceConfig.autoApproveIfWithinTolerance &&
          invoiceAmount > toleranceConfig.autoApproveMaxAmount)
    );

    // Create 3-way match record
    const matchData: Omit<ThreeWayMatch, 'id'> = {
      matchNumber: `TWM/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${Date.now()}`,
      purchaseOrderId,
      poNumber: po.number,
      goodsReceiptId,
      grNumber: gr.number,
      vendorBillId,
      vendorBillNumber: vendorBill.transactionNumber || '',
      vendorInvoiceNumber: vendorBill.vendorInvoiceNumber,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      projectId: po.projectIds[0] || '',
      projectName: po.projectNames[0] || '',
      status,
      overallMatchPercentage,
      poAmount,
      grAmount,
      invoiceAmount,
      variance,
      variancePercentage,
      poTaxAmount: po.totalTax,
      invoiceTaxAmount: vendorBill.taxAmount,
      taxVariance: vendorBill.taxAmount - po.totalTax,
      totalLines,
      matchedLines,
      unmatchedLines,
      hasDiscrepancies: discrepancies.length > 0,
      discrepancyCount: discrepancies.length,
      criticalDiscrepancyCount: discrepancies.filter((d) => d.severity === 'CRITICAL').length,
      withinTolerance,
      toleranceConfigId: toleranceConfig?.id,
      requiresApproval,
      approvalStatus: requiresApproval ? 'PENDING' : undefined,
      resolved: status === 'MATCHED',
      matchType,
      matchedBy: userId,
      matchedByName: userName,
      matchedAt: serverTimestamp() as unknown as Timestamp,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
      createdBy: userId,
      updatedBy: userId,
    };

    // Save to Firestore
    const matchRef = await addDoc(collection(db, COLLECTIONS.THREE_WAY_MATCHES), matchData);

    // Save line items and discrepancies
    const batch = writeBatch(db);

    matchLineItems.forEach((lineItem) => {
      const lineRef = doc(collection(db, COLLECTIONS.MATCH_LINE_ITEMS));
      batch.set(lineRef, {
        ...lineItem,
        threeWayMatchId: matchRef.id,
      });
    });

    discrepancies.forEach((discrepancy) => {
      const discRef = doc(collection(db, COLLECTIONS.MATCH_DISCREPANCIES));
      batch.set(discRef, {
        ...discrepancy,
        threeWayMatchId: matchRef.id,
      });
    });

    await batch.commit();

    logger.info('3-way match created', {
      matchId: matchRef.id,
      status,
      matchPercentage: overallMatchPercentage,
      discrepancyCount: discrepancies.length,
    });

    return matchRef.id;
  } catch (error) {
    logger.error('Failed to perform 3-way match', {
      error,
      purchaseOrderId,
      goodsReceiptId,
      vendorBillId,
    });
    throw error;
  }
}

/**
 * Get match status for a vendor bill
 */
export async function getMatchStatus(
  db: Firestore,
  vendorBillId: string
): Promise<ThreeWayMatch | null> {
  try {
    const matchesRef = collection(db, COLLECTIONS.THREE_WAY_MATCHES);
    const q = query(
      matchesRef,
      where('vendorBillId', '==', vendorBillId),
      orderBy('matchedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }

    return {
      id: firstDoc.id,
      ...firstDoc.data(),
    } as ThreeWayMatch;
  } catch (error) {
    logger.error('Failed to get match status', { error, vendorBillId });
    throw error;
  }
}

/**
 * Get match line items
 */
export async function getMatchLineItems(
  db: Firestore,
  threeWayMatchId: string
): Promise<MatchLineItem[]> {
  try {
    const lineItemsRef = collection(db, COLLECTIONS.MATCH_LINE_ITEMS);
    const q = query(
      lineItemsRef,
      where('threeWayMatchId', '==', threeWayMatchId),
      orderBy('lineNumber', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MatchLineItem[];
  } catch (error) {
    logger.error('Failed to get match line items', { error, threeWayMatchId });
    throw error;
  }
}

/**
 * Get match discrepancies
 */
export async function getMatchDiscrepancies(
  db: Firestore,
  threeWayMatchId: string
): Promise<MatchDiscrepancy[]> {
  try {
    const discrepanciesRef = collection(db, COLLECTIONS.MATCH_DISCREPANCIES);
    const q = query(discrepanciesRef, where('threeWayMatchId', '==', threeWayMatchId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MatchDiscrepancy[];
  } catch (error) {
    logger.error('Failed to get match discrepancies', { error, threeWayMatchId });
    throw error;
  }
}

/**
 * Resolve a discrepancy
 */
export async function resolveDiscrepancy(
  db: Firestore,
  discrepancyId: string,
  resolution: MatchDiscrepancy['resolution'],
  userId: string,
  userName: string,
  notes?: string
): Promise<void> {
  try {
    const discrepancyRef = doc(db, COLLECTIONS.MATCH_DISCREPANCIES, discrepancyId);

    await writeBatch(db)
      .update(discrepancyRef, {
        resolved: true,
        resolution,
        resolvedBy: userId,
        resolvedByName: userName,
        resolvedAt: serverTimestamp(),
        resolutionNotes: notes || '',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      .commit();

    logger.info('Discrepancy resolved', { discrepancyId, resolution });
  } catch (error) {
    logger.error('Failed to resolve discrepancy', { error, discrepancyId });
    throw error;
  }
}

/**
 * Approve a match
 */
export async function approveMatch(
  db: Firestore,
  matchId: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  try {
    const matchRef = doc(db, COLLECTIONS.THREE_WAY_MATCHES, matchId);

    await writeBatch(db)
      .update(matchRef, {
        approvalStatus: 'APPROVED',
        approvedBy: userId,
        approvedByName: userName,
        approvedAt: serverTimestamp(),
        approvalComments: comments || '',
        resolved: true,
        resolvedBy: userId,
        resolvedAt: serverTimestamp(),
        status: 'APPROVED_WITH_VARIANCE',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      .commit();

    logger.info('Match approved', { matchId, approvedBy: userName });
  } catch (error) {
    logger.error('Failed to approve match', { error, matchId });
    throw error;
  }
}

/**
 * Reject a match
 */
export async function rejectMatch(
  db: Firestore,
  matchId: string,
  userId: string,
  userName: string,
  reason: string
): Promise<void> {
  try {
    const matchRef = doc(db, COLLECTIONS.THREE_WAY_MATCHES, matchId);

    await writeBatch(db)
      .update(matchRef, {
        approvalStatus: 'REJECTED',
        approvedBy: userId,
        approvedByName: userName,
        approvedAt: serverTimestamp(),
        approvalComments: reason,
        status: 'REJECTED',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
      .commit();

    logger.info('Match rejected', { matchId, rejectedBy: userName });
  } catch (error) {
    logger.error('Failed to reject match', { error, matchId });
    throw error;
  }
}

/**
 * Get matching history for a purchase order
 */
export async function getMatchHistory(
  db: Firestore,
  purchaseOrderId: string
): Promise<ThreeWayMatch[]> {
  try {
    const matchesRef = collection(db, COLLECTIONS.THREE_WAY_MATCHES);
    const q = query(
      matchesRef,
      where('purchaseOrderId', '==', purchaseOrderId),
      orderBy('matchedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ThreeWayMatch[];
  } catch (error) {
    logger.error('Failed to get match history', { error, purchaseOrderId });
    throw error;
  }
}

/**
 * Get default tolerance configuration
 */
export async function getDefaultToleranceConfig(
  db: Firestore
): Promise<MatchToleranceConfig | null> {
  try {
    const configsRef = collection(db, COLLECTIONS.MATCH_TOLERANCE_CONFIGS);
    const q = query(configsRef, where('isDefault', '==', true), where('isActive', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }

    return {
      id: firstDoc.id,
      ...firstDoc.data(),
    } as MatchToleranceConfig;
  } catch (error) {
    logger.error('Failed to get default tolerance config', { error });
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getPurchaseOrder(db: Firestore, id: string): Promise<PurchaseOrder | null> {
  const docRef = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, id));
  if (!docRef.exists()) return null;
  return { id: docRef.id, ...docRef.data() } as PurchaseOrder;
}

async function getGoodsReceipt(db: Firestore, id: string): Promise<GoodsReceipt | null> {
  const docRef = await getDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, id));
  if (!docRef.exists()) return null;
  return { id: docRef.id, ...docRef.data() } as GoodsReceipt;
}

async function getVendorBill(db: Firestore, id: string): Promise<VendorBill | null> {
  const docRef = await getDoc(doc(db, 'transactions', id));
  if (!docRef.exists()) return null;
  return { id: docRef.id, ...docRef.data() } as VendorBill;
}

async function getPurchaseOrderItems(db: Firestore, poId: string): Promise<PurchaseOrderItem[]> {
  const itemsRef = collection(db, COLLECTIONS.PURCHASE_ORDER_ITEMS);
  const q = query(itemsRef, where('purchaseOrderId', '==', poId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PurchaseOrderItem[];
}

async function getGoodsReceiptItems(db: Firestore, grId: string): Promise<GoodsReceiptItem[]> {
  const itemsRef = collection(db, COLLECTIONS.GOODS_RECEIPT_ITEMS);
  const q = query(itemsRef, where('goodsReceiptId', '==', grId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as GoodsReceiptItem[];
}

function checkQuantityTolerance(
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

function checkPriceTolerance(
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

function checkAmountTolerance(
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

function createDiscrepancy(
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
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
    createdBy: userId,
    updatedBy: userId,
  };
}
