/**
 * Profit & Loss Report Generator
 *
 * Generates Profit & Loss statement showing revenue, expenses, and profit for a period.
 * Formula: Revenue - Expenses = Net Profit
 */

import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'reports/profitLoss' });

/**
 * Individual transaction contributing to an account in the P&L
 */
export interface PnLTransactionDetail {
  id: string;
  transactionNumber: string;
  date: Date;
  entityName: string;
  type: string;
  amount: number; // Net contribution to this account (positive = in the reported direction)
}

/**
 * Account item for breakdown display
 */
export interface AccountLineItem {
  id: string;
  code: string;
  name: string;
  amount: number;
  transactions: PnLTransactionDetail[];
}

/**
 * Category breakdown with accounts
 */
export interface CategoryBreakdown {
  total: number;
  accounts: AccountLineItem[];
}

export interface ProfitLossReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  revenue: {
    sales: number;
    otherIncome: number;
    total: number;
    // Account-level breakdown
    salesAccounts: AccountLineItem[];
    otherIncomeAccounts: AccountLineItem[];
  };
  expenses: {
    costOfGoodsSold: number;
    operatingExpenses: number;
    otherExpenses: number;
    total: number;
    // Account-level breakdown
    cogsAccounts: AccountLineItem[];
    operatingAccounts: AccountLineItem[];
    otherAccounts: AccountLineItem[];
  };
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
  profitMargin: number; // Percentage
}

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  accountType: string;
  balance: number;
  debit: number;
  credit: number;
}

/**
 * Generate Profit & Loss Report
 *
 * @param db Firestore instance
 * @param startDate Start date of period
 * @param endDate End date of period
 * @returns P&L report data
 */
export async function generateProfitLossReport(
  db: Firestore,
  startDate: Date,
  endDate: Date
): Promise<ProfitLossReport> {
  try {
    // Convert dates to Firestore Timestamps
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    // Fetch all accounts for reference
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
    const accountsSnapshot = await getDocs(accountsRef);

    // Build account lookup map
    const accountMap = new Map<string, AccountBalance>();
    accountsSnapshot.forEach((doc) => {
      const data = doc.data();
      accountMap.set(doc.id, {
        id: doc.id,
        code: data.code || '',
        name: data.name || '',
        accountType: data.accountType || '',
        balance: 0, // Will calculate from transactions
        debit: 0,
        credit: 0,
      });
    });

    // Query all GL entries within the date range
    // Note: We query transactions and aggregate their GL entries
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const periodQuery = query(
      transactionsRef,
      where('date', '>=', startTimestamp),
      where('date', '<=', endTimestamp)
    );
    const transactionsSnapshot = await getDocs(periodQuery);

    // Aggregate debits and credits by account for the period,
    // and collect per-account transaction details for drill-down.
    const accountActivity = new Map<string, { debit: number; credit: number }>();
    const accountTransactions = new Map<string, PnLTransactionDetail[]>();

    transactionsSnapshot.forEach((doc) => {
      const transaction = doc.data();
      if (transaction.isDeleted) return; // Skip soft-deleted transactions

      const glEntries = transaction.entries || [];
      const txDate =
        transaction.date && typeof transaction.date === 'object' && 'toDate' in transaction.date
          ? (transaction.date as { toDate: () => Date }).toDate()
          : new Date(transaction.date as string);

      glEntries.forEach((entry: { accountId: string; debit: number; credit: number }) => {
        if (!entry.accountId) return;

        const existing = accountActivity.get(entry.accountId) || { debit: 0, credit: 0 };
        accountActivity.set(entry.accountId, {
          debit: existing.debit + (entry.debit || 0),
          credit: existing.credit + (entry.credit || 0),
        });

        // Collect transaction detail for this account entry
        const netContribution = (entry.credit || 0) - (entry.debit || 0);
        if (netContribution !== 0) {
          const existing = accountTransactions.get(entry.accountId) || [];
          existing.push({
            id: doc.id,
            transactionNumber: transaction.transactionNumber || transaction.number || doc.id,
            date: txDate,
            entityName: transaction.entityName || transaction.vendorName || '',
            type: transaction.type || '',
            amount: netContribution,
          });
          accountTransactions.set(entry.accountId, existing);
        }
      });
    });

    // Sort transactions per account by date descending
    accountTransactions.forEach((txns) => txns.sort((a, b) => b.date.getTime() - a.date.getTime()));

    // Update account balances from period activity
    accountActivity.forEach((activity, accountId) => {
      const account = accountMap.get(accountId);
      if (account) {
        account.debit = activity.debit;
        account.credit = activity.credit;
        account.balance = activity.credit - activity.debit; // Net balance for the period
      }
    });

    // Categorize accounts and calculate totals
    let sales = 0;
    let otherIncome = 0;
    let costOfGoodsSold = 0;
    let operatingExpenses = 0;
    let otherExpenses = 0;

    // Account-level breakdown arrays
    const salesAccounts: AccountLineItem[] = [];
    const otherIncomeAccounts: AccountLineItem[] = [];
    const cogsAccounts: AccountLineItem[] = [];
    const operatingAccounts: AccountLineItem[] = [];
    const otherAccounts: AccountLineItem[] = [];

    accountMap.forEach((account) => {
      const accountName = account.name.toLowerCase();
      const accountCode = account.code;

      // Revenue accounts (credit balance means revenue)
      if (account.accountType === 'REVENUE' || account.accountType === 'INCOME') {
        const netRevenue = account.credit - account.debit;

        // Only include accounts with non-zero balance
        if (netRevenue === 0) return;

        const lineItem: AccountLineItem = {
          id: account.id,
          code: account.code,
          name: account.name,
          amount: netRevenue,
          transactions: accountTransactions.get(account.id) || [],
        };

        // Sales accounts (typically 4000-4999)
        if (
          accountCode.startsWith('4') ||
          accountName.includes('sales') ||
          accountName.includes('revenue')
        ) {
          sales += netRevenue;
          salesAccounts.push(lineItem);
        } else {
          // Other income
          otherIncome += netRevenue;
          otherIncomeAccounts.push(lineItem);
        }
      }

      // Expense accounts (debit balance means expense)
      if (account.accountType === 'EXPENSE') {
        const netExpense = account.debit - account.credit;

        // Only include accounts with non-zero balance
        if (netExpense === 0) return;

        // For expense accounts, transactions contributed debit>credit, so negate for display
        const expenseTxns = (accountTransactions.get(account.id) || []).map((t) => ({
          ...t,
          amount: -t.amount,
        }));

        const lineItem: AccountLineItem = {
          id: account.id,
          code: account.code,
          name: account.name,
          amount: netExpense,
          transactions: expenseTxns,
        };

        // Cost of Goods Sold (typically 5000-5999)
        if (
          accountCode.startsWith('5') ||
          accountName.includes('cost of goods') ||
          accountName.includes('cogs')
        ) {
          costOfGoodsSold += netExpense;
          cogsAccounts.push(lineItem);
        }
        // Operating Expenses (typically 6000-7999)
        else if (
          accountCode.startsWith('6') ||
          accountCode.startsWith('7') ||
          accountName.includes('salary') ||
          accountName.includes('rent') ||
          accountName.includes('utilities') ||
          accountName.includes('depreciation')
        ) {
          operatingExpenses += netExpense;
          operatingAccounts.push(lineItem);
        }
        // Other Expenses
        else {
          otherExpenses += netExpense;
          otherAccounts.push(lineItem);
        }
      }
    });

    // Sort each category by amount (descending) for better readability
    const sortByAmount = (a: AccountLineItem, b: AccountLineItem) => b.amount - a.amount;
    salesAccounts.sort(sortByAmount);
    otherIncomeAccounts.sort(sortByAmount);
    cogsAccounts.sort(sortByAmount);
    operatingAccounts.sort(sortByAmount);
    otherAccounts.sort(sortByAmount);

    // Calculate profits
    const totalRevenue = sales + otherIncome;
    const totalExpenses = costOfGoodsSold + operatingExpenses + otherExpenses;
    const grossProfit = sales - costOfGoodsSold;
    const operatingProfit = grossProfit - operatingExpenses;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period: {
        startDate,
        endDate,
      },
      revenue: {
        sales,
        otherIncome,
        total: totalRevenue,
        salesAccounts,
        otherIncomeAccounts,
      },
      expenses: {
        costOfGoodsSold,
        operatingExpenses,
        otherExpenses,
        total: totalExpenses,
        cogsAccounts,
        operatingAccounts,
        otherAccounts,
      },
      grossProfit,
      operatingProfit,
      netProfit,
      profitMargin,
    };
  } catch (error) {
    logger.error('generateProfitLossReport failed', { error });
    throw new Error('Failed to generate Profit & Loss report');
  }
}

/**
 * Generate comparative P&L report (current vs previous period)
 *
 * @param db Firestore instance
 * @param currentStartDate Start date of current period
 * @param currentEndDate End date of current period
 * @returns Current and previous period P&L data
 */
export async function generateComparativeProfitLossReport(
  db: Firestore,
  currentStartDate: Date,
  currentEndDate: Date
): Promise<{
  current: ProfitLossReport;
  previous: ProfitLossReport;
  changes: {
    revenue: { amount: number; percentage: number };
    expenses: { amount: number; percentage: number };
    netProfit: { amount: number; percentage: number };
  };
}> {
  // Calculate period length
  const periodLength = currentEndDate.getTime() - currentStartDate.getTime();

  // Calculate previous period dates
  const previousEndDate = new Date(currentStartDate.getTime() - 1); // Day before current start
  const previousStartDate = new Date(previousEndDate.getTime() - periodLength);

  // Generate both reports
  const [currentReport, previousReport] = await Promise.all([
    generateProfitLossReport(db, currentStartDate, currentEndDate),
    generateProfitLossReport(db, previousStartDate, previousEndDate),
  ]);

  // Calculate changes
  const revenueChange = currentReport.revenue.total - previousReport.revenue.total;
  const revenueChangePercent =
    previousReport.revenue.total > 0 ? (revenueChange / previousReport.revenue.total) * 100 : 0;

  const expenseChange = currentReport.expenses.total - previousReport.expenses.total;
  const expenseChangePercent =
    previousReport.expenses.total > 0 ? (expenseChange / previousReport.expenses.total) * 100 : 0;

  const profitChange = currentReport.netProfit - previousReport.netProfit;
  const profitChangePercent =
    previousReport.netProfit !== 0 ? (profitChange / Math.abs(previousReport.netProfit)) * 100 : 0;

  return {
    current: currentReport,
    previous: previousReport,
    changes: {
      revenue: {
        amount: revenueChange,
        percentage: revenueChangePercent,
      },
      expenses: {
        amount: expenseChange,
        percentage: expenseChangePercent,
      },
      netProfit: {
        amount: profitChange,
        percentage: profitChangePercent,
      },
    },
  };
}
