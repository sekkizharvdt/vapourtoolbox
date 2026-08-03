/**
 * GST Reports Type Definitions
 *
 * Type definitions for GST compliance reports (GSTR-1, GSTR-2, GSTR-3B)
 */

import type { Timestamp } from 'firebase/firestore';

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
 * Export invoice detail for GSTR-1 (zero-rated foreign-currency supplies).
 * INR figures are converted via the invoice's exchange rate; the original
 * currency amounts are kept for reference.
 */
export interface ExportInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  customerName: string;
  currency: string;
  /** Invoice total in the invoice's own currency */
  invoiceValueForeign: number;
  exchangeRate: number;
  /** Invoice total in INR (baseAmount) */
  invoiceValue: number;
  /** Taxable value in INR */
  taxableValue: number;
  /** GST on exports is typically zero-rated under LUT; actual amounts kept visible */
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
  /** Zero-rated foreign-currency supplies (feedback 8nhNyK6GltVSA9m9nIbM) */
  exports: {
    invoices: ExportInvoice[];
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
  /** Where the input credit came from — journal entries carry no vendor bill */
  source?: 'BILL' | 'JOURNAL';
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
 * Firestore Invoice Document Interface
 * Represents the structure of invoice documents in Firestore
 */
export interface FirestoreInvoiceDocument {
  date: Timestamp | { toDate: () => Date };
  customerGSTIN?: string;
  transactionNumber?: string;
  entityName?: string;
  /** Amounts below are in `currency`; INR value lives in baseAmount */
  totalAmount?: number;
  subtotal?: number;
  currency?: string;
  exchangeRate?: number;
  /** Invoice total in INR */
  baseAmount?: number;
  gstDetails?: {
    gstType: 'CGST_SGST' | 'IGST';
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
  };
  lineItems?: Array<{
    hsnCode?: string;
    description?: string;
    quantity?: number;
    amount?: number;
    gstRate?: number;
  }>;
}

/**
 * Firestore Bill Document Interface
 * Represents the structure of bill documents in Firestore
 */
export interface FirestoreBillDocument {
  date: Timestamp | { toDate: () => Date };
  transactionNumber?: string;
  entityName?: string;
  vendorGSTIN?: string;
  totalAmount?: number;
  subtotal?: number;
  gstDetails?: {
    gstType: 'CGST_SGST' | 'IGST';
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
  };
}
