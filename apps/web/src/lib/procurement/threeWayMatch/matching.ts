/**
 * Three-Way Match Core Logic
 *
 * Main matching algorithm for PO, GR, and Vendor Invoice
 */

import { collection, doc, addDoc, type Firestore, Timestamp, writeBatch } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { ThreeWayMatch, MatchLineItem, MatchDiscrepancy } from '@vapour/types';
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

      // Find corresponding GR item (only if we found a PO item)
      const grItem = poItem ? grItems.find((item) => item.poItemId === poItem.id) : undefined;

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

      if (!priceWithinTolerance && Math.abs(priceVariance) > CURRENCY_EPSILON) {
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
      matchedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
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
