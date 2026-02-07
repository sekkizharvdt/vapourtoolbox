/**
 * Three-Way Match Core Logic
 *
 * Main matching algorithm for PO, GR, and Vendor Invoice
 */

import { collection, doc, addDoc, type Firestore, Timestamp, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { ThreeWayMatch, MatchLineItem, MatchDiscrepancy } from '@vapour/types';
import { requireAnyPermission, type AuthorizationContext } from '@/lib/auth/authorizationService';
import {
  getPurchaseOrder,
  getGoodsReceipt,
  getVendorBill,
  getPurchaseOrderItems,
  getGoodsReceiptItems,
  checkQuantityTolerance,
  checkPriceTolerance,
  checkAmountTolerance,
  createDiscrepancy,
} from './utils';
import { getDefaultToleranceConfig } from './queries';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'threeWayMatchService' });

// Epsilon for floating-point comparisons - use 0.005 for currency (half a paisa)
const CURRENCY_EPSILON = 0.005;

/**
 * Procurement permission flags for three-way match operations
 * User must have either CREATE_PO or APPROVE_PO permissions
 */
const MATCH_PERMISSIONS = [PERMISSION_FLAGS.MANAGE_PROCUREMENT] as const;

/**
 * Perform 3-way match between PO, GR, and Vendor Invoice
 *
 * @param db - Firestore instance
 * @param purchaseOrderId - Purchase Order ID
 * @param goodsReceiptId - Goods Receipt ID
 * @param vendorBillId - Vendor Bill ID
 * @param userId - User performing the match
 * @param userName - User's display name
 * @param matchType - Type of match (AUTOMATIC, MANUAL, SYSTEM_ASSISTED)
 * @param auth - Authorization context (optional for backward compatibility)
 * @returns Created match ID
 * @throws AuthorizationError if user lacks procurement permissions
 */
export async function performThreeWayMatch(
  db: Firestore,
  purchaseOrderId: string,
  goodsReceiptId: string,
  vendorBillId: string,
  userId: string,
  userName: string,
  matchType: 'AUTOMATIC' | 'MANUAL' | 'SYSTEM_ASSISTED' = 'AUTOMATIC',
  auth?: AuthorizationContext
): Promise<string> {
  // Check permission if auth context provided
  if (auth) {
    requireAnyPermission(
      auth.userPermissions,
      [...MATCH_PERMISSIONS],
      auth.userId,
      'perform three-way match'
    );
  }

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

    // Derive severity thresholds from tolerance config (2x tolerance = HIGH severity)
    const qtySeverityThreshold = toleranceConfig
      ? toleranceConfig.quantityTolerancePercent * 2
      : 10;
    const priceSeverityThreshold = toleranceConfig ? toleranceConfig.priceTolerancePercent * 2 : 5;

    // Perform line-level matching
    const matchLineItems: Omit<MatchLineItem, 'id'>[] = [];
    const discrepancies: Omit<MatchDiscrepancy, 'id'>[] = [];

    let matchedLines = 0;
    let unmatchedLines = 0;

    // Build lookup maps for O(1) access instead of O(n) find() in loop
    // Map GR items by PO item ID for quick lookup
    const grItemsByPoItemId = new Map(grItems.map((item) => [item.poItemId, item]));

    // Build a map for PO items by normalized description for fuzzy matching
    // This converts O(n*m) nested loops to O(n+m)
    const poItemsByNormalizedDesc = new Map<string, (typeof poItems)[0]>();
    const poItemDescWords = new Map<string, (typeof poItems)[0]>();
    poItems.forEach((item) => {
      const normalized = item.description.toLowerCase();
      poItemsByNormalizedDesc.set(normalized, item);
      // Also index by individual words for partial matching
      normalized.split(/\s+/).forEach((word) => {
        if (word.length > 3) {
          // Only index meaningful words
          poItemDescWords.set(word, item);
        }
      });
    });

    /**
     * Find matching PO item for an invoice line using pre-built maps
     */
    function findMatchingPoItem(invoiceDescription: string): (typeof poItems)[0] | undefined {
      const normalized = invoiceDescription.toLowerCase();

      // Try exact match first
      const exactMatch = poItemsByNormalizedDesc.get(normalized);
      if (exactMatch) return exactMatch;

      // Try to find by checking if invoice desc contains PO desc or vice versa
      for (const [poDesc, poItem] of poItemsByNormalizedDesc) {
        if (normalized.includes(poDesc) || poDesc.includes(normalized)) {
          return poItem;
        }
      }

      // Try matching by significant words
      const invoiceWords = normalized.split(/\s+/).filter((w) => w.length > 3);
      for (const word of invoiceWords) {
        const match = poItemDescWords.get(word);
        if (match) return match;
      }

      return undefined;
    }

    // Match invoice lines with PO and GR items
    vendorBill.lineItems.forEach((invoiceLine, index) => {
      // Find corresponding PO item using optimized lookup
      const poItem = findMatchingPoItem(invoiceLine.description);

      // Find corresponding GR item using Map lookup - O(1) instead of O(n)
      const grItem = poItem ? grItemsByPoItemId.get(poItem.id) : undefined;

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
        quantityMatched: Math.abs(qtyVariance) < CURRENCY_EPSILON,
        quantityVariance: qtyVariance,
        quantityVariancePercentage: qtyVariancePercent,
        unit: poItem.unit,
        poUnitPrice: poItem.unitPrice,
        invoiceUnitPrice: invoiceLine.unitPrice,
        priceMatched: Math.abs(priceVariance) < CURRENCY_EPSILON,
        priceVariance,
        priceVariancePercentage: priceVariancePercent,
        poLineTotal,
        grLineTotal,
        invoiceLineTotal,
        amountMatched: Math.abs(amountVariance) < CURRENCY_EPSILON,
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
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Create line-level discrepancies
      if (!qtyWithinTolerance && Math.abs(qtyVariance) > CURRENCY_EPSILON) {
        matchLineItem.discrepancyTypes.push('QUANTITY_MISMATCH');
        discrepancies.push(
          createDiscrepancy(
            '',
            undefined,
            'QUANTITY_MISMATCH',
            Math.abs(qtyVariancePercent) > qtySeverityThreshold ? 'HIGH' : 'MEDIUM',
            `Quantity variance: ${qtyVariance.toFixed(2)} ${poItem.unit} (${qtyVariancePercent.toFixed(1)}%)`,
            'quantity',
            grItem.receivedQuantity.toString(),
            invoiceLine.quantity.toString(),
            qtyVariance,
            qtyVariancePercent,
            Math.abs(amountVariance),
            Math.abs(qtyVariancePercent) > qtySeverityThreshold,
            userId,
            userName
          )
        );
      }

      if (!priceWithinTolerance && Math.abs(priceVariance) > CURRENCY_EPSILON) {
        matchLineItem.discrepancyTypes.push('PRICE_MISMATCH');
        discrepancies.push(
          createDiscrepancy(
            '',
            undefined,
            'PRICE_MISMATCH',
            Math.abs(priceVariancePercent) > priceSeverityThreshold ? 'HIGH' : 'MEDIUM',
            `Unit price variance: ₹${priceVariance.toFixed(2)} (${priceVariancePercent.toFixed(1)}%)`,
            'unitPrice',
            poItem.unitPrice.toString(),
            invoiceLine.unitPrice.toString(),
            priceVariance,
            priceVariancePercent,
            Math.abs(amountVariance),
            Math.abs(priceVariancePercent) > priceSeverityThreshold,
            userId,
            userName
          )
        );
      }

      if (!amountWithinTolerance && Math.abs(amountVariance) > CURRENCY_EPSILON) {
        matchLineItem.discrepancyTypes.push('AMOUNT_MISMATCH');
      }

      matchLineItems.push(matchLineItem);
    });

    // Calculate overall match percentage
    const totalLines = matchLineItems.length;
    const overallMatchPercentage = totalLines > 0 ? (matchedLines / totalLines) * 100 : 0;

    // Calculate financial summary
    const poAmount = po.grandTotal;
    // Build PO items lookup by ID for efficient access
    const poItemsById = new Map(poItems.map((item) => [item.id, item]));
    // Calculate GR amount using PO unit prices - O(n) with Map lookup
    const grAmount = grItems.reduce((sum, grItem) => {
      const poItem = poItemsById.get(grItem.poItemId);
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
      matchedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      updatedBy: userId,
    };

    // Remove undefined values before sending to Firestore
    const cleanedMatchData = Object.fromEntries(
      Object.entries(matchData).filter(([, value]) => value !== undefined)
    );

    // Save to Firestore
    const matchRef = await addDoc(collection(db, COLLECTIONS.THREE_WAY_MATCHES), cleanedMatchData);

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

    // Audit log: Match created
    const auditContext = createAuditContext(userId, '', userName);
    await logAuditEvent(
      db,
      auditContext,
      'MATCH_CREATED',
      'THREE_WAY_MATCH',
      matchRef.id,
      `Created 3-way match for PO ${po.number}, GR ${gr.number}`,
      {
        entityName: matchData.matchNumber,
        metadata: {
          purchaseOrderId,
          poNumber: po.number,
          goodsReceiptId,
          grNumber: gr.number,
          vendorBillNumber: vendorBill.transactionNumber,
          vendorName: po.vendorName,
          status,
          overallMatchPercentage,
          discrepancyCount: discrepancies.length,
          invoiceAmount,
          variance,
        },
      }
    );

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
