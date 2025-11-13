/**
 * GST Report Generators
 *
 * Functions to generate GSTR-1, GSTR-2, and GSTR-3B reports
 */

import type { Firestore, Timestamp } from 'firebase/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  GSTR1Data,
  GSTR2Data,
  GSTR3BData,
  B2BInvoice,
  B2CInvoice,
  HSNSummary,
  PurchaseDetail,
  GSTSummary,
  FirestoreInvoiceDocument,
  FirestoreBillDocument,
} from './types';
import { createEmptyGSTSummary, calculateGSTFromLineItems } from './utils';

/**
 * Generate GSTR-1 Report (Outward Supplies - Sales/Invoices)
 */
export async function generateGSTR1(
  db: Firestore,
  start: Timestamp,
  end: Timestamp,
  gstin?: string,
  legalName?: string
): Promise<GSTR1Data> {
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const q = query(
    transactionsRef,
    where('type', '==', 'CUSTOMER_INVOICE'),
    where('status', 'in', ['POSTED', 'APPROVED']),
    where('date', '>=', start),
    where('date', '<=', end)
  );

  const snapshot = await getDocs(q);
  const b2bInvoices: B2BInvoice[] = [];
  const b2cInvoices: B2CInvoice[] = [];
  const hsnMap = new Map<string, HSNSummary>();

  const b2bSummary = createEmptyGSTSummary();
  const b2cSummary = createEmptyGSTSummary();

  snapshot.forEach((doc) => {
    const invoice = doc.data() as unknown as FirestoreInvoiceDocument;
    const gst = calculateGSTFromLineItems(invoice.gstDetails);

    // Convert Timestamp to Date if needed
    const invoiceDate =
      'toDate' in invoice.date && typeof invoice.date.toDate === 'function'
        ? invoice.date.toDate()
        : new Date();
    const isB2B = invoice.customerGSTIN && invoice.customerGSTIN.length > 0;

    if (isB2B) {
      // B2B Invoice
      b2bInvoices.push({
        id: doc.id,
        invoiceNumber: invoice.transactionNumber || doc.id,
        invoiceDate,
        customerName: invoice.entityName || '',
        customerGSTIN: invoice.customerGSTIN || '',
        placeOfSupply: '', // Not in current schema
        reverseCharge: false,
        invoiceValue: invoice.totalAmount || 0,
        taxableValue: invoice.subtotal || 0,
        cgst: gst.cgst,
        sgst: gst.sgst,
        igst: gst.igst,
        cess: 0,
      });

      b2bSummary.taxableValue += invoice.subtotal || 0;
      b2bSummary.cgst += gst.cgst;
      b2bSummary.sgst += gst.sgst;
      b2bSummary.igst += gst.igst;
      b2bSummary.total += gst.cgst + gst.sgst + gst.igst;
      b2bSummary.transactionCount++;
    } else {
      // B2C Invoice
      const gstRate = invoice.lineItems?.[0]?.gstRate ?? 0;
      b2cInvoices.push({
        id: doc.id,
        invoiceNumber: invoice.transactionNumber || doc.id,
        invoiceDate,
        placeOfSupply: '', // Not in current schema
        invoiceValue: invoice.totalAmount || 0,
        taxableValue: invoice.subtotal || 0,
        gstRate,
        cgst: gst.cgst,
        sgst: gst.sgst,
        igst: gst.igst,
        cess: 0,
      });

      b2cSummary.taxableValue += invoice.subtotal || 0;
      b2cSummary.cgst += gst.cgst;
      b2cSummary.sgst += gst.sgst;
      b2cSummary.igst += gst.igst;
      b2cSummary.total += gst.cgst + gst.sgst + gst.igst;
      b2cSummary.transactionCount++;
    }

    // Process HSN summary
    (invoice.lineItems || []).forEach((item) => {
      const hsnCode = item.hsnCode || 'UNCLASSIFIED';
      const existing = hsnMap.get(hsnCode);
      const itemAmount = item.amount ?? 0;
      const itemQuantity = item.quantity ?? 0;
      const itemGST = (itemAmount * (item.gstRate ?? 0)) / 100;

      if (existing) {
        existing.totalQuantity += itemQuantity;
        existing.totalValue += itemAmount;
        existing.taxableValue += itemAmount;
        if (gst.cgst > 0) {
          existing.cgst += itemGST / 2;
          existing.sgst += itemGST / 2;
        } else {
          existing.igst += itemGST;
        }
      } else {
        hsnMap.set(hsnCode, {
          hsnCode,
          description: item.description || '',
          uqc: 'NOS', // Default: Numbers
          totalQuantity: itemQuantity,
          totalValue: itemAmount,
          taxableValue: itemAmount,
          cgst: gst.cgst > 0 ? itemGST / 2 : 0,
          sgst: gst.cgst > 0 ? itemGST / 2 : 0,
          igst: gst.igst > 0 ? itemGST : 0,
          cess: 0,
        });
      }
    });
  });

  const total: GSTSummary = {
    taxableValue: b2bSummary.taxableValue + b2cSummary.taxableValue,
    cgst: b2bSummary.cgst + b2cSummary.cgst,
    sgst: b2bSummary.sgst + b2cSummary.sgst,
    igst: b2bSummary.igst + b2cSummary.igst,
    cess: b2bSummary.cess + b2cSummary.cess,
    total: b2bSummary.total + b2cSummary.total,
    transactionCount: b2bSummary.transactionCount + b2cSummary.transactionCount,
  };

  const startDate = start.toDate();

  return {
    period: {
      month: startDate.getMonth() + 1,
      year: startDate.getFullYear(),
    },
    gstin: gstin || '',
    legalName: legalName || '',
    b2b: {
      invoices: b2bInvoices,
      summary: b2bSummary,
    },
    b2c: {
      invoices: b2cInvoices,
      summary: b2cSummary,
    },
    hsnSummary: Array.from(hsnMap.values()),
    total,
  };
}

/**
 * Generate GSTR-2 Report (Inward Supplies - Purchases/Bills)
 */
export async function generateGSTR2(
  db: Firestore,
  start: Timestamp,
  end: Timestamp
): Promise<GSTR2Data> {
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const q = query(
    transactionsRef,
    where('type', '==', 'VENDOR_BILL'),
    where('status', 'in', ['POSTED', 'APPROVED']),
    where('date', '>=', start),
    where('date', '<=', end)
  );

  const snapshot = await getDocs(q);
  const purchases: PurchaseDetail[] = [];
  const reverseChargeBills: PurchaseDetail[] = [];

  const purchasesSummary = createEmptyGSTSummary();
  const reverseChargeSummary = createEmptyGSTSummary();

  snapshot.forEach((doc) => {
    const bill = doc.data() as unknown as FirestoreBillDocument;
    const gst = calculateGSTFromLineItems(bill.gstDetails);

    // Convert Timestamp to Date if needed
    const billDate =
      'toDate' in bill.date && typeof bill.date.toDate === 'function'
        ? bill.date.toDate()
        : new Date();
    const isReverseCharge = false; // Not in current schema

    const purchaseDetail: PurchaseDetail = {
      id: doc.id,
      billNumber: bill.transactionNumber || doc.id,
      billDate,
      vendorName: bill.entityName || '',
      vendorGSTIN: bill.vendorGSTIN || '',
      placeOfSupply: '', // Not in current schema
      reverseCharge: isReverseCharge,
      billValue: bill.totalAmount || 0,
      taxableValue: bill.subtotal || 0,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      cess: 0,
    };

    if (isReverseCharge) {
      reverseChargeBills.push(purchaseDetail);
      reverseChargeSummary.taxableValue += bill.subtotal || 0;
      reverseChargeSummary.cgst += gst.cgst;
      reverseChargeSummary.sgst += gst.sgst;
      reverseChargeSummary.igst += gst.igst;
      reverseChargeSummary.total += gst.cgst + gst.sgst + gst.igst;
      reverseChargeSummary.transactionCount++;
    } else {
      purchases.push(purchaseDetail);
      purchasesSummary.taxableValue += bill.subtotal || 0;
      purchasesSummary.cgst += gst.cgst;
      purchasesSummary.sgst += gst.sgst;
      purchasesSummary.igst += gst.igst;
      purchasesSummary.total += gst.cgst + gst.sgst + gst.igst;
      purchasesSummary.transactionCount++;
    }
  });

  const total: GSTSummary = {
    taxableValue: purchasesSummary.taxableValue + reverseChargeSummary.taxableValue,
    cgst: purchasesSummary.cgst + reverseChargeSummary.cgst,
    sgst: purchasesSummary.sgst + reverseChargeSummary.sgst,
    igst: purchasesSummary.igst + reverseChargeSummary.igst,
    cess: purchasesSummary.cess + reverseChargeSummary.cess,
    total: purchasesSummary.total + reverseChargeSummary.total,
    transactionCount: purchasesSummary.transactionCount + reverseChargeSummary.transactionCount,
  };

  const startDate = start.toDate();

  return {
    period: {
      month: startDate.getMonth() + 1,
      year: startDate.getFullYear(),
    },
    purchases: {
      bills: purchases,
      summary: purchasesSummary,
    },
    reverseCharge: {
      bills: reverseChargeBills,
      summary: reverseChargeSummary,
    },
    total,
  };
}

/**
 * Generate GSTR-3B Report (Monthly Summary)
 */
export async function generateGSTR3B(
  db: Firestore,
  start: Timestamp,
  end: Timestamp,
  gstin?: string,
  legalName?: string
): Promise<GSTR3BData> {
  // Generate GSTR-1 and GSTR-2 data
  const gstr1 = await generateGSTR1(db, start, end, gstin, legalName);
  const gstr2 = await generateGSTR2(db, start, end);

  // Calculate ITC (Input Tax Credit) available
  const itcAvailable = {
    cgst: gstr2.total.cgst,
    sgst: gstr2.total.sgst,
    igst: gstr2.total.igst,
    cess: gstr2.total.cess,
    total: gstr2.total.total,
  };

  // ITC Reversed (simplified - can be enhanced based on specific rules)
  const itcReversed = {
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: 0,
  };

  // Net ITC
  const netITC = {
    cgst: itcAvailable.cgst - itcReversed.cgst,
    sgst: itcAvailable.sgst - itcReversed.sgst,
    igst: itcAvailable.igst - itcReversed.igst,
    cess: itcAvailable.cess - itcReversed.cess,
    total: itcAvailable.total - itcReversed.total,
  };

  // Interest for late payment (simplified - would need actual late payment data)
  const interestLatePayment = {
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: 0,
  };

  // GST Payable = Output GST - Input Tax Credit + Interest
  const gstPayable = {
    cgst: gstr1.total.cgst - netITC.cgst + interestLatePayment.cgst,
    sgst: gstr1.total.sgst - netITC.sgst + interestLatePayment.sgst,
    igst: gstr1.total.igst - netITC.igst + interestLatePayment.igst,
    cess: gstr1.total.cess - netITC.cess + interestLatePayment.cess,
    total: gstr1.total.total - netITC.total + interestLatePayment.total,
  };

  return {
    period: gstr1.period,
    gstin: gstin || '',
    legalName: legalName || '',
    outwardSupplies: gstr1.total,
    inwardSupplies: gstr2.total,
    itcAvailable,
    itcReversed,
    netITC,
    interestLatePayment,
    gstPayable,
  };
}
