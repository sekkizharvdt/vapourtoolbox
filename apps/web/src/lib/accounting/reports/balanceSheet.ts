/**
 * Balance Sheet Report Generator
 *
 * Generates Balance Sheet showing financial position at a point in time.
 * Formula: Assets = Liabilities + Equity
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'reports/balanceSheet' });

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
 * Classification inputs beyond the numeric balance. `accountType` is the
 * declared truth; `accountGroup` is how the chart of accounts organises it.
 */
export interface ClassifiableAccount {
  code: string;
  name: string;
  accountType?: string;
  accountGroup?: string;
}

/**
 * Which side of the balance sheet an account belongs on.
 *
 * **Declared `accountType` wins, not the code prefix.** The chart of accounts
 * has five accounts whose code contradicts their type — `1401`–`1404` are TDS
 * *liabilities* numbered in the asset range, and `5223 Travelling Advance` is a
 * liability numbered in the expense range. Classifying on `code.charAt(0)` put
 * ₹13.19 L on the wrong side of the sheet and pushed the travelling advance
 * through current-year profit. The prefix survives only as a fallback for rows
 * that predate `accountType`.
 */
export function sectionOf(
  account: ClassifiableAccount
): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' | null {
  const declared = (account.accountType || '').toUpperCase();
  if (
    declared === 'ASSET' ||
    declared === 'LIABILITY' ||
    declared === 'EQUITY' ||
    declared === 'INCOME' ||
    declared === 'EXPENSE'
  ) {
    return declared;
  }
  switch ((account.code || '').charAt(0)) {
    case '1':
      return 'ASSET';
    case '2':
      return 'LIABILITY';
    case '3':
      return 'EQUITY';
    case '4':
      return 'INCOME';
    case '5':
    case '6':
    case '7':
      return 'EXPENSE';
    default:
      return null;
  }
}

/** Fixed, intangible and contra-asset accounts — everything else is current. */
const NON_CURRENT_ASSET =
  /fixed asset|accumulated depreciation|depreciation|land|building|plant|machinery|furniture|vehicle|equipment|intangible|goodwill|investment|electrical installation/i;

/** Borrowings and anything explicitly long-dated. */
const NON_CURRENT_LIABILITY = /loan|borrow|long[- ]term|debenture|mortgage/i;

/**
 * Current vs non-current, decided on the account group and name.
 *
 * The previous test returned true for **any** code in 1000–1999, which is every
 * asset in this chart — so Plant & Machinery, Land, Building and all nine
 * Accumulated Depreciation accounts were reported as *current* assets. The same
 * flaw on 2000–2999 filed the SBI bank loan as a current liability. Working
 * capital, the current ratio and the quick ratio all read those totals, so the
 * error propagated into the management report.
 */
export function isCurrentAsset(account: ClassifiableAccount): boolean {
  return !NON_CURRENT_ASSET.test(`${account.accountGroup || ''} ${account.name || ''}`);
}

export function isCurrentLiability(account: ClassifiableAccount): boolean {
  return !NON_CURRENT_LIABILITY.test(`${account.accountGroup || ''} ${account.name || ''}`);
}

/**
 * Generate Balance Sheet Report
 *
 * @param db Firestore instance
 * @param asOfDate Date for the balance sheet (typically end of period)
 * @param tenantId Tenant ID for multi-tenancy scoping
 * @returns Balance sheet data
 */
export async function generateBalanceSheet(
  db: Firestore,
  asOfDate: Date,
  tenantId: string
): Promise<BalanceSheetReport> {
  try {
    // Fetch all accounts
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
    const accountsQuery = query(accountsRef, where('tenantId', '==', tenantId));
    const accountsSnapshot = await getDocs(accountsQuery);

    const accounts: (AccountBalance & {
      openingBalance: number;
      accountType?: string;
      accountGroup?: string;
    })[] = [];
    accountsSnapshot.forEach((doc) => {
      const data = doc.data();
      // Group headers carry no balance of their own; including them would
      // double-count the children posted underneath them.
      if (data.isGroup === true) return;
      accounts.push({
        id: doc.id,
        code: data.code || '',
        name: data.name || '',
        balance: data.balance || 0,
        debit: data.debit || 0,
        credit: data.credit || 0,
        openingBalance: data.openingBalance || 0,
        accountType: data.accountType,
        accountGroup: data.accountGroup,
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
      const section = sectionOf(account);

      // Assets (debit balance is positive for assets)
      if (section === 'ASSET') {
        // Asset accounts: opening balance + transaction debits - transaction credits
        const assetBalance = account.openingBalance + account.debit - account.credit;
        if (assetBalance !== 0) {
          const assetAccount = { ...account, balance: assetBalance };
          if (isCurrentAsset(account)) {
            currentAssets.push(assetAccount);
          } else {
            // Accumulated depreciation is a contra-asset and belongs alongside
            // what it depreciates, so it nets against fixed assets rather than
            // drifting into "other".
            fixedAssets.push(assetAccount);
          }
        }
      }
      // Liabilities (credit balance is positive for liabilities)
      else if (section === 'LIABILITY') {
        const liabilityBalance = account.openingBalance + account.credit - account.debit;
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
      else if (section === 'EQUITY') {
        const equityBalance = account.openingBalance + account.credit - account.debit;
        const name = account.name.toLowerCase();
        if (name.includes('capital') || name.includes('equity')) {
          capitalBalance += equityBalance;
        } else {
          // Everything else that is equity — retained earnings, reserves and
          // surplus — accumulates here. The previous test matched only
          // "retained", so "Reserves & Surplus" was dropped from equity
          // entirely and the sheet failed to balance by that amount.
          retainedEarnings += equityBalance;
        }
      }
    });

    // Calculate current year profit from revenue and expense accounts
    let currentYearProfit = 0;
    accounts.forEach((account) => {
      const section = sectionOf(account);
      // Revenue (credit balance)
      if (section === 'INCOME') {
        currentYearProfit += account.credit - account.debit;
      }
      // Expenses (debit balance)
      if (section === 'EXPENSE') {
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
    logger.error('generateBalanceSheet failed', { asOfDate, error });
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
