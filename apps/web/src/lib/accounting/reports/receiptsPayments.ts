/**
 * Monthly Receipts & Payments Report Generator
 *
 * Generates a comprehensive monthly report showing:
 * - Receipts: Project-wise receipts + Other income
 * - Payments: Categorized by expense type (Salary, Project, Tax, Admin, Loans)
 * - Summary: Opening balance, totals, net surplus/deficit, closing balance
 */

import { collection, query, where, getDocs, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

// ============================================================================
// Types
// ============================================================================

export type PaymentCategory =
  | 'SALARY_WAGES'
  | 'PROJECT_EXPENSES'
  | 'DUTIES_TAXES'
  | 'ADMINISTRATIVE_EXPENSES'
  | 'LOANS_OTHER_PAYMENTS';

export interface ReceiptPaymentLineItem {
  transactionId: string;
  transactionNumber: string;
  date: Date;
  description: string;
  entityName?: string;
  accountName: string;
  accountCode: string;
  costCentreId?: string;
  costCentreName?: string;
  amount: number;
  transactionType: string;
}

export interface ProjectReceipt {
  projectId: string;
  projectName: string;
  projectCode: string;
  items: ReceiptPaymentLineItem[];
  total: number;
}

export interface PaymentCategoryBreakdown {
  category: PaymentCategory;
  categoryLabel: string;
  items: ReceiptPaymentLineItem[];
  total: number;
}

export interface MonthlyReceiptsPaymentsReport {
  // Period info
  month: number;
  year: number;
  monthName: string;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;

  // Opening Balance
  openingBalance: number;
  openingBalanceByAccount: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: number;
  }>;

  // Receipts Section
  receipts: {
    projectReceipts: ProjectReceipt[];
    totalProjectReceipts: number;
    otherIncome: ReceiptPaymentLineItem[];
    totalOtherIncome: number;
    totalReceipts: number;
  };

  // Payments Section
  payments: {
    salaryWages: PaymentCategoryBreakdown;
    projectExpenses: PaymentCategoryBreakdown;
    dutiesTaxes: PaymentCategoryBreakdown;
    administrativeExpenses: PaymentCategoryBreakdown;
    loansOtherPayments: PaymentCategoryBreakdown;
    totalPayments: number;
  };

  // Summary
  summary: {
    totalReceipts: number;
    totalPayments: number;
    netSurplusDeficit: number;
    closingBalance: number;
    isDeficit: boolean;
  };
}

// Internal types for processing
interface AccountInfo {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountGroup?: string;
  isBankAccount: boolean;
  openingBalance: number;
  currentBalance: number;
}

interface CostCentreInfo {
  id: string;
  code: string;
  name: string;
  category: string;
  projectId?: string;
}

interface LedgerEntry {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  costCentreId?: string;
  entityId?: string;
  entityName?: string;
}

interface TransactionDoc {
  id: string;
  type: string;
  transactionNumber: string;
  date: { toDate?: () => Date } | Date;
  description?: string;
  entries?: LedgerEntry[];
  entityName?: string;
  status: string;
}

// ============================================================================
// Category Labels
// ============================================================================

const CATEGORY_LABELS: Record<PaymentCategory, string> = {
  SALARY_WAGES: 'Salary & Wages',
  PROJECT_EXPENSES: 'Project Expenses',
  DUTIES_TAXES: 'Duties & Taxes',
  ADMINISTRATIVE_EXPENSES: 'Administrative Expenses',
  LOANS_OTHER_PAYMENTS: 'Loans & Other Payments',
};

// ============================================================================
// Month Names
// ============================================================================

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an account is a Cash/Bank account
 */
function isCashBankAccount(account: AccountInfo): boolean {
  if (account.isBankAccount) return true;
  const nameLower = account.name.toLowerCase();
  const groupLower = (account.accountGroup || '').toLowerCase();
  return (
    nameLower.includes('cash') ||
    nameLower.includes('bank') ||
    groupLower.includes('cash') ||
    groupLower.includes('bank')
  );
}

/**
 * Categorize a payment based on account properties
 */
function categorizePayment(
  account: AccountInfo,
  costCentreId: string | undefined,
  costCentres: Map<string, CostCentreInfo>
): PaymentCategory {
  const nameLower = account.name.toLowerCase();
  const groupLower = (account.accountGroup || '').toLowerCase();

  // Salary & Wages
  if (
    groupLower.includes('salary') ||
    groupLower.includes('wages') ||
    groupLower.includes('payroll') ||
    nameLower.includes('salary') ||
    nameLower.includes('wages') ||
    nameLower.includes('payroll') ||
    nameLower.includes('staff') ||
    nameLower.includes('employee') ||
    nameLower.includes('bonus') ||
    nameLower.includes('incentive') ||
    nameLower.includes('pf contribution') ||
    nameLower.includes('esi') ||
    nameLower.includes('provident fund')
  ) {
    return 'SALARY_WAGES';
  }

  // Duties & Taxes
  if (
    groupLower.includes('tax') ||
    groupLower.includes('duties') ||
    groupLower.includes('gst') ||
    groupLower.includes('tds') ||
    nameLower.includes('gst') ||
    nameLower.includes('cgst') ||
    nameLower.includes('sgst') ||
    nameLower.includes('igst') ||
    nameLower.includes('tds') ||
    nameLower.includes('tax') ||
    nameLower.includes('duty') ||
    nameLower.includes('cess') ||
    nameLower.includes('professional tax')
  ) {
    return 'DUTIES_TAXES';
  }

  // Loans & Other Payments
  if (
    groupLower.includes('loan') ||
    groupLower.includes('borrowing') ||
    groupLower.includes('financial') ||
    nameLower.includes('loan') ||
    nameLower.includes('interest on loan') ||
    nameLower.includes('bank charges') ||
    nameLower.includes('emi') ||
    nameLower.includes('repayment')
  ) {
    return 'LOANS_OTHER_PAYMENTS';
  }

  // Project Expenses - has cost centre linked to a project
  if (costCentreId && account.accountType === 'EXPENSE') {
    const costCentre = costCentres.get(costCentreId);
    if (costCentre && (costCentre.category === 'PROJECT' || costCentre.projectId)) {
      return 'PROJECT_EXPENSES';
    }
  }

  // Default: Administrative Expenses
  return 'ADMINISTRATIVE_EXPENSES';
}

/**
 * Parse date from Firestore document
 */
function parseDate(dateField: { toDate?: () => Date } | Date | undefined): Date {
  if (!dateField) return new Date();
  if (dateField instanceof Date) return dateField;
  if (typeof dateField.toDate === 'function') return dateField.toDate();
  return new Date();
}

// ============================================================================
// Main Report Generator
// ============================================================================

/**
 * Generate Monthly Receipts & Payments Report
 */
export async function generateReceiptsPaymentsReport(
  db: Firestore,
  month: number, // 1-12
  year: number
): Promise<MonthlyReceiptsPaymentsReport> {
  // Calculate date range
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  const start = Timestamp.fromDate(startDate);
  const end = Timestamp.fromDate(endDate);

  // Fetch all accounts
  const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
  const accountsSnapshot = await getDocs(accountsRef);
  const accounts = new Map<string, AccountInfo>();
  const cashBankAccountIds = new Set<string>();

  accountsSnapshot.forEach((doc) => {
    const data = doc.data();
    const account: AccountInfo = {
      id: doc.id,
      code: data.code || '',
      name: data.name || '',
      accountType: data.accountType || '',
      accountGroup: data.accountGroup,
      isBankAccount: data.isBankAccount || false,
      openingBalance: data.openingBalance || 0,
      currentBalance: data.currentBalance || 0,
    };
    accounts.set(doc.id, account);

    if (isCashBankAccount(account)) {
      cashBankAccountIds.add(doc.id);
    }
  });

  // Fetch cost centres
  const costCentresRef = collection(db, COLLECTIONS.COST_CENTRES);
  const costCentresSnapshot = await getDocs(costCentresRef);
  const costCentres = new Map<string, CostCentreInfo>();

  costCentresSnapshot.forEach((doc) => {
    const data = doc.data();
    costCentres.set(doc.id, {
      id: doc.id,
      code: data.code || '',
      name: data.name || '',
      category: data.category || 'OVERHEAD',
      projectId: data.projectId,
    });
  });

  // Fetch projects for project names
  const projectsRef = collection(db, COLLECTIONS.PROJECTS);
  const projectsSnapshot = await getDocs(projectsRef);
  const projects = new Map<string, { code: string; name: string }>();

  projectsSnapshot.forEach((doc) => {
    const data = doc.data();
    projects.set(doc.id, {
      code: data.code || '',
      name: data.name || '',
    });
  });

  // Fetch transactions in date range
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const q = query(
    transactionsRef,
    where('status', '==', 'POSTED'),
    where('date', '>=', start),
    where('date', '<=', end)
  );
  const transactionsSnapshot = await getDocs(q);

  // Also fetch historical transactions for opening balance
  const historicalQ = query(
    transactionsRef,
    where('status', '==', 'POSTED'),
    where('date', '<', start)
  );
  const historicalSnapshot = await getDocs(historicalQ);

  // Calculate opening balance
  let openingBalance = 0;
  const openingBalanceByAccount: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: number;
  }> = [];

  // Start with opening balances from accounts
  cashBankAccountIds.forEach((accountId) => {
    const account = accounts.get(accountId);
    if (account) {
      openingBalance += account.openingBalance;
      openingBalanceByAccount.push({
        accountId,
        accountCode: account.code,
        accountName: account.name,
        balance: account.openingBalance,
      });
    }
  });

  // Add historical transaction impacts
  historicalSnapshot.forEach((doc) => {
    const data = doc.data();
    const txn: TransactionDoc = {
      id: doc.id,
      type: data.type || '',
      transactionNumber: data.transactionNumber || '',
      date: data.date,
      description: data.description,
      entries: data.entries,
      entityName: data.entityName,
      status: data.status || '',
    };
    if (!txn.entries) return;

    txn.entries.forEach((entry) => {
      if (cashBankAccountIds.has(entry.accountId)) {
        // Debit = money in, Credit = money out
        const impact = (entry.debit || 0) - (entry.credit || 0);
        openingBalance += impact;

        // Update account-wise balance
        const idx = openingBalanceByAccount.findIndex((a) => a.accountId === entry.accountId);
        if (idx >= 0 && openingBalanceByAccount[idx]) {
          openingBalanceByAccount[idx].balance += impact;
        }
      }
    });
  });

  // Process current month transactions
  const receipts: ReceiptPaymentLineItem[] = [];
  const payments: ReceiptPaymentLineItem[] = [];

  transactionsSnapshot.forEach((doc) => {
    const data = doc.data();
    const txn: TransactionDoc = {
      id: doc.id,
      type: data.type || '',
      transactionNumber: data.transactionNumber || '',
      date: data.date,
      description: data.description,
      entries: data.entries,
      entityName: data.entityName,
      status: data.status || '',
    };
    if (!txn.entries) return;

    const txnDate = parseDate(txn.date);

    txn.entries.forEach((entry) => {
      // Find the contra entry (the non-cash/bank entry)
      const contraEntries = txn.entries?.filter((e) => !cashBankAccountIds.has(e.accountId)) || [];
      const contraEntry = contraEntries[0];
      const contraAccount = contraEntry ? accounts.get(contraEntry.accountId) : undefined;

      if (cashBankAccountIds.has(entry.accountId)) {
        const cashAccount = accounts.get(entry.accountId);

        // Receipt: Debit to Cash/Bank (money coming in)
        if ((entry.debit || 0) > 0) {
          // Find the source (contra account or cost centre for context)
          const costCentre = entry.costCentreId
            ? costCentres.get(entry.costCentreId)
            : contraEntry?.costCentreId
              ? costCentres.get(contraEntry.costCentreId)
              : undefined;

          receipts.push({
            transactionId: txn.id,
            transactionNumber: txn.transactionNumber || '',
            date: txnDate,
            description: entry.description || txn.description || '',
            entityName: entry.entityName || txn.entityName,
            accountName: contraAccount?.name || cashAccount?.name || '',
            accountCode: contraAccount?.code || cashAccount?.code || '',
            costCentreId: costCentre?.id,
            costCentreName: costCentre?.name,
            amount: entry.debit || 0,
            transactionType: txn.type || '',
          });
        }

        // Payment: Credit from Cash/Bank (money going out)
        if ((entry.credit || 0) > 0) {
          const costCentre = contraEntry?.costCentreId
            ? costCentres.get(contraEntry.costCentreId)
            : entry.costCentreId
              ? costCentres.get(entry.costCentreId)
              : undefined;

          payments.push({
            transactionId: txn.id,
            transactionNumber: txn.transactionNumber || '',
            date: txnDate,
            description: entry.description || txn.description || '',
            entityName: entry.entityName || txn.entityName,
            accountName: contraAccount?.name || '',
            accountCode: contraAccount?.code || '',
            costCentreId: costCentre?.id,
            costCentreName: costCentre?.name,
            amount: entry.credit || 0,
            transactionType: txn.type || '',
          });
        }
      }
    });
  });

  // Group receipts by project
  const projectReceiptsMap = new Map<string, ProjectReceipt>();
  const otherIncome: ReceiptPaymentLineItem[] = [];

  receipts.forEach((receipt) => {
    if (receipt.costCentreId) {
      const costCentre = costCentres.get(receipt.costCentreId);
      if (costCentre && (costCentre.category === 'PROJECT' || costCentre.projectId)) {
        const projectId = costCentre.projectId || costCentre.id;
        const project = costCentre.projectId ? projects.get(costCentre.projectId) : undefined;

        if (!projectReceiptsMap.has(projectId)) {
          projectReceiptsMap.set(projectId, {
            projectId,
            projectName: project?.name || costCentre.name,
            projectCode: project?.code || costCentre.code,
            items: [],
            total: 0,
          });
        }

        const projectReceipt = projectReceiptsMap.get(projectId)!;
        projectReceipt.items.push(receipt);
        projectReceipt.total += receipt.amount;
        return;
      }
    }
    otherIncome.push(receipt);
  });

  const projectReceipts = Array.from(projectReceiptsMap.values()).sort((a, b) =>
    a.projectCode.localeCompare(b.projectCode)
  );

  // Categorize payments
  const paymentCategories: Record<PaymentCategory, PaymentCategoryBreakdown> = {
    SALARY_WAGES: {
      category: 'SALARY_WAGES',
      categoryLabel: CATEGORY_LABELS.SALARY_WAGES,
      items: [],
      total: 0,
    },
    PROJECT_EXPENSES: {
      category: 'PROJECT_EXPENSES',
      categoryLabel: CATEGORY_LABELS.PROJECT_EXPENSES,
      items: [],
      total: 0,
    },
    DUTIES_TAXES: {
      category: 'DUTIES_TAXES',
      categoryLabel: CATEGORY_LABELS.DUTIES_TAXES,
      items: [],
      total: 0,
    },
    ADMINISTRATIVE_EXPENSES: {
      category: 'ADMINISTRATIVE_EXPENSES',
      categoryLabel: CATEGORY_LABELS.ADMINISTRATIVE_EXPENSES,
      items: [],
      total: 0,
    },
    LOANS_OTHER_PAYMENTS: {
      category: 'LOANS_OTHER_PAYMENTS',
      categoryLabel: CATEGORY_LABELS.LOANS_OTHER_PAYMENTS,
      items: [],
      total: 0,
    },
  };

  payments.forEach((payment) => {
    // Find the account for this payment
    const account = Array.from(accounts.values()).find(
      (a) => a.code === payment.accountCode || a.name === payment.accountName
    );

    if (account) {
      const category = categorizePayment(account, payment.costCentreId, costCentres);
      paymentCategories[category].items.push(payment);
      paymentCategories[category].total += payment.amount;
    } else {
      // Default to administrative if account not found
      paymentCategories.ADMINISTRATIVE_EXPENSES.items.push(payment);
      paymentCategories.ADMINISTRATIVE_EXPENSES.total += payment.amount;
    }
  });

  // Calculate totals
  const totalProjectReceipts = projectReceipts.reduce((sum, p) => sum + p.total, 0);
  const totalOtherIncome = otherIncome.reduce((sum, r) => sum + r.amount, 0);
  const totalReceipts = totalProjectReceipts + totalOtherIncome;

  const totalPayments = Object.values(paymentCategories).reduce((sum, cat) => sum + cat.total, 0);

  const netSurplusDeficit = totalReceipts - totalPayments;
  const closingBalance = openingBalance + netSurplusDeficit;

  return {
    month,
    year,
    monthName: `${MONTH_NAMES[month - 1]} ${year}`,
    startDate,
    endDate,
    generatedAt: new Date(),

    openingBalance,
    openingBalanceByAccount,

    receipts: {
      projectReceipts,
      totalProjectReceipts,
      otherIncome,
      totalOtherIncome,
      totalReceipts,
    },

    payments: {
      salaryWages: paymentCategories.SALARY_WAGES,
      projectExpenses: paymentCategories.PROJECT_EXPENSES,
      dutiesTaxes: paymentCategories.DUTIES_TAXES,
      administrativeExpenses: paymentCategories.ADMINISTRATIVE_EXPENSES,
      loansOtherPayments: paymentCategories.LOANS_OTHER_PAYMENTS,
      totalPayments,
    },

    summary: {
      totalReceipts,
      totalPayments,
      netSurplusDeficit,
      closingBalance,
      isDeficit: netSurplusDeficit < 0,
    },
  };
}
