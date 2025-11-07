/**
 * GST Report Generator
 *
 * Generates GST returns data for GSTR-1, GSTR-2, and GSTR-3B
 * according to Indian GST compliance requirements.
 *
 * Phase 6: GST Compliance Reports
 */

import type { Firestore } from 'firebase/firestore';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

/**
 * GST Summary structure for aggregated data
 */
export interface GSTSummary {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
  transactionCount: number;
}

/**
 * B2B Invoice detail for GSTR-1
 */
export interface B2BInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  customerName: string;
  customerGSTIN: string;
  placeOfSupply: string;
  reverseCharge: boolean;
  invoiceValue: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/**
 * B2C Invoice detail for GSTR-1
 */
export interface B2CInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  placeOfSupply: string;
  invoiceValue: number;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/**
 * HSN Summary for GSTR-1
 */
export interface HSNSummary {
  hsnCode: string;
  description: string;
  uqc: string; // Unit of Quantity Code
  totalQuantity: number;
  totalValue: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/**
 * GSTR-1 Data (Outward Supplies)
 */
export interface GSTR1Data {
  period: {
    month: number;
    year: number;
  };
  gstin: string;
  legalName: string;
  b2b: {
    invoices: B2BInvoice[];
    summary: GSTSummary;
  };
  b2c: {
    invoices: B2CInvoice[];
    summary: GSTSummary;
  };
  hsnSummary: HSNSummary[];
  total: GSTSummary;
}

/**
 * GSTR-2 Purchase detail
 */
export interface PurchaseDetail {
  id: string;
  billNumber: string;
  billDate: Date;
  vendorName: string;
  vendorGSTIN: string;
  placeOfSupply: string;
  reverseCharge: boolean;
  billValue: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/**
 * GSTR-2 Data (Inward Supplies)
 */
export interface GSTR2Data {
  period: {
    month: number;
    year: number;
  };
  purchases: {
    bills: PurchaseDetail[];
    summary: GSTSummary;
  };
  reverseCharge: {
    bills: PurchaseDetail[];
    summary: GSTSummary;
  };
  total: GSTSummary;
}

/**
 * GSTR-3B Data (Monthly Summary)
 */
export interface GSTR3BData {
  period: {
    month: number;
    year: number;
  };
  gstin: string;
  legalName: string;
  outwardSupplies: GSTSummary;
  inwardSupplies: GSTSummary;
  itcAvailable: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
  itcReversed: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
  netITC: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
  interestLatePayment: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
  gstPayable: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
}

/**
 * Create empty GST summary
 */
function createEmptyGSTSummary(): GSTSummary {
  return {
    taxableValue: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: 0,
    transactionCount: 0,
  };
}

/**
 * Calculate GST from line items
 */
function calculateGSTFromLineItems(gstDetails?: {
  gstType: 'CGST_SGST' | 'IGST';
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
}): { cgst: number; sgst: number; igst: number } {
  if (!gstDetails) {
    return { cgst: 0, sgst: 0, igst: 0 };
  }

  if (gstDetails.gstType === 'CGST_SGST') {
    return {
      cgst: gstDetails.cgstAmount || 0,
      sgst: gstDetails.sgstAmount || 0,
      igst: 0,
    };
  } else {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstDetails.igstAmount || 0,
    };
  }
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice = doc.data() as any;
    const gst = calculateGSTFromLineItems(invoice.gstDetails);

    // Convert Timestamp to Date if needed
    const invoiceDate = invoice.date?.toDate ? invoice.date.toDate() : new Date(invoice.date);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (invoice.lineItems || []).forEach((item: any) => {
      const hsnCode = item.hsnCode || 'UNCLASSIFIED';
      const existing = hsnMap.get(hsnCode);
      const itemGST = (item.amount * (item.gstRate ?? 0)) / 100;

      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalValue += item.amount;
        existing.taxableValue += item.amount;
        if (gst.cgst > 0) {
          existing.cgst += itemGST / 2;
          existing.sgst += itemGST / 2;
        } else {
          existing.igst += itemGST;
        }
      } else {
        hsnMap.set(hsnCode, {
          hsnCode,
          description: item.description,
          uqc: 'NOS', // Default: Numbers
          totalQuantity: item.quantity,
          totalValue: item.amount,
          taxableValue: item.amount,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bill = doc.data() as any;
    const gst = calculateGSTFromLineItems(bill.gstDetails);

    // Convert Timestamp to Date if needed
    const billDate = bill.date?.toDate ? bill.date.toDate() : new Date(bill.date);
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

/**
 * Export GSTR-1 to JSON format compatible with GST portal
 */
export function exportGSTR1ToJSON(data: GSTR1Data): string {
  const json = {
    gstin: data.gstin,
    fp: `${data.period.month.toString().padStart(2, '0')}${data.period.year}`,
    b2b: data.b2b.invoices.map((inv) => ({
      ctin: inv.customerGSTIN,
      inv: [
        {
          inum: inv.invoiceNumber,
          idt: inv.invoiceDate.toISOString().split('T')[0],
          val: inv.invoiceValue,
          pos: inv.placeOfSupply,
          rchrg: inv.reverseCharge ? 'Y' : 'N',
          inv_typ: 'R',
          itms: [
            {
              num: 1,
              itm_det: {
                txval: inv.taxableValue,
                rt: ((inv.cgst + inv.sgst + inv.igst) / inv.taxableValue) * 100,
                camt: inv.cgst,
                samt: inv.sgst,
                iamt: inv.igst,
                csamt: inv.cess,
              },
            },
          ],
        },
      ],
    })),
    b2cl: data.b2c.invoices
      .filter((inv) => inv.invoiceValue > 250000)
      .map((inv) => ({
        pos: inv.placeOfSupply,
        inv: [
          {
            inum: inv.invoiceNumber,
            idt: inv.invoiceDate.toISOString().split('T')[0],
            val: inv.invoiceValue,
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: inv.taxableValue,
                  rt: inv.gstRate,
                  camt: inv.cgst,
                  samt: inv.sgst,
                  iamt: inv.igst,
                  csamt: inv.cess,
                },
              },
            ],
          },
        ],
      })),
    b2cs: [
      {
        typ: 'OE',
        pos: '27', // Default - would need actual place of supply
        sply_ty: 'INTRA',
        rt: 18,
        txval: data.b2c.summary.taxableValue,
        camt: data.b2c.summary.cgst,
        samt: data.b2c.summary.sgst,
        iamt: data.b2c.summary.igst,
        csamt: data.b2c.summary.cess,
      },
    ],
    hsn: {
      data: data.hsnSummary.map((hsn) => ({
        hsn_sc: hsn.hsnCode,
        desc: hsn.description,
        uqc: hsn.uqc,
        qty: hsn.totalQuantity,
        val: hsn.totalValue,
        txval: hsn.taxableValue,
        camt: hsn.cgst,
        samt: hsn.sgst,
        iamt: hsn.igst,
        csamt: hsn.cess,
      })),
    },
  };

  return JSON.stringify(json, null, 2);
}

/**
 * Export GSTR-3B to JSON format compatible with GST portal
 */
export function exportGSTR3BToJSON(data: GSTR3BData): string {
  const json = {
    gstin: data.gstin,
    ret_period: `${data.period.month.toString().padStart(2, '0')}${data.period.year}`,
    sup_details: {
      osup_det: {
        txval: data.outwardSupplies.taxableValue,
        iamt: data.outwardSupplies.igst,
        camt: data.outwardSupplies.cgst,
        samt: data.outwardSupplies.sgst,
        csamt: data.outwardSupplies.cess,
      },
    },
    inter_sup: {
      unreg_details: [],
      comp_details: [],
      uin_details: [],
    },
    itc_elg: {
      itc_avl: [
        {
          ty: 'IMPG',
          iamt: data.itcAvailable.igst,
          camt: data.itcAvailable.cgst,
          samt: data.itcAvailable.sgst,
          csamt: data.itcAvailable.cess,
        },
      ],
      itc_rev: [
        {
          ty: 'RUL',
          iamt: data.itcReversed.igst,
          camt: data.itcReversed.cgst,
          samt: data.itcReversed.sgst,
          csamt: data.itcReversed.cess,
        },
      ],
      itc_net: {
        iamt: data.netITC.igst,
        camt: data.netITC.cgst,
        samt: data.netITC.sgst,
        csamt: data.netITC.cess,
      },
    },
    inward_sup: {
      isup_details: [
        {
          ty: 'GST',
          inter: data.inwardSupplies.igst > 0 ? data.inwardSupplies.taxableValue : 0,
          intra: data.inwardSupplies.cgst > 0 ? data.inwardSupplies.taxableValue : 0,
        },
      ],
    },
    interest: {
      intr_details: {
        iamt: data.interestLatePayment.igst,
        camt: data.interestLatePayment.cgst,
        samt: data.interestLatePayment.sgst,
        csamt: data.interestLatePayment.cess,
      },
    },
  };

  return JSON.stringify(json, null, 2);
}
