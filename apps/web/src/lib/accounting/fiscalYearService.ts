/**
 * Fiscal Year Service
 *
 * Manages fiscal years, accounting periods, and year-end closing processes.
 * Ensures transactions are posted in open periods and prevents backdated entries.
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  type Firestore,
  Timestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  FiscalYear,
  AccountingPeriod,
  ClosedAccountBalance,
  PeriodLockAudit,
  Account,
} from '@vapour/types';

const logger = createLogger({ context: 'fiscalYearService' });

/**
 * Get current fiscal year
 */
export async function getCurrentFiscalYear(db: Firestore): Promise<FiscalYear | null> {
  try {
    const fiscalYearsRef = collection(db, COLLECTIONS.FISCAL_YEARS);
    const q = query(fiscalYearsRef, where('isCurrent', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      logger.warn('No current fiscal year found');
      return null;
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      logger.warn('No current fiscal year document');
      return null;
    }

    return {
      id: firstDoc.id,
      ...firstDoc.data(),
    } as unknown as FiscalYear;
  } catch (error) {
    logger.error('Failed to get current fiscal year', { error });
    throw new Error('Failed to get current fiscal year');
  }
}

/**
 * Get fiscal year by ID
 */
export async function getFiscalYear(
  db: Firestore,
  fiscalYearId: string
): Promise<FiscalYear | null> {
  try {
    const fiscalYearDoc = await getDoc(doc(db, COLLECTIONS.FISCAL_YEARS, fiscalYearId));

    if (!fiscalYearDoc.exists()) {
      return null;
    }

    return {
      id: fiscalYearDoc.id,
      ...fiscalYearDoc.data(),
    } as unknown as FiscalYear;
  } catch (error) {
    logger.error('Failed to get fiscal year', { error, fiscalYearId });
    throw new Error('Failed to get fiscal year');
  }
}

/**
 * Get all accounting periods for a fiscal year
 */
export async function getAccountingPeriods(
  db: Firestore,
  fiscalYearId: string
): Promise<AccountingPeriod[]> {
  try {
    const periodsRef = collection(db, COLLECTIONS.ACCOUNTING_PERIODS);
    const q = query(periodsRef, where('fiscalYearId', '==', fiscalYearId));
    const snapshot = await getDocs(q);

    const periods = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as AccountingPeriod[];

    // Sort by period number
    return periods.sort((a, b) => a.periodNumber - b.periodNumber);
  } catch (error) {
    logger.error('Failed to get accounting periods', { error, fiscalYearId });
    throw new Error('Failed to get accounting periods');
  }
}

/**
 * Check if a transaction date falls in an open period
 *
 * @param db - Firestore instance
 * @param transactionDate - Date of the transaction
 * @returns true if period is open, false otherwise
 */
export async function isPeriodOpen(db: Firestore, transactionDate: Date): Promise<boolean> {
  try {
    // Get the fiscal year for this date
    const fiscalYearsRef = collection(db, COLLECTIONS.FISCAL_YEARS);
    const q = query(
      fiscalYearsRef,
      where('startDate', '<=', Timestamp.fromDate(transactionDate)),
      where('endDate', '>=', Timestamp.fromDate(transactionDate))
    );
    const fiscalYearSnapshot = await getDocs(q);

    if (fiscalYearSnapshot.empty) {
      logger.warn('No fiscal year found for transaction date', { transactionDate });
      return false;
    }

    const fiscalYearDoc = fiscalYearSnapshot.docs[0];
    if (!fiscalYearDoc) {
      logger.warn('No fiscal year document found');
      return false;
    }

    const fiscalYear = fiscalYearDoc.data() as FiscalYear;

    // Check if fiscal year is closed
    if (fiscalYear.status === 'CLOSED' || fiscalYear.status === 'LOCKED') {
      logger.info('Fiscal year is closed/locked', { fiscalYear: fiscalYear.name });
      return false;
    }

    // Get the accounting period for this date
    const periodsRef = collection(db, COLLECTIONS.ACCOUNTING_PERIODS);
    const periodQuery = query(
      periodsRef,
      where('fiscalYearId', '==', fiscalYearDoc.id),
      where('startDate', '<=', Timestamp.fromDate(transactionDate)),
      where('endDate', '>=', Timestamp.fromDate(transactionDate))
    );
    const periodSnapshot = await getDocs(periodQuery);

    if (periodSnapshot.empty) {
      logger.warn('No accounting period found for transaction date', { transactionDate });
      return false;
    }

    const periodDoc = periodSnapshot.docs[0];
    if (!periodDoc) {
      logger.warn('No accounting period document found');
      return false;
    }

    const period = periodDoc.data() as AccountingPeriod;

    // Check if period is open
    const isOpen = period.status === 'OPEN';
    if (!isOpen) {
      logger.info('Accounting period is not open', {
        period: period.name,
        status: period.status,
      });
    }

    return isOpen;
  } catch (error) {
    logger.error('Failed to check if period is open', { error, transactionDate });
    throw new Error('Failed to check period status');
  }
}

/**
 * Validate transaction date against period rules
 *
 * @throws Error if period is closed or invalid
 */
export async function validateTransactionDate(db: Firestore, transactionDate: Date): Promise<void> {
  const isOpen = await isPeriodOpen(db, transactionDate);

  if (!isOpen) {
    throw new Error(
      `Cannot post transaction: The accounting period for ${transactionDate.toLocaleDateString()} is closed. Please contact your accountant to reopen the period.`
    );
  }
}

/**
 * Close an accounting period
 */
export async function closePeriod(
  db: Firestore,
  periodId: string,
  userId: string,
  notes?: string
): Promise<void> {
  try {
    const periodRef = doc(db, COLLECTIONS.ACCOUNTING_PERIODS, periodId);
    const periodDoc = await getDoc(periodRef);

    if (!periodDoc.exists()) {
      throw new Error('Accounting period not found');
    }

    const period = periodDoc.data() as AccountingPeriod;

    if (period.status !== 'OPEN') {
      throw new Error(`Period cannot be closed: current status is ${period.status}`);
    }

    // Update period status
    await updateDoc(periodRef, {
      status: 'CLOSED',
      closedDate: serverTimestamp(),
      closedBy: userId,
      closingNotes: notes || '',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Create audit log
    await addDoc(collection(db, COLLECTIONS.PERIOD_LOCK_AUDIT), {
      periodId,
      fiscalYearId: period.fiscalYearId,
      action: 'CLOSE',
      actionDate: serverTimestamp(),
      actionBy: userId,
      reason: notes || 'Period closed',
      previousStatus: 'OPEN',
      newStatus: 'CLOSED',
    });

    logger.info('Accounting period closed', { periodId, periodName: period.name });
  } catch (error) {
    logger.error('Failed to close period', { error, periodId });
    throw error;
  }
}

/**
 * Lock an accounting period (prevents reopening)
 */
export async function lockPeriod(
  db: Firestore,
  periodId: string,
  userId: string,
  reason: string
): Promise<void> {
  try {
    const periodRef = doc(db, COLLECTIONS.ACCOUNTING_PERIODS, periodId);
    const periodDoc = await getDoc(periodRef);

    if (!periodDoc.exists()) {
      throw new Error('Accounting period not found');
    }

    const period = periodDoc.data() as AccountingPeriod;

    if (period.status !== 'CLOSED') {
      throw new Error('Only closed periods can be locked. Please close the period first.');
    }

    // Update period status
    await updateDoc(periodRef, {
      status: 'LOCKED',
      lockedDate: serverTimestamp(),
      lockedBy: userId,
      lockReason: reason,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Create audit log
    await addDoc(collection(db, COLLECTIONS.PERIOD_LOCK_AUDIT), {
      periodId,
      fiscalYearId: period.fiscalYearId,
      action: 'LOCK',
      actionDate: serverTimestamp(),
      actionBy: userId,
      reason,
      previousStatus: 'CLOSED',
      newStatus: 'LOCKED',
    });

    logger.info('Accounting period locked', { periodId, periodName: period.name });
  } catch (error) {
    logger.error('Failed to lock period', { error, periodId });
    throw error;
  }
}

/**
 * Reopen a closed period
 * (Only for CLOSED periods, not LOCKED)
 */
export async function reopenPeriod(
  db: Firestore,
  periodId: string,
  userId: string,
  reason: string
): Promise<void> {
  try {
    const periodRef = doc(db, COLLECTIONS.ACCOUNTING_PERIODS, periodId);
    const periodDoc = await getDoc(periodRef);

    if (!periodDoc.exists()) {
      throw new Error('Accounting period not found');
    }

    const period = periodDoc.data() as AccountingPeriod;

    if (period.status === 'LOCKED') {
      throw new Error('Cannot reopen a locked period. Please contact system administrator.');
    }

    if (period.status !== 'CLOSED') {
      throw new Error('Only closed periods can be reopened');
    }

    // Update period status
    await updateDoc(periodRef, {
      status: 'OPEN',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Create audit log
    await addDoc(collection(db, COLLECTIONS.PERIOD_LOCK_AUDIT), {
      periodId,
      fiscalYearId: period.fiscalYearId,
      action: 'UNLOCK',
      actionDate: serverTimestamp(),
      actionBy: userId,
      reason,
      previousStatus: 'CLOSED',
      newStatus: 'OPEN',
    });

    logger.info('Accounting period reopened', { periodId, periodName: period.name });
  } catch (error) {
    logger.error('Failed to reopen period', { error, periodId });
    throw error;
  }
}

/**
 * Calculate account balances for year-end closing
 *
 * @param db - Firestore instance
 * @param fiscalYearId - Fiscal year to close
 * @returns Revenue and expense account balances
 */
export async function calculateYearEndBalances(
  db: Firestore,
  fiscalYearId: string
): Promise<{
  revenueAccounts: ClosedAccountBalance[];
  expenseAccounts: ClosedAccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}> {
  try {
    // Get all INCOME and EXPENSE accounts
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
    const accountsSnapshot = await getDocs(accountsRef);

    const revenueAccounts: ClosedAccountBalance[] = [];
    const expenseAccounts: ClosedAccountBalance[] = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    accountsSnapshot.docs.forEach((docSnapshot) => {
      const account = docSnapshot.data() as Account;

      // Only close accounts with balances
      if (account.currentBalance === 0) return;

      if (account.accountType === 'INCOME') {
        const balance: ClosedAccountBalance = {
          accountId: docSnapshot.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: 'INCOME',
          closingBalance: account.currentBalance,
        };
        revenueAccounts.push(balance);
        totalRevenue += account.currentBalance;
      } else if (account.accountType === 'EXPENSE') {
        const balance: ClosedAccountBalance = {
          accountId: docSnapshot.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: 'EXPENSE',
          closingBalance: account.currentBalance,
        };
        expenseAccounts.push(balance);
        totalExpenses += account.currentBalance;
      }
    });

    const netIncome = totalRevenue - totalExpenses;

    logger.info('Calculated year-end balances', {
      revenueAccountCount: revenueAccounts.length,
      expenseAccountCount: expenseAccounts.length,
      totalRevenue,
      totalExpenses,
      netIncome,
    });

    return {
      revenueAccounts,
      expenseAccounts,
      totalRevenue,
      totalExpenses,
      netIncome,
    };
  } catch (error) {
    logger.error('Failed to calculate year-end balances', { error, fiscalYearId });
    throw new Error('Failed to calculate year-end balances');
  }
}

/**
 * Get period lock audit history
 */
export async function getPeriodLockAudit(
  db: Firestore,
  periodId: string
): Promise<PeriodLockAudit[]> {
  try {
    const auditRef = collection(db, COLLECTIONS.PERIOD_LOCK_AUDIT);
    const q = query(auditRef, where('periodId', '==', periodId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as PeriodLockAudit[];
  } catch (error) {
    logger.error('Failed to get period lock audit', { error, periodId });
    throw new Error('Failed to get period lock audit');
  }
}
