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
import { docToTyped } from '@/lib/firebase/typeHelpers';
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

    // AC-15: Detect multiple current fiscal years (data integrity issue)
    if (snapshot.size > 1) {
      logger.error('Data integrity issue: multiple fiscal years marked as current', {
        count: snapshot.size,
        ids: snapshot.docs.map((d) => d.id),
      });
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      logger.warn('No current fiscal year document');
      return null;
    }

    return docToTyped<FiscalYear>(firstDoc.id, firstDoc.data());
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

    return docToTyped<FiscalYear>(fiscalYearDoc.id, fiscalYearDoc.data());
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

    const periods = snapshot.docs.map((d) => docToTyped<AccountingPeriod>(d.id, d.data()));

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
    if (period.status === 'OPEN') {
      return true;
    }

    // If normal period is closed, check for an open adjustment period in this FY
    // (allows April spillover transactions to be posted to the prior year's adjustment period)
    const adjQuery = query(
      periodsRef,
      where('fiscalYearId', '==', fiscalYearDoc.id),
      where('periodType', '==', 'ADJUSTMENT'),
      where('startDate', '<=', Timestamp.fromDate(transactionDate)),
      where('endDate', '>=', Timestamp.fromDate(transactionDate))
    );
    const adjSnapshot = await getDocs(adjQuery);

    if (!adjSnapshot.empty && adjSnapshot.docs[0]) {
      const adjPeriod = adjSnapshot.docs[0].data() as AccountingPeriod;
      if (adjPeriod.status === 'OPEN') {
        logger.info('Transaction falls in open adjustment period', {
          period: adjPeriod.name,
          transactionDate,
        });
        return true;
      }
    }

    logger.info('Accounting period is not open', {
      period: period.name,
      status: period.status,
    });

    return false;
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
 * Create an adjustment period for April spillover
 *
 * Indian companies close books on March 31, but vendor bills, receipts, and
 * adjustments continue into April that belong to the prior fiscal year.
 * This creates a 13th "ADJUSTMENT" period (April 1-30) tied to the prior FY.
 *
 * Transactions posted to this period are included in the prior year's closing.
 */
export async function createAdjustmentPeriod(
  db: Firestore,
  fiscalYearId: string,
  userId: string
): Promise<string> {
  const fiscalYear = await getFiscalYear(db, fiscalYearId);
  if (!fiscalYear) throw new Error('Fiscal year not found');

  if (fiscalYear.adjustmentPeriodId) {
    throw new Error('Adjustment period already exists for this fiscal year');
  }

  if (fiscalYear.closingStage === 'FINAL') {
    throw new Error('Cannot create adjustment period after final close');
  }

  // Adjustment period: April 1 to April 30 (the month after FY end)
  const fyEndDate =
    fiscalYear.endDate instanceof Date
      ? fiscalYear.endDate
      : (fiscalYear.endDate as unknown as { toDate: () => Date }).toDate();
  const adjStart = new Date(fyEndDate.getFullYear(), fyEndDate.getMonth() + 1, 1);
  const adjEnd = new Date(fyEndDate.getFullYear(), fyEndDate.getMonth() + 2, 0); // last day of April

  const periodRef = await addDoc(collection(db, COLLECTIONS.ACCOUNTING_PERIODS), {
    fiscalYearId,
    name: `Adjustment Period (${adjStart.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`,
    periodType: 'ADJUSTMENT',
    startDate: Timestamp.fromDate(adjStart),
    endDate: Timestamp.fromDate(adjEnd),
    status: 'OPEN',
    periodNumber: 13,
    year: adjStart.getFullYear(),
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
  });

  // Update fiscal year to reference the adjustment period
  await updateDoc(doc(db, COLLECTIONS.FISCAL_YEARS, fiscalYearId), {
    adjustmentPeriodId: periodRef.id,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  logger.info('Adjustment period created', {
    fiscalYearId,
    periodId: periodRef.id,
    startDate: adjStart,
    endDate: adjEnd,
  });

  return periodRef.id;
}

/**
 * Provisional close — closes all 12 monthly periods but keeps adjustment period open.
 * Generates a provisional closing JE that can be regenerated after spillover entries.
 */
export async function provisionalClose(
  db: Firestore,
  fiscalYearId: string,
  userId: string,
  retainedEarningsAccountId: string,
  entityId: string
): Promise<{ journalId: string; adjustmentPeriodId: string }> {
  const fiscalYear = await getFiscalYear(db, fiscalYearId);
  if (!fiscalYear) throw new Error('Fiscal year not found');

  if (fiscalYear.closingStage === 'FINAL') {
    throw new Error('Fiscal year already has a final close');
  }

  // Close all OPEN monthly periods
  const periods = await getAccountingPeriods(db, fiscalYearId);
  for (const period of periods) {
    if (period.periodType !== 'ADJUSTMENT' && period.status === 'OPEN') {
      await closePeriod(db, period.id, userId, 'Provisional year-end close');
    }
  }

  // Create adjustment period if it doesn't exist
  let adjustmentPeriodId = fiscalYear.adjustmentPeriodId;
  if (!adjustmentPeriodId) {
    adjustmentPeriodId = await createAdjustmentPeriod(db, fiscalYearId, userId);
  }

  // Calculate and create provisional closing JE
  const balances = await calculateYearEndBalances(db, fiscalYearId);

  // Import yearEndClosingService inline to avoid circular deps
  const { createClosingJournalEntry } = await import('./yearEndClosingService');
  const journalId = await createClosingJournalEntry(db, {
    fiscalYearId,
    fiscalYearName: fiscalYear.name,
    retainedEarningsAccountId,
    balances,
    userId,
    isProvisional: true,
    entityId,
  });

  // Update fiscal year
  await updateDoc(doc(db, COLLECTIONS.FISCAL_YEARS, fiscalYearId), {
    closingStage: 'PROVISIONAL',
    provisionalClosingDate: serverTimestamp(),
    provisionalClosingJournalId: journalId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  logger.info('Provisional close completed', { fiscalYearId, journalId, adjustmentPeriodId });

  return { journalId, adjustmentPeriodId };
}

/**
 * Final close — locks adjustment period, regenerates closing JE with adjustments, locks FY.
 */
export async function finalClose(
  db: Firestore,
  fiscalYearId: string,
  userId: string,
  retainedEarningsAccountId: string,
  entityId: string
): Promise<string> {
  const fiscalYear = await getFiscalYear(db, fiscalYearId);
  if (!fiscalYear) throw new Error('Fiscal year not found');

  if (fiscalYear.closingStage !== 'PROVISIONAL') {
    throw new Error('Fiscal year must be provisionally closed before final close');
  }

  // Close and lock the adjustment period
  if (fiscalYear.adjustmentPeriodId) {
    const adjPeriod = await getDoc(
      doc(db, COLLECTIONS.ACCOUNTING_PERIODS, fiscalYear.adjustmentPeriodId)
    );
    if (adjPeriod.exists()) {
      const adjData = adjPeriod.data();
      if (adjData?.status === 'OPEN') {
        await closePeriod(db, fiscalYear.adjustmentPeriodId, userId, 'Final year-end close');
      }
      if (adjData?.status !== 'LOCKED') {
        await lockPeriod(db, fiscalYear.adjustmentPeriodId, userId, 'Final year-end close');
      }
    }
  }

  // Lock all monthly periods
  const periods = await getAccountingPeriods(db, fiscalYearId);
  for (const period of periods) {
    if (period.status === 'CLOSED') {
      await lockPeriod(db, period.id, userId, 'Final year-end close');
    }
  }

  // Void provisional closing JE if exists
  if (fiscalYear.provisionalClosingJournalId) {
    const { voidClosingJournalEntry } = await import('./yearEndClosingService');
    await voidClosingJournalEntry(db, fiscalYear.provisionalClosingJournalId, userId);
  }

  // Recalculate and create final closing JE (now includes adjustment period transactions)
  const balances = await calculateYearEndBalances(db, fiscalYearId);
  const { createClosingJournalEntry } = await import('./yearEndClosingService');
  const journalId = await createClosingJournalEntry(db, {
    fiscalYearId,
    fiscalYearName: fiscalYear.name,
    retainedEarningsAccountId,
    balances,
    userId,
    isProvisional: false,
    entityId,
  });

  // Update fiscal year to CLOSED + FINAL
  await updateDoc(doc(db, COLLECTIONS.FISCAL_YEARS, fiscalYearId), {
    status: 'CLOSED',
    isYearEndClosed: true,
    yearEndClosingDate: serverTimestamp(),
    yearEndClosingJournalId: journalId,
    closingStage: 'FINAL',
    closedBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  logger.info('Final close completed', { fiscalYearId, journalId });

  return journalId;
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

    return snapshot.docs.map((d) => docToTyped<PeriodLockAudit>(d.id, d.data()));
  } catch (error) {
    logger.error('Failed to get period lock audit', { error, periodId });
    throw new Error('Failed to get period lock audit');
  }
}
