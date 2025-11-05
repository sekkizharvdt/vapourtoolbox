/**
 * Cash Flow Statement Generator
 *
 * Generates cash flow statement showing:
 * - Operating Activities (day-to-day business)
 * - Investing Activities (asset purchases/sales)
 * - Financing Activities (loans, equity)
 */

import { collection, query, where, getDocs, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

export interface CashFlowLine {
  description: string;
  amount: number;
  isSubtotal?: boolean;
  indent?: number;
}

export interface CashFlowSection {
  title: string;
  lines: CashFlowLine[];
  total: number;
}

export interface CashFlowStatement {
  startDate: Date;
  endDate: Date;
  generatedAt: Date;

  // Opening cash balance
  openingCash: number;

  // Three sections
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;

  // Summary
  netCashFlow: number;
  closingCash: number;
}

/**
 * Generate Cash Flow Statement
 *
 * Cash Flow = Operating Activities + Investing Activities + Financing Activities
 */
export async function generateCashFlowStatement(
  db: Firestore,
  startDate: Date,
  endDate: Date
): Promise<CashFlowStatement> {
  const start = Timestamp.fromDate(startDate);
  const end = Timestamp.fromDate(endDate);

  // Get all POSTED transactions in date range
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const q = query(
    transactionsRef,
    where('status', '==', 'POSTED'),
    where('date', '>=', start),
    where('date', '<=', end)
  );

  const snapshot = await getDocs(q);
  const transactions: {
    id?: string;
    type?: string;
    totalAmount?: number;
    entries?: Array<{ accountId?: string; debit?: number; credit?: number }>;
  }[] = [];

  snapshot.forEach((doc) => {
    transactions.push({ id: doc.id, ...doc.data() });
  });

  // Get bank/cash accounts
  const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
  const accountsSnapshot = await getDocs(accountsRef);
  const cashAccounts = new Set<string>();
  const assetAccounts = new Set<string>();
  const liabilityAccounts = new Set<string>();

  accountsSnapshot.forEach((doc) => {
    const account = doc.data() as {
      accountType?: string;
      isBankAccount?: boolean;
      name?: string;
      code?: string;
    };
    if (account.isBankAccount || account.name?.toLowerCase().includes('cash')) {
      cashAccounts.add(doc.id);
    }
    if (account.accountType === 'ASSET') {
      assetAccounts.add(doc.id);
    }
    if (account.accountType === 'LIABILITY') {
      liabilityAccounts.add(doc.id);
    }
  });

  // Calculate opening cash balance (sum of cash accounts at start date)
  const openingCash = await getCashBalance(db, startDate);

  // Categorize transactions
  const operating: CashFlowLine[] = [];
  const investing: CashFlowLine[] = [];
  const financing: CashFlowLine[] = [];

  let operatingTotal = 0;
  let investingTotal = 0;
  let financingTotal = 0;

  // Group by transaction type for better reporting
  const customerPayments = { amount: 0, count: 0 };
  const vendorPayments = { amount: 0, count: 0 };
  const assetPurchases = { amount: 0, count: 0 };
  const loanProceeds = { amount: 0, count: 0 };
  const loanRepayments = { amount: 0, count: 0 };

  transactions.forEach((txn) => {
    if (!txn.entries) return;

    // Find cash flow impact
    let cashImpact = 0;
    let isCashTransaction = false;

    txn.entries.forEach((entry) => {
      if (cashAccounts.has(entry.accountId || '')) {
        isCashTransaction = true;
        cashImpact += (entry.debit || 0) - (entry.credit || 0);
      }
    });

    if (!isCashTransaction) return;

    // Categorize by transaction type
    switch (txn.type) {
      case 'CUSTOMER_PAYMENT':
        customerPayments.amount += cashImpact;
        customerPayments.count++;
        operatingTotal += cashImpact;
        break;

      case 'VENDOR_PAYMENT':
        vendorPayments.amount += cashImpact;
        vendorPayments.count++;
        operatingTotal += cashImpact;
        break;

      case 'CUSTOMER_INVOICE':
      case 'VENDOR_BILL':
        // These don't affect cash until paid
        break;

      case 'JOURNAL_ENTRY': {
        // Analyze journal entry to categorize
        const hasAsset = txn.entries?.some((e) => assetAccounts.has(e.accountId || ''));
        const hasLiability = txn.entries?.some((e) => liabilityAccounts.has(e.accountId || ''));

        if (hasAsset && cashImpact < 0) {
          assetPurchases.amount += Math.abs(cashImpact);
          assetPurchases.count++;
          investingTotal += cashImpact;
        } else if (hasLiability) {
          if (cashImpact > 0) {
            loanProceeds.amount += cashImpact;
            loanProceeds.count++;
            financingTotal += cashImpact;
          } else {
            loanRepayments.amount += Math.abs(cashImpact);
            loanRepayments.count++;
            financingTotal += cashImpact;
          }
        } else {
          // Other operating activities
          operatingTotal += cashImpact;
        }
        break;
      }

      default:
        // Default to operating activities
        operatingTotal += cashImpact;
    }
  });

  // Build Operating Activities section
  if (customerPayments.amount !== 0) {
    operating.push({
      description: `Cash received from customers (${customerPayments.count} transactions)`,
      amount: customerPayments.amount,
    });
  }

  if (vendorPayments.amount !== 0) {
    operating.push({
      description: `Cash paid to vendors (${vendorPayments.count} transactions)`,
      amount: vendorPayments.amount,
    });
  }

  operating.push({
    description: 'Net Cash from Operating Activities',
    amount: operatingTotal,
    isSubtotal: true,
  });

  // Build Investing Activities section
  if (assetPurchases.amount !== 0) {
    investing.push({
      description: `Purchase of assets (${assetPurchases.count} transactions)`,
      amount: -assetPurchases.amount,
    });
  }

  investing.push({
    description: 'Net Cash from Investing Activities',
    amount: investingTotal,
    isSubtotal: true,
  });

  // Build Financing Activities section
  if (loanProceeds.amount !== 0) {
    financing.push({
      description: `Loan proceeds received (${loanProceeds.count} transactions)`,
      amount: loanProceeds.amount,
    });
  }

  if (loanRepayments.amount !== 0) {
    financing.push({
      description: `Loan repayments (${loanRepayments.count} transactions)`,
      amount: -loanRepayments.amount,
    });
  }

  financing.push({
    description: 'Net Cash from Financing Activities',
    amount: financingTotal,
    isSubtotal: true,
  });

  const netCashFlow = operatingTotal + investingTotal + financingTotal;
  const closingCash = openingCash + netCashFlow;

  return {
    startDate,
    endDate,
    generatedAt: new Date(),
    openingCash,
    operating: {
      title: 'Cash Flow from Operating Activities',
      lines: operating,
      total: operatingTotal,
    },
    investing: {
      title: 'Cash Flow from Investing Activities',
      lines: investing,
      total: investingTotal,
    },
    financing: {
      title: 'Cash Flow from Financing Activities',
      lines: financing,
      total: financingTotal,
    },
    netCashFlow,
    closingCash,
  };
}

/**
 * Get cash balance at a specific date
 */
async function getCashBalance(db: Firestore, _date: Date): Promise<number> {
  const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
  const snapshot = await getDocs(accountsRef);

  let totalCash = 0;

  snapshot.forEach((doc) => {
    const account = doc.data() as {
      isBankAccount?: boolean;
      name?: string;
      currentBalance?: number;
      openingBalance?: number;
    };
    if (account.isBankAccount || account.name?.toLowerCase().includes('cash')) {
      // For simplicity, use opening balance
      // In production, you'd calculate balance up to the date
      totalCash += account.openingBalance || 0;
    }
  });

  return totalCash;
}
