/**
 * Balance Sheet Report Generator
 *
 * Generates Balance Sheet showing financial position at a point in time.
 * Formula: Assets = Liabilities + Equity
 */

import { collection, getDocs } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  balance: number;
  debit: number;
  credit: number;
}

export interface BalanceSheetReport {
  asOfDate: Date;
  assets: {
    currentAssets: AccountBalance[];
    fixedAssets: AccountBalance[];
    otherAssets: AccountBalance[];
    totalCurrentAssets: number;
    totalFixedAssets: number;
    totalOtherAssets: number;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: AccountBalance[];
    longTermLiabilities: AccountBalance[];
    totalCurrentLiabilities: number;
    totalLongTermLiabilities: number;
    totalLiabilities: number;
  };
  equity: {
    capital: number;
    retainedEarnings: number;
    currentYearProfit: number;
    totalEquity: number;
  };
  balanced: boolean;
  difference: number;
}

/**
 * Determine if an asset account is current or fixed
 */
function isCurrentAsset(account: AccountBalance): boolean {
  const name = account.name.toLowerCase();
  const code = account.code;

  // Current assets typically have codes 1000-1999
  if (code >= '1000' && code < '2000') {
    return true;
  }

  // Check by name keywords
  return (
    name.includes('cash') ||
    name.includes('bank') ||
    name.includes('receivable') ||
    name.includes('inventory') ||
    name.includes('prepaid') ||
    name.includes('current')
  );
}

/**
 * Determine if a liability account is current or long-term
 */
function isCurrentLiability(account: AccountBalance): boolean {
  const name = account.name.toLowerCase();
  const code = account.code;

  // Current liabilities typically have codes 2000-2999
  if (code >= '2000' && code < '3000') {
    return true;
  }

  // Check by name keywords
  return (
    name.includes('payable') ||
    name.includes('accrued') ||
    name.includes('current') ||
    name.includes('short-term') ||
    name.includes('gst') ||
    name.includes('tds')
  );
}

/**
 * Generate Balance Sheet Report
 *
 * @param db Firestore instance
 * @param asOfDate Date for the balance sheet (typically end of period)
 * @returns Balance sheet data
 */
export async function generateBalanceSheet(
  db: Firestore,
  asOfDate: Date
): Promise<BalanceSheetReport> {
  try {
    // Fetch all accounts
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
    const accountsSnapshot = await getDocs(accountsRef);

    const accounts: AccountBalance[] = [];
    accountsSnapshot.forEach((doc) => {
      const data = doc.data();
      accounts.push({
        id: doc.id,
        code: data.code || '',
        name: data.name || '',
        balance: data.balance || 0,
        debit: data.debit || 0,
        credit: data.credit || 0,
      });
    });

    // Initialize categories
    const currentAssets: AccountBalance[] = [];
    const fixedAssets: AccountBalance[] = [];
    const otherAssets: AccountBalance[] = [];
    const currentLiabilities: AccountBalance[] = [];
    const longTermLiabilities: AccountBalance[] = [];
    let capitalBalance = 0;
    let retainedEarnings = 0;

    // Categorize accounts
    accounts.forEach((account) => {
      const accountType = account.code.charAt(0);

      // Assets (debit balance is positive for assets)
      if (accountType === '1') {
        // Asset accounts
        const assetBalance = account.debit - account.credit;
        if (assetBalance !== 0) {
          const assetAccount = { ...account, balance: assetBalance };
          if (isCurrentAsset(account)) {
            currentAssets.push(assetAccount);
          } else if (
            account.name.toLowerCase().includes('fixed') ||
            account.name.toLowerCase().includes('equipment') ||
            account.name.toLowerCase().includes('building') ||
            account.name.toLowerCase().includes('vehicle')
          ) {
            fixedAssets.push(assetAccount);
          } else {
            otherAssets.push(assetAccount);
          }
        }
      }
      // Liabilities (credit balance is positive for liabilities)
      else if (accountType === '2') {
        const liabilityBalance = account.credit - account.debit;
        if (liabilityBalance !== 0) {
          const liabilityAccount = { ...account, balance: liabilityBalance };
          if (isCurrentLiability(account)) {
            currentLiabilities.push(liabilityAccount);
          } else {
            longTermLiabilities.push(liabilityAccount);
          }
        }
      }
      // Equity (credit balance is positive for equity)
      else if (accountType === '3') {
        const equityBalance = account.credit - account.debit;
        if (
          account.name.toLowerCase().includes('capital') ||
          account.name.toLowerCase().includes('equity')
        ) {
          capitalBalance += equityBalance;
        } else if (account.name.toLowerCase().includes('retained')) {
          retainedEarnings += equityBalance;
        }
      }
    });

    // Calculate current year profit from revenue and expense accounts
    let currentYearProfit = 0;
    accounts.forEach((account) => {
      const accountType = account.code.charAt(0);
      // Revenue (credit balance)
      if (accountType === '4') {
        currentYearProfit += account.credit - account.debit;
      }
      // Expenses (debit balance)
      if (accountType === '5' || accountType === '6' || accountType === '7') {
        currentYearProfit -= account.debit - account.credit;
      }
    });

    // Calculate totals
    const totalCurrentAssets = currentAssets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalFixedAssets = fixedAssets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalOtherAssets = otherAssets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets + totalOtherAssets;

    const totalCurrentLiabilities = currentLiabilities.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLongTermLiabilities = longTermLiabilities.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    const totalEquity = capitalBalance + retainedEarnings + currentYearProfit;

    // Check if balanced (Assets = Liabilities + Equity)
    const difference = totalAssets - (totalLiabilities + totalEquity);
    const balanced = Math.abs(difference) < 0.01; // Allow for rounding errors

    return {
      asOfDate,
      assets: {
        currentAssets,
        fixedAssets,
        otherAssets,
        totalCurrentAssets,
        totalFixedAssets,
        totalOtherAssets,
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        longTermLiabilities,
        totalCurrentLiabilities,
        totalLongTermLiabilities,
        totalLiabilities,
      },
      equity: {
        capital: capitalBalance,
        retainedEarnings,
        currentYearProfit,
        totalEquity,
      },
      balanced,
      difference,
    };
  } catch (error) {
    console.error('[generateBalanceSheet] Error:', error);
    throw new Error('Failed to generate Balance Sheet');
  }
}

/**
 * Validate accounting equation
 * Assets = Liabilities + Equity
 */
export function validateAccountingEquation(report: BalanceSheetReport): {
  valid: boolean;
  message: string;
} {
  if (report.balanced) {
    return {
      valid: true,
      message: 'Balance Sheet is balanced. Assets = Liabilities + Equity',
    };
  }

  const diff = report.difference;
  if (diff > 0) {
    return {
      valid: false,
      message: `Balance Sheet is out of balance. Assets exceed Liabilities + Equity by ${Math.abs(diff).toFixed(2)}`,
    };
  } else {
    return {
      valid: false,
      message: `Balance Sheet is out of balance. Liabilities + Equity exceed Assets by ${Math.abs(diff).toFixed(2)}`,
    };
  }
}
