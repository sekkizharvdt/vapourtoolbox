/**
 * TDS Report Generator
 *
 * Generates TDS reports and certificates for Indian tax compliance:
 * - Form 16A: TDS Certificate for payments other than salary
 * - Form 26Q: Quarterly TDS Return
 */

import { Firestore, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

/**
 * TDS Section codes as per Income Tax Act
 */
export const TDS_SECTIONS = {
  '194A': 'Interest other than on securities',
  '194C': 'Payment to contractors',
  '194H': 'Commission or brokerage',
  '194I': 'Rent',
  '194J': 'Professional or technical services',
  '194LA': 'Compensation on acquisition of immovable property',
  '194Q': 'Purchase of goods',
} as const;

export type TDSSection = keyof typeof TDS_SECTIONS;

/**
 * TDS Rate based on section
 */
export const TDS_RATES: Record<TDSSection, number> = {
  '194A': 10.0,
  '194C': 1.0, // Individual/HUF: 1%, Others: 2%
  '194H': 5.0,
  '194I': 10.0, // Rent (land/building/furniture)
  '194J': 10.0, // Professional services
  '194LA': 10.0,
  '194Q': 0.1,
};

/**
 * TDS Challan Details
 */
export interface TDSChallan {
  bsrCode: string; // Bank BSR code (7 digits)
  challanSerialNumber: string; // Challan identification number
  depositDate: Date;
  amount: number;
  tdsSection: TDSSection;
  assessmentYear: string; // e.g., "2024-25"
  quarter: 1 | 2 | 3 | 4;
}

/**
 * Deductee Details (Person from whom TDS is deducted)
 */
export interface TDSDeductee {
  name: string;
  pan: string; // Permanent Account Number
  address: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * TDS Transaction Entry
 */
export interface TDSTransaction {
  id: string;
  deducteeId: string;
  deducteeName: string;
  deducteePAN: string;
  paymentDate: Date;
  paymentAmount: number;
  tdsAmount: number;
  tdsSection: TDSSection;
  tdsRate: number;
  natureOfPayment: string;
  challan?: TDSChallan;
  quarter: 1 | 2 | 3 | 4;
  financialYear: string;
  assessmentYear: string;
  bookingDate?: Date;
  certificateNumber?: string; // Form 16A certificate number
}

/**
 * Form 16A Data (TDS Certificate)
 */
export interface Form16AData {
  deductor: {
    name: string;
    tan: string; // Tax Deduction Account Number
    pan: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  deductee: TDSDeductee;
  quarter: 1 | 2 | 3 | 4;
  financialYear: string;
  assessmentYear: string;
  transactions: TDSTransaction[];
  summary: {
    totalPayment: number;
    totalTDS: number;
    transactionCount: number;
  };
  challanDetails: TDSChallan[];
  certificateNumber: string;
  generatedDate: Date;
}

/**
 * Form 26Q Data (Quarterly TDS Return)
 */
export interface Form26QData {
  deductor: {
    name: string;
    tan: string;
    pan: string;
    address: string;
  };
  quarter: 1 | 2 | 3 | 4;
  financialYear: string;
  assessmentYear: string;
  transactions: TDSTransaction[];
  summary: {
    totalPayment: number;
    totalTDS: number;
    totalDeductees: number;
    totalTransactions: number;
    bySectionSummary: Array<{
      section: TDSSection;
      description: string;
      paymentAmount: number;
      tdsAmount: number;
      transactionCount: number;
    }>;
  };
  challanSummary: Array<{
    challan: TDSChallan;
    transactionCount: number;
    totalTDS: number;
  }>;
  generatedDate: Date;
}

/**
 * Get quarter from date
 */
export function getQuarter(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getMonth() + 1; // 1-12
  if (month >= 4 && month <= 6) return 1; // Apr-Jun
  if (month >= 7 && month <= 9) return 2; // Jul-Sep
  if (month >= 10 && month <= 12) return 3; // Oct-Dec
  return 4; // Jan-Mar
}

/**
 * Get financial year from date
 */
export function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(2)}`;
  }
  return `${year - 1}-${year.toString().slice(2)}`;
}

/**
 * Get assessment year from financial year
 */
export function getAssessmentYear(financialYear: string): string {
  const parts = financialYear.split('-');
  if (parts.length < 1 || !parts[0]) {
    throw new Error('Invalid financial year format');
  }
  const start = parseInt(parts[0], 10);
  return `${start + 1}-${(start + 2).toString().slice(2)}`;
}

/**
 * Get quarter date range
 */
export function getQuarterDateRange(
  quarter: 1 | 2 | 3 | 4,
  financialYear: string
): { start: Date; end: Date } {
  const parts = financialYear.split('-');
  if (parts.length < 1 || !parts[0]) {
    throw new Error('Invalid financial year format');
  }
  const startYear = parseInt(parts[0], 10);

  const quarterRanges: Record<number, { startMonth: number; endMonth: number; year: number }> = {
    1: { startMonth: 3, endMonth: 5, year: startYear }, // Apr-Jun
    2: { startMonth: 6, endMonth: 8, year: startYear }, // Jul-Sep
    3: { startMonth: 9, endMonth: 11, year: startYear }, // Oct-Dec
    4: { startMonth: 0, endMonth: 2, year: startYear + 1 }, // Jan-Mar
  };

  const range = quarterRanges[quarter];
  if (!range) {
    throw new Error('Invalid quarter');
  }
  const start = new Date(range.year, range.startMonth, 1);
  const end = new Date(range.year, range.endMonth + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

/**
 * Extract TDS transactions from vendor bills
 */
async function extractTDSTransactions(
  db: Firestore,
  startDate: Timestamp,
  endDate: Timestamp
): Promise<TDSTransaction[]> {
  const transactions: TDSTransaction[] = [];

  try {
    // Query vendor bills (transactions with type='BILL') with TDS within date range
    const billsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('type', '==', 'BILL'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      where('status', 'in', ['POSTED', 'APPROVED', 'PAID'])
    );

    const billsSnapshot = await getDocs(billsQuery);

    for (const doc of billsSnapshot.docs) {
      const bill = doc.data() as any;

      // Check if bill has TDS
      if (bill.tdsAmount && bill.tdsAmount > 0) {
        const paymentDate = bill.date?.toDate ? bill.date.toDate() : new Date(bill.date);
        const quarter = getQuarter(paymentDate);
        const financialYear = getFinancialYear(paymentDate);
        const assessmentYear = getAssessmentYear(financialYear);

        // Determine TDS section based on bill category or nature
        let tdsSection: TDSSection = '194J'; // Default to professional services
        if (bill.category?.includes('rent')) {
          tdsSection = '194I';
        } else if (bill.category?.includes('contract')) {
          tdsSection = '194C';
        } else if (bill.category?.includes('commission')) {
          tdsSection = '194H';
        }

        const tdsRate = bill.tdsRate || TDS_RATES[tdsSection];

        transactions.push({
          id: doc.id,
          deducteeId: bill.vendorId || '',
          deducteeName: bill.vendorName || 'Unknown Vendor',
          deducteePAN: bill.vendorPAN || '',
          paymentDate,
          paymentAmount: bill.total || 0,
          tdsAmount: bill.tdsAmount,
          tdsSection,
          tdsRate,
          natureOfPayment: TDS_SECTIONS[tdsSection],
          quarter,
          financialYear,
          assessmentYear,
          bookingDate: bill.createdAt?.toDate
            ? bill.createdAt.toDate()
            : new Date(bill.createdAt || Date.now()),
        });
      }
    }

    // Sort by payment date
    transactions.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());
  } catch (error) {
    console.error('[TDS] Error extracting TDS transactions:', error);
    throw error;
  }

  return transactions;
}

/**
 * Generate Form 16A (TDS Certificate)
 */
export async function generateForm16A(
  db: Firestore,
  deducteeId: string,
  quarter: 1 | 2 | 3 | 4,
  financialYear: string,
  deductorDetails: Form16AData['deductor']
): Promise<Form16AData> {
  try {
    const { start, end } = getQuarterDateRange(quarter, financialYear);
    const startTimestamp = Timestamp.fromDate(start);
    const endTimestamp = Timestamp.fromDate(end);

    // Get all TDS transactions
    const allTransactions = await extractTDSTransactions(db, startTimestamp, endTimestamp);

    // Filter transactions for this deductee
    const deducteeTransactions = allTransactions.filter((t) => t.deducteeId === deducteeId);

    if (deducteeTransactions.length === 0) {
      throw new Error('No TDS transactions found for this deductee in the selected quarter');
    }

    // Get deductee details from first transaction
    const firstTransaction = deducteeTransactions[0];
    if (!firstTransaction) {
      throw new Error('No transactions found for deductee');
    }

    // Fetch vendor/deductee details
    const deductee: TDSDeductee = {
      name: firstTransaction.deducteeName,
      pan: firstTransaction.deducteePAN,
      address: '', // Would fetch from vendor record
      city: '',
      state: '',
      pincode: '',
    };

    // Calculate summary
    const summary = {
      totalPayment: deducteeTransactions.reduce((sum, t) => sum + t.paymentAmount, 0),
      totalTDS: deducteeTransactions.reduce((sum, t) => sum + t.tdsAmount, 0),
      transactionCount: deducteeTransactions.length,
    };

    // Extract unique challans
    const challanMap = new Map<string, TDSChallan>();
    deducteeTransactions.forEach((t) => {
      if (t.challan) {
        challanMap.set(t.challan.challanSerialNumber, t.challan);
      }
    });

    const assessmentYear = getAssessmentYear(financialYear);
    const certificateNumber = `${deductorDetails.tan}/${financialYear}/Q${quarter}/${deducteeId.slice(-6)}`;

    return {
      deductor: deductorDetails,
      deductee,
      quarter,
      financialYear,
      assessmentYear,
      transactions: deducteeTransactions,
      summary,
      challanDetails: Array.from(challanMap.values()),
      certificateNumber,
      generatedDate: new Date(),
    };
  } catch (error) {
    console.error('[TDS] Error generating Form 16A:', error);
    throw error;
  }
}

/**
 * Generate Form 26Q (Quarterly TDS Return)
 */
export async function generateForm26Q(
  db: Firestore,
  quarter: 1 | 2 | 3 | 4,
  financialYear: string,
  deductorDetails: {
    name: string;
    tan: string;
    pan: string;
    address: string;
  }
): Promise<Form26QData> {
  try {
    const { start, end } = getQuarterDateRange(quarter, financialYear);
    const startTimestamp = Timestamp.fromDate(start);
    const endTimestamp = Timestamp.fromDate(end);

    // Get all TDS transactions for the quarter
    const transactions = await extractTDSTransactions(db, startTimestamp, endTimestamp);

    // Calculate summary by section
    const sectionSummaryMap = new Map<
      TDSSection,
      { paymentAmount: number; tdsAmount: number; transactionCount: number }
    >();

    transactions.forEach((t) => {
      const existing = sectionSummaryMap.get(t.tdsSection) || {
        paymentAmount: 0,
        tdsAmount: 0,
        transactionCount: 0,
      };
      existing.paymentAmount += t.paymentAmount;
      existing.tdsAmount += t.tdsAmount;
      existing.transactionCount += 1;
      sectionSummaryMap.set(t.tdsSection, existing);
    });

    const bySectionSummary = Array.from(sectionSummaryMap.entries()).map(([section, data]) => ({
      section,
      description: TDS_SECTIONS[section],
      ...data,
    }));

    // Calculate challan summary
    const challanSummaryMap = new Map<
      string,
      { challan: TDSChallan; transactionCount: number; totalTDS: number }
    >();

    transactions.forEach((t) => {
      if (t.challan) {
        const key = t.challan.challanSerialNumber;
        const existing = challanSummaryMap.get(key) || {
          challan: t.challan,
          transactionCount: 0,
          totalTDS: 0,
        };
        existing.transactionCount += 1;
        existing.totalTDS += t.tdsAmount;
        challanSummaryMap.set(key, existing);
      }
    });

    // Get unique deductees
    const uniqueDeductees = new Set(transactions.map((t) => t.deducteeId));

    const assessmentYear = getAssessmentYear(financialYear);

    return {
      deductor: deductorDetails,
      quarter,
      financialYear,
      assessmentYear,
      transactions,
      summary: {
        totalPayment: transactions.reduce((sum, t) => sum + t.paymentAmount, 0),
        totalTDS: transactions.reduce((sum, t) => sum + t.tdsAmount, 0),
        totalDeductees: uniqueDeductees.size,
        totalTransactions: transactions.length,
        bySectionSummary,
      },
      challanSummary: Array.from(challanSummaryMap.values()),
      generatedDate: new Date(),
    };
  } catch (error) {
    console.error('[TDS] Error generating Form 26Q:', error);
    throw error;
  }
}

/**
 * Export Form 16A to JSON
 */
export function exportForm16AToJSON(data: Form16AData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export Form 26Q to JSON
 */
export function exportForm26QToJSON(data: Form26QData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Get all deductees with TDS in a quarter
 */
export async function getDeducteesWithTDS(
  db: Firestore,
  quarter: 1 | 2 | 3 | 4,
  financialYear: string
): Promise<Array<{ id: string; name: string; pan: string; totalTDS: number }>> {
  try {
    const { start, end } = getQuarterDateRange(quarter, financialYear);
    const startTimestamp = Timestamp.fromDate(start);
    const endTimestamp = Timestamp.fromDate(end);

    const transactions = await extractTDSTransactions(db, startTimestamp, endTimestamp);

    // Group by deductee
    const deducteeMap = new Map<
      string,
      { id: string; name: string; pan: string; totalTDS: number }
    >();

    transactions.forEach((t) => {
      const existing = deducteeMap.get(t.deducteeId);
      if (existing) {
        existing.totalTDS += t.tdsAmount;
      } else {
        deducteeMap.set(t.deducteeId, {
          id: t.deducteeId,
          name: t.deducteeName,
          pan: t.deducteePAN,
          totalTDS: t.tdsAmount,
        });
      }
    });

    return Array.from(deducteeMap.values()).sort((a, b) => b.totalTDS - a.totalTDS);
  } catch (error) {
    console.error('[TDS] Error getting deductees:', error);
    throw error;
  }
}
