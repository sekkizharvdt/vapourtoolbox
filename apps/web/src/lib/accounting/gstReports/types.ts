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
 * Firestore Invoice Document Interface
 * Represents the structure of invoice documents in Firestore
 */
export interface FirestoreInvoiceDocument {
  date: Timestamp | { toDate: () => Date };
  customerGSTIN?: string;
  transactionNumber?: string;
  entityName?: string;
  totalAmount?: number;
  subtotal?: number;
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
